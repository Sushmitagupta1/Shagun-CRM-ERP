from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import AdminKPIs, SalesKPIs, FinanceKPIs, MenuPlannerKPIs, PresentationKPIs, OperationsKPIs, KitchenKPIs, WarehouseKPIs
from app.middleware.auth import get_current_user, require_role
from app.services.dashboard_service import get_admin_kpis, get_sales_kpis, get_monthly_trend, get_status_distribution, get_sales_funnel, get_menu_planner_kpis, get_presentation_kpis, get_operations_kpis, get_kitchen_kpis, get_warehouse_kpis
from app.services.settlement_service import get_finance_stats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/admin", response_model=AdminKPIs)
async def admin_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    return await get_admin_kpis(db)


@router.get("/sales", response_model=SalesKPIs)
async def sales_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "sales_head"))):
    return await get_sales_kpis(db)


@router.get("/finance", response_model=FinanceKPIs)
async def finance_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    return await get_finance_stats(db)


@router.get("/charts/monthly-trend")
async def monthly_trend(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await get_monthly_trend(db)


@router.get("/charts/conversion-rate")
async def conversion_rate(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await get_status_distribution(db)


@router.get("/charts/sales-funnel")
async def sales_funnel(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await get_sales_funnel(db)


@router.get("/menu-planner", response_model=MenuPlannerKPIs)
async def menu_planner_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "menu_planner"))):
    return await get_menu_planner_kpis(db, current_user.id)


@router.get("/presentation", response_model=PresentationKPIs)
async def presentation_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "presentation_exec"))):
    return await get_presentation_kpis(db, current_user.id)


@router.get("/operations", response_model=OperationsKPIs)
async def operations_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "operations_manager"))):
    return await get_operations_kpis(db)


@router.get("/kitchen", response_model=KitchenKPIs)
async def kitchen_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "kitchen"))):
    return await get_kitchen_kpis(db)


@router.get("/warehouse", response_model=WarehouseKPIs)
async def warehouse_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("admin", "warehouse"))):
    return await get_warehouse_kpis(db)
