from pydantic import BaseModel


class AdminKPIs(BaseModel):
    total_inquiries: int
    confirmed: int
    cancelled: int
    upcoming_events: int
    today_events: int
    pending_payments: int
    total_revenue: float
    outstanding_amount: float
    pending_kitchen_plans: int
    pending_warehouse_requests: int


class SalesKPIs(BaseModel):
    new_inquiries: int
    followups_today: int
    overdue_followups: int
    confirmed: int
    cancelled: int
    pending_presentations: int
    pending_menus: int
    pending_payments: int
    total_sales_value: float
    conversion_rate: float


class FinanceKPIs(BaseModel):
    pending_settlements: int
    completed_settlements: int
    total_profit: float
    total_revenue: float
    total_vendor_cost: float


class MenuPlannerKPIs(BaseModel):
    assigned_inquiries: int
    pending_menus: int
    ai_menus_generated: int


class PresentationKPIs(BaseModel):
    assigned_inquiries: int
    pending_presentations: int
    client_meetings_today: int


class OperationsKPIs(BaseModel):
    upcoming_events: int
    todays_events: int
    pending_kitchen_plans: int
    pending_vendor_requests: int
    pending_warehouse_requests: int


class KitchenKPIs(BaseModel):
    pending_kitchen_plans: int
    todays_production: int


class WarehouseKPIs(BaseModel):
    pending_requests: int
    todays_issues: int
    stock_value: float
    low_stock_items: int
