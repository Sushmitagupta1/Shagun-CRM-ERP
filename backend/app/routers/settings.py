import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.company_settings import CompanySettings
from app.middleware.auth import require_role
from app.config import settings as app_settings
from app.schemas.settings import CompanySettingsResponse, CompanySettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULTS = {
    "name": "Shagun Caterers",
    "email": "catering@cafeuppercrust.com",
    "phone": "+91 8980003121",
    "gst": "24AEOFS0061F1Z7",
    "address": "Parshwanath Business Park, 100 Feet Rd, Satellite, Prahlad Nagar",
}


async def get_or_create(db: AsyncSession) -> CompanySettings:
    result = await db.execute(select(CompanySettings).order_by(CompanySettings.id).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        row = CompanySettings(id=1, **DEFAULTS)
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


@router.get("/company", response_model=CompanySettingsResponse)
async def get_company_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    row = await get_or_create(db)
    return row


@router.put("/company", response_model=CompanySettingsResponse)
async def update_company_settings(
    data: CompanySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    row = await get_or_create(db)
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if value is not None and str(value).strip():
            setattr(row, field, str(value).strip())
    await db.flush()
    await db.refresh(row)
    return row


@router.post("/company/logo", response_model=CompanySettingsResponse)
async def upload_company_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"):
        raise HTTPException(status_code=400, detail="Logo must be an image (jpg, png, webp, svg, gif)")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo file too large (max 5MB)")

    row = await get_or_create(db)
    upload_dir = os.path.join(app_settings.UPLOAD_DIR, "company")
    os.makedirs(upload_dir, exist_ok=True)
    file_name = f"logo{ext}"
    file_path = os.path.join(upload_dir, file_name)
    with open(file_path, "wb") as f:
        f.write(content)
    row.logo_file_name = file_name
    row.logo_path = file_path
    await db.flush()
    await db.refresh(row)
    return row


@router.get("/company/logo")
async def get_company_logo(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CompanySettings).order_by(CompanySettings.id).limit(1))
    row = result.scalar_one_or_none()
    if row is None or not row.logo_path or not os.path.isfile(row.logo_path):
        raise HTTPException(status_code=404, detail="No logo uploaded")
    media_type = "image/svg+xml" if row.logo_path.lower().endswith(".svg") else None
    return FileResponse(
        path=row.logo_path,
        filename=row.logo_file_name,
        media_type=media_type,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )
