from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.settlement import Settlement, SettlementStatus


async def calculate_net_profit(revenue: Decimal, vendor_cost: Decimal, other_expenses: Decimal) -> Decimal:
    return revenue - vendor_cost - other_expenses


async def get_finance_stats(db: AsyncSession) -> dict:
    pending = await db.execute(select(func.count(Settlement.id)).where(Settlement.status == SettlementStatus.PENDING))
    completed = await db.execute(select(func.count(Settlement.id)).where(Settlement.status == SettlementStatus.COMPLETED))
    total_profit = await db.execute(select(func.coalesce(func.sum(Settlement.net_profit), 0)).where(Settlement.status == SettlementStatus.COMPLETED))
    total_revenue = await db.execute(select(func.coalesce(func.sum(Settlement.revenue), 0)))
    total_vendor_cost = await db.execute(select(func.coalesce(func.sum(Settlement.vendor_cost), 0)))
    return {
        "pending_settlements": pending.scalar() or 0,
        "completed_settlements": completed.scalar() or 0,
        "total_profit": float(total_profit.scalar() or 0),
        "total_revenue": float(total_revenue.scalar() or 0),
        "total_vendor_cost": float(total_vendor_cost.scalar() or 0),
    }
