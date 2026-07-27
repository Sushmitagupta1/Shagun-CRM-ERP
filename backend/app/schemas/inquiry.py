import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class InquiryCreate(BaseModel):
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None = None
    inquiry_date: date | None = None
    pax: int | None = None
    budget: Decimal | None = None
    assigned_to: uuid.UUID | None = None
    follow_up_date: date | None = None
    remarks: str | None = None


class InquiryUpdate(BaseModel):
    client_name: str | None = None
    client_phone: str | None = None
    event_type: str | None = None
    event_date: date | None = None
    inquiry_date: date | None = None
    pax: int | None = None
    budget: Decimal | None = None
    assigned_to: uuid.UUID | None = None
    follow_up_date: date | None = None
    remarks: str | None = None


class InquiryResponse(BaseModel):
    id: uuid.UUID
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None
    inquiry_date: date | None
    pax: int | None
    budget: Decimal | None
    status: str
    assigned_to: uuid.UUID | None
    created_by: uuid.UUID
    follow_up_date: date | None
    remarks: str | None
    advance_amount: Decimal
    payment_status: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True
