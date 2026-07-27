import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, model_validator


class InquiryCreate(BaseModel):
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None = None
    inquiry_date: date | None = None
    pax: int | None = None
    per_plate_rate: Decimal | None = None
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
    per_plate_rate: Decimal | None = None
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
    per_plate_rate: Decimal | None
    status: str
    assigned_to: uuid.UUID | None
    created_by: uuid.UUID
    follow_up_date: date | None
    remarks: str | None
    advance_amount: Decimal
    payment_status: str
    total_amount: float | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode='after')
    def compute_total_amount(self):
        if self.per_plate_rate is not None and self.pax is not None:
            self.total_amount = float(self.per_plate_rate) * self.pax
        return self

    class Config:
        from_attributes = True
