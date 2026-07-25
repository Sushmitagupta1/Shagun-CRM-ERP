import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: RoleResponse
    is_active: bool
    avatar_url: str | None
    created_at: datetime
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role_id: uuid.UUID


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role_id: uuid.UUID | None = None
    is_active: bool | None = None
