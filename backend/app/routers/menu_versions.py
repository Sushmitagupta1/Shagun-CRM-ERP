import uuid
import json
import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.inquiry import Inquiry
from app.models.menu_version import MenuVersion
from app.models.user import User
from app.schemas.menu_version import MenuVersionCreate, MenuVersionResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/inquiries", tags=["menu-versions"])


@router.get("/{inquiry_id}/menu-versions", response_model=list[MenuVersionResponse])
async def list_menu_versions(
    inquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MenuVersion)
        .where(MenuVersion.inquiry_id == inquiry_id)
        .order_by(MenuVersion.version.desc())
    )
    versions = result.scalars().all()
    items = []
    for v in versions:
        resp = MenuVersionResponse.model_validate(v)
        resp.designs = json.loads(v.designs) if v.designs else []
        items.append(resp)
    return items


@router.post("/{inquiry_id}/menu-versions", response_model=MenuVersionResponse)
async def create_menu_version(
    inquiry_id: uuid.UUID,
    payload: MenuVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = await db.get(Inquiry, inquiry_id)
    if inquiry is None:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    max_result = await db.execute(
        select(func.max(MenuVersion.version)).where(MenuVersion.inquiry_id == inquiry_id)
    )
    next_version = (max_result.scalar() or 0) + 1

    version = MenuVersion(
        inquiry_id=inquiry_id,
        version=next_version,
        menu_text=payload.menu_text,
        designs=json.dumps(payload.designs, ensure_ascii=False),
        template_category=payload.template_category,
        template_file=payload.template_file,
        created_by=current_user.id,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    resp = MenuVersionResponse.model_validate(version)
    resp.designs = json.loads(version.designs) if version.designs else []
    return resp
