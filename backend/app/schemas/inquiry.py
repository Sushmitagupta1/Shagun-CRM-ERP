import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, model_validator
from app.models.inquiry import InquiryStatus, PaymentStatus


class InquiryCreate(BaseModel):
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None = None
    inquiry_date: date | None = None
    pax: int | None = None
    per_plate_rate: Decimal | None = None
    add_on: Decimal | None = None
    assigned_to: uuid.UUID | None = None
    follow_up_date: date | None = None
    remarks: str | None = None
    menu_uploaded: bool | None = None
    method: str | None = None
    method_details: str | None = None
    advance_payment_date: date | None = None
    remaining_payment_date: date | None = None
    birthday_date: date | None = None
    anniversary_date: date | None = None


class InquiryUpdate(BaseModel):
    client_name: str | None = None
    client_phone: str | None = None
    event_type: str | None = None
    event_date: date | None = None
    inquiry_date: date | None = None
    pax: int | None = None
    per_plate_rate: Decimal | None = None
    add_on: Decimal | None = None
    assigned_to: uuid.UUID | None = None
    remarks: str | None = None
    menu_uploaded: bool | None = None
    menu_content: str | None = None
    method: str | None = None
    method_details: str | None = None
    advance_payment_date: date | None = None
    remaining_payment_date: date | None = None
    birthday_date: date | None = None
    anniversary_date: date | None = None


class InquiryResponse(BaseModel):
    id: uuid.UUID
    client_name: str
    client_phone: str
    event_type: str
    event_date: date | None
    inquiry_date: date | None
    pax: int | None
    per_plate_rate: Decimal | None
    add_on: float | None = None
    status: InquiryStatus
    assigned_to: uuid.UUID | None
    created_by: uuid.UUID
    remarks: str | None
    menu_uploaded: bool = False
    menu_content: str | None = None
    menu_file_name: str | None = None
    presentation_file_name: str | None = None
    advance_amount: Decimal
    payment_status: PaymentStatus
    method: str | None = None
    method_details: str | None = None
    advance_payment_date: date | None = None
    remaining_payment_date: date | None = None
    birthday_date: date | None = None
    anniversary_date: date | None = None
    total_amount: float | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode='after')
    def compute_total_amount(self):
        if self.per_plate_rate is not None and self.pax is not None:
            self.total_amount = float(self.per_plate_rate) * self.pax + (self.add_on or 0)
        return self

    class Config:
        from_attributes = True


class FollowUpCreate(BaseModel):
    follow_up_date: date
    remarks: str | None = None


class FollowUpResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    follow_up_date: date
    remarks: str | None
    created_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class MeetingCreate(BaseModel):
    meeting_at: datetime
    remarks: str | None = None


class MeetingStatusUpdate(BaseModel):
    status: Literal["scheduled", "completed"]


class MeetingResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    meeting_at: datetime
    remarks: str | None
    status: str
    created_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
