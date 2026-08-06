import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class InventoryMovementCreate(BaseModel):
    movement_type: Literal["received", "returned", "transferred", "wastage"]
    item_name: str = Field(min_length=1, max_length=255)
    quantity: float = Field(gt=0)
    unit: str | None = Field(default=None, max_length=50)
    notes: str | None = None


class InventoryMovementResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    movement_type: str
    item_name: str
    quantity: float
    unit: str | None
    notes: str | None
    created_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
