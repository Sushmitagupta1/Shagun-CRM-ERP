import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel


class MenuVersionCreate(BaseModel):
    menu_text: str | None = None
    designs: list[dict[str, Any]] = []
    template_category: str | None = None
    template_file: str | None = None


class MenuVersionResponse(BaseModel):
    id: uuid.UUID
    inquiry_id: uuid.UUID
    version: int
    menu_text: str | None = None
    designs: list[dict[str, Any]] = []
    template_category: str | None = None
    template_file: str | None = None
    created_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
