import uuid
from decimal import Decimal
from pydantic import BaseModel


class SettlementCreate(BaseModel):
    inquiry_id: uuid.UUID
    revenue: Decimal
    vendor_cost: Decimal = Decimal("0")
    other_expenses: Decimal = Decimal("0")
    notes: str | None = None


class SettlementUpdate(BaseModel):
    revenue: Decimal | None = None
    vendor_cost: Decimal | None = None
    other_expenses: Decimal | None = None
    notes: str | None = None


class SettlementResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    revenue: Decimal
    vendor_cost: Decimal
    other_expenses: Decimal
    net_profit: Decimal
    status: str
    notes: str | None
    created_by: uuid.UUID
    created_at: str
    class Config:
        from_attributes = True
