import uuid
from datetime import datetime
from pydantic import BaseModel


class MenuTemplateCreate(BaseModel):
    name: str
    category: str
    description: str | None = None
    dish_count: int = 0
    gradient: str = "from-amber-600 to-orange-700"
    dishes: dict | None = None


class MenuTemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    dish_count: int | None = None
    gradient: str | None = None
    dishes: dict | None = None


class MenuTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    description: str | None
    dish_count: int
    gradient: str
    dishes: dict | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
