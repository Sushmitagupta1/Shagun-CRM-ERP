import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User, Role
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.common import PaginatedResponse
from app.middleware.auth import require_role
from app.services.auth_service import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = select(User).options(selectinload(User.role)).join(Role)
    count_query = select(func.count(User.id)).join(Role)
    if role:
        query = query.where(Role.name == role)
        count_query = count_query.where(Role.name == role)
    if search:
        search_filter = User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()
    return PaginatedResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(User).options(selectinload(User.role)).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    username = (data.username or data.email.split("@")[0]).strip()
    existing_username = await db.execute(select(User).where(User.username == username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    role_result = await db.execute(select(Role).where(Role.id == data.role_id))
    if role_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = User(id=uuid.uuid4(), email=data.email, username=username, password_hash=hash_password(data.password), full_name=data.full_name, role_id=data.role_id, is_active=True)
    db.add(user)
    await db.flush()
    await db.refresh(user, ["role"])
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: uuid.UUID, data: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    payload = data.model_dump(exclude_unset=True)
    if "username" in payload:
        username = (payload["username"] or "").strip()
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        existing_username = await db.execute(select(User).where(User.username == username, User.id != user_id))
        if existing_username.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
        payload["username"] = username
    if "password" in payload:
        password = payload.pop("password")
        if password:
            payload["password_hash"] = hash_password(password)
    for field, value in payload.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user, ["role"])
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.flush()
    return {"message": "User deactivated"}
