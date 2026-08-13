import uuid
from datetime import date, datetime
from pydantic import BaseModel


class EventListItem(BaseModel):
    id: uuid.UUID
    client_name: str
    event_type: str
    event_date: date | None = None
    venue: str | None = None
    pax: int | None = None
    status: str
    is_completed: bool = False


class EventInventoryRow(BaseModel):
    sr_no: int
    item_name: str
    required_qty: float = 0
    received_qty: float = 0
    not_received_count: int = 0
    received_status: str = "Not Received"
    transfer_count: float = 0
    returned_qty: float = 0
    unit: str | None = None
    remark: str | None = None


class EventVendorRow(BaseModel):
    id: uuid.UUID
    vendor_name: str
    service_name: str | None = None
    rate: float | None = None
    total_cost: float | None = None
    remark: str | None = None


class KitchenInventoryRow(BaseModel):
    id: uuid.UUID
    item_name: str
    prepared_qty: float = 0
    unit: str | None = None
    used_qty: float = 0
    remaining_qty: float = 0
    remark: str | None = None


class ClosureSummary(BaseModel):
    total_items: int = 0
    total_required_qty: float = 0
    total_received_qty: float = 0
    not_received_qty: float = 0
    transferred_qty: float = 0
    returned_thol_qty: float = 0
    wastage_qty: float = 0


class FileVersion(BaseModel):
    id: uuid.UUID
    movement_type: str
    file_name: str
    version_no: int
    uploaded_at: datetime
    uploaded_by_name: str | None = None


class EventDetail(BaseModel):
    id: uuid.UUID
    client_name: str
    client_phone: str | None = None
    event_type: str
    event_date: date | None = None
    pax: int | None = None
    status: str
    venue: str | None = None
    sales_head_name: str | None = None
    created_at: datetime
    is_completed: bool = False
    completed_at: datetime | None = None
    menu: dict = {}
    inventory: list[EventInventoryRow] = []
    vendors: list[EventVendorRow] = []
    total_vendor_cost: float = 0
    kitchen_inventory: list[KitchenInventoryRow] = []
    closure: ClosureSummary = ClosureSummary()
    upload_history: list[FileVersion] = []


class InventoryItemSave(BaseModel):
    item_name: str
    received_qty: float | None = None
    transfer_count: float | None = None
    returned_qty: float | None = None
    remark: str | None = None


class InventoryItemsSaveRequest(BaseModel):
    rows: list[InventoryItemSave]


class VendorSave(BaseModel):
    id: uuid.UUID
    rate: float | None = None
    total_cost: float | None = None
    remark: str | None = None


class VendorsSaveRequest(BaseModel):
    rows: list[VendorSave]
