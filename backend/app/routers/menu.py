import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.menu import MenuTemplate
from app.models.user import User
from app.schemas.menu import MenuTemplateCreate, MenuTemplateUpdate, MenuTemplateResponse
from app.middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/menu-templates", tags=["menu-templates"])


@router.get("", response_model=list[MenuTemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MenuTemplate).order_by(MenuTemplate.name))
    return [MenuTemplateResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/{template_id}", response_model=MenuTemplateResponse)
async def get_template(template_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MenuTemplate).where(MenuTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return MenuTemplateResponse.model_validate(template)


@router.post("", response_model=MenuTemplateResponse, status_code=201)
async def create_template(data: MenuTemplateCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "menu_planner"))):
    template = MenuTemplate(**data.model_dump())
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return MenuTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=MenuTemplateResponse)
async def update_template(template_id: uuid.UUID, data: MenuTemplateUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "menu_planner"))):
    result = await db.execute(select(MenuTemplate).where(MenuTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    await db.flush()
    await db.refresh(template)
    return MenuTemplateResponse.model_validate(template)


@router.delete("/{template_id}")
async def delete_template(template_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(MenuTemplate).where(MenuTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.flush()
    return {"message": "Template deleted"}
