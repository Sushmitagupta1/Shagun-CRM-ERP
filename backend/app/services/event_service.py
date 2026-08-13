import os
import uuid
from collections import defaultdict
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inquiry import Inquiry
from app.models.user import User
from app.models.inventory_movement import InventoryMovement
from app.models.event_inventory_item import EventInventoryItem
from app.models.event_vendor import EventVendor
from app.models.kitchen_inventory_item import KitchenInventoryItem
from app.models.inventory_file_version import InventoryFileVersion
from app.models.settlement import Settlement, SettlementStatus
from app.models.warehouse_request import WarehouseRequest
from app.models.event_photo import EventPhoto
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


async def _user_name_map(db: AsyncSession, user_ids: set[uuid]) -> dict[str, str]:
    if not user_ids:
        return {}
    result = await db.execute(select(User.id, User.full_name).where(User.id.in_(list(user_ids))))
    return {str(uid): name for uid, name in result.all()}


async def _inquiry_name_map(db: AsyncSession, inquiry_ids: set[uuid]) -> dict[str, str]:
    if not inquiry_ids:
        return {}
    result = await db.execute(select(Inquiry.id, Inquiry.client_name).where(Inquiry.id.in_(list(inquiry_ids))))
    return {str(iid): name for iid, name in result.all()}


def _build_timeline(
    inquiry: Inquiry,
    has_kitchen: bool,
    has_warehouse_request: bool,
    settlement_status: str | None,
    today: date,
) -> list[dict]:
    execution_date = None
    if inquiry.event_date:
        execution_date = inquiry.event_date - timedelta(days=1)
    return [
        {
            "key": "planning",
            "label": "Planning",
            "status": "completed",
            "date": inquiry.created_at,
            "description": "Inquiry converted to confirmed event",
        },
        {
            "key": "kitchen",
            "label": "Kitchen",
            "status": "completed" if has_kitchen else "pending",
            "date": None,
            "description": "Kitchen plan / ingredient list prepared",
        },
        {
            "key": "warehouse_request",
            "label": "Warehouse Request",
            "status": "completed" if has_warehouse_request else "pending",
            "date": None,
            "description": "Inventory requested from warehouse",
        },
        {
            "key": "execution",
            "label": "Execution",
            "status": "completed" if inquiry.is_completed else ("active" if execution_date and today >= execution_date else "pending"),
            "date": inquiry.completed_at if inquiry.is_completed else None,
            "description": "Event execution window",
        },
        {
            "key": "completion",
            "label": "Completion",
            "status": "completed" if inquiry.is_completed else ("active" if inquiry.event_date and today >= inquiry.event_date else "pending"),
            "date": inquiry.completed_at if inquiry.is_completed else None,
            "description": "Event execution finished",
        },
        {
            "key": "settlement",
            "label": "Settlement",
            "status": settlement_status or "pending",
            "date": None,
            "description": "Financial settlement for the event",
        },
    ]


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

    wr_result = await db.execute(
        select(WarehouseRequest)
        .where(WarehouseRequest.inquiry_id == inquiry.id)
        .order_by(WarehouseRequest.created_at.asc())
    )
    warehouse_rows = wr_result.scalars().all()
    wr_user_ids = {r.requested_by for r in warehouse_rows}
    for r in warehouse_rows:
        if r.issued_by:
            wr_user_ids.add(r.issued_by)
        if r.received_by:
            wr_user_ids.add(r.received_by)
    wr_names = await _user_name_map(db, wr_user_ids)
    warehouse_requests = [
        {
            "id": str(r.id),
            "item_name": r.item_name,
            "quantity": r.quantity,
            "unit": r.unit,
            "status": r.status,
            "requested_by_name": wr_names.get(str(r.requested_by)),
            "issued_by_name": wr_names.get(str(r.issued_by)) if r.issued_by else None,
            "received_by_name": wr_names.get(str(r.received_by)) if r.received_by else None,
            "notes": r.notes,
            "created_at": r.created_at,
        }
        for r in warehouse_rows
    ]

    photo_result = await db.execute(
        select(EventPhoto, User.full_name)
        .join(User, EventPhoto.uploaded_by == User.id)
        .where(EventPhoto.inquiry_id == inquiry.id)
        .order_by(EventPhoto.created_at.desc())
    )
    photos = [
        {
            "id": str(p.id),
            "category": p.category,
            "file_name": p.file_name,
            "uploaded_at": p.created_at,
            "uploaded_by_name": name,
        }
        for p, name in photo_result.all()
    ]

    transfer_targets = await _inquiry_name_map(db, {m.to_inquiry_id for m in movements if m.to_inquiry_id})
    returns: list[dict] = []
    transfers: list[dict] = []
    wastage_rows: list[dict] = []
    for m in movements:
        if m.movement_type not in ("returned", "transferred", "wastage"):
            continue
        base = {
            "id": str(m.id),
            "item_name": m.item_name,
            "quantity": m.quantity,
            "unit": m.unit,
            "from_event": inquiry.client_name,
            "created_at": m.created_at,
        }
        if m.movement_type == "returned":
            returns.append(base)
        elif m.movement_type == "transferred":
            transfers.append({**base, "to_event": transfer_targets.get(str(m.to_inquiry_id)) if m.to_inquiry_id else None})
        else:
            wastage_rows.append(base)

    settlement_row = (
        await db.execute(select(Settlement).where(Settlement.inquiry_id == inquiry.id))
    ).scalar_one_or_none()
    settlement_status = None
    if settlement_row is not None:
        settlement_status = "active" if settlement_row.status == SettlementStatus.PENDING else "completed"
    timeline = _build_timeline(
        inquiry,
        has_kitchen=bool(inquiry.ingredient_file_path or inquiry.kitchen_inventory_file_path),
        has_warehouse_request=bool(warehouse_rows),
        settlement_status=settlement_status,
        today=date.today(),
    )

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
                "payment_status": v.payment_status,
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
        "presentation_file_name": inquiry.presentation_file_name,
        "ingredient_file_name": inquiry.ingredient_file_name,
        "kitchen_inventory_file_name": inquiry.kitchen_inventory_file_name,
        "warehouse_requests": warehouse_requests,
        "photos": photos,
        "returns": returns,
        "transfers": transfers,
        "wastage_rows": wastage_rows,
        "timeline": timeline,
    }
