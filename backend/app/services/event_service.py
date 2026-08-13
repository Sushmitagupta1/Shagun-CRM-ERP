import os
from collections import defaultdict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inquiry import Inquiry
from app.models.user import User
from app.models.inventory_movement import InventoryMovement
from app.models.event_inventory_item import EventInventoryItem
from app.models.event_vendor import EventVendor
from app.models.kitchen_inventory_item import KitchenInventoryItem
from app.models.inventory_file_version import InventoryFileVersion
from app.services.file_parsers import parse_item_qty_file


def _sum_movements(movements: list[InventoryMovement], movement_type: str) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for m in movements:
        if m.movement_type == movement_type:
            totals[m.item_name.strip().lower()] += m.quantity or 0
    return totals


def _status(received: float, required: float) -> str:
    if required <= 0:
        return "Not Received"
    if received >= required:
        return "Received"
    if received > 0:
        return "Partial"
    return "Not Received"


async def get_base_inventory_map(db: AsyncSession, inquiry: Inquiry) -> dict[str, dict]:
    """Return dict keyed by lowercased item name -> base row from ingredient excel + movements."""
    if not inquiry.ingredient_file_path or not os.path.isfile(inquiry.ingredient_file_path):
        return {}
    ext = os.path.splitext(inquiry.ingredient_file_name or "")[1].lower()
    if ext not in (".xlsx", ".csv"):
        return {}
    ingredient_items = parse_item_qty_file(inquiry.ingredient_file_path, ext)

    mov_result = await db.execute(select(InventoryMovement).where(InventoryMovement.inquiry_id == inquiry.id))
    movements = mov_result.scalars().all()
    received = _sum_movements(movements, "received")
    transferred = _sum_movements(movements, "transferred")
    returned = _sum_movements(movements, "returned")

    result: dict[str, dict] = {}
    for idx, (item, qty, unit) in enumerate(ingredient_items, start=1):
        key = item.strip().lower()
        result[key] = {
            "sr_no": idx,
            "item_name": item.strip(),
            "required_qty": qty,
            "received_qty": received.get(key, 0),
            "transfer_count": transferred.get(key, 0),
            "returned_qty": returned.get(key, 0),
            "unit": unit,
            "remark": None,
        }
    return result


async def build_event_bundle(db: AsyncSession, inquiry: Inquiry) -> dict:
    base_map = await get_base_inventory_map(db, inquiry)

    override_result = await db.execute(
        select(EventInventoryItem).where(EventInventoryItem.inquiry_id == inquiry.id)
    )
    overrides = {o.item_name.strip().lower(): o for o in override_result.scalars().all()}

    inventory_rows = []
    for key, base in base_map.items():
        ov = overrides.get(key)
        received_qty = ov.received_qty if ov is not None and ov.received_qty is not None else base["received_qty"]
        transfer_count = ov.transfer_count if ov is not None and ov.transfer_count is not None else base["transfer_count"]
        returned_qty = ov.returned_qty if ov is not None and ov.returned_qty is not None else base["returned_qty"]
        inventory_rows.append({
            "sr_no": base["sr_no"],
            "item_name": base["item_name"],
            "required_qty": base["required_qty"],
            "received_qty": received_qty,
            "not_received_count": 1 if received_qty == 0 else 0,
            "received_status": _status(received_qty, base["required_qty"]),
            "transfer_count": transfer_count,
            "returned_qty": returned_qty,
            "unit": base["unit"],
            "remark": ov.remark if ov is not None else None,
        })

    vendor_result = await db.execute(
        select(EventVendor).where(EventVendor.inquiry_id == inquiry.id).order_by(EventVendor.created_at.asc())
    )
    vendors = vendor_result.scalars().all()
    total_vendor_cost = sum(float(v.total_cost or 0) for v in vendors)

    kitchen_result = await db.execute(
        select(KitchenInventoryItem).where(KitchenInventoryItem.inquiry_id == inquiry.id).order_by(KitchenInventoryItem.created_at.asc())
    )
    kitchen_items = kitchen_result.scalars().all()

    mov_result = await db.execute(select(InventoryMovement).where(InventoryMovement.inquiry_id == inquiry.id))
    movements = mov_result.scalars().all()
    wastage_qty = sum(m.quantity or 0 for m in movements if m.movement_type == "wastage")

    sales_head_name = None
    if inquiry.assigned_to:
        user = await db.get(User, inquiry.assigned_to)
        if user:
            sales_head_name = user.full_name

    hist_result = await db.execute(
        select(InventoryFileVersion, User.full_name)
        .join(User, InventoryFileVersion.uploaded_by == User.id)
        .where(InventoryFileVersion.inquiry_id == inquiry.id)
        .order_by(InventoryFileVersion.created_at.desc())
    )
    upload_history = [
        {
            "id": str(v.id),
            "movement_type": v.movement_type,
            "file_name": v.file_name,
            "version_no": v.version_no,
            "uploaded_at": v.created_at,
            "uploaded_by_name": name,
        }
        for v, name in hist_result.all()
    ]

    closure = {
        "total_items": len(inventory_rows),
        "total_required_qty": sum(r["required_qty"] for r in inventory_rows),
        "total_received_qty": sum(r["received_qty"] for r in inventory_rows),
        "not_received_qty": sum(r["required_qty"] for r in inventory_rows if r["received_qty"] == 0),
        "transferred_qty": sum(r["transfer_count"] for r in inventory_rows),
        "returned_thol_qty": sum(r["returned_qty"] for r in inventory_rows),
        "wastage_qty": wastage_qty,
    }

    return {
        "id": str(inquiry.id),
        "client_name": inquiry.client_name,
        "client_phone": inquiry.client_phone,
        "event_type": inquiry.event_type,
        "event_date": inquiry.event_date,
        "pax": inquiry.pax,
        "status": inquiry.status.value if hasattr(inquiry.status, "value") else str(inquiry.status),
        "venue": inquiry.venue,
        "sales_head_name": sales_head_name,
        "created_at": inquiry.created_at,
        "is_completed": inquiry.is_completed,
        "completed_at": inquiry.completed_at,
        "menu": {
            "file_name": inquiry.menu_file_name,
            "uploaded": bool(inquiry.menu_file_name or inquiry.menu_content),
        },
        "inventory": inventory_rows,
        "vendors": [
            {
                "id": str(v.id),
                "vendor_name": v.vendor_name,
                "service_name": v.service_name,
                "rate": float(v.rate) if v.rate is not None else None,
                "total_cost": float(v.total_cost) if v.total_cost is not None else None,
                "remark": v.remark,
            }
            for v in vendors
        ],
        "total_vendor_cost": total_vendor_cost,
        "kitchen_inventory": [
            {
                "id": str(k.id),
                "item_name": k.item_name,
                "prepared_qty": k.prepared_qty,
                "unit": k.unit,
                "used_qty": k.used_qty,
                "remaining_qty": k.remaining_qty,
                "remark": k.remark,
            }
            for k in kitchen_items
        ],
        "closure": closure,
        "upload_history": upload_history,
    }
