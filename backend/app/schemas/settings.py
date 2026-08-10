from pydantic import BaseModel, EmailStr


class CompanySettingsResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    gst: str
    address: str
    logo_file_name: str | None
    logo_path: str | None
    notifications: dict | None = None
    session_timeout_minutes: int | None = None
    class Config:
        from_attributes = True


class CompanySettingsUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    gst: str | None = None
    address: str | None = None
    notifications: dict | None = None
    session_timeout_minutes: int | None = None
