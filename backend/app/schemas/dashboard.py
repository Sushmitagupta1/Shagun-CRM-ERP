from pydantic import BaseModel


class AdminKPIs(BaseModel):
    total_inquiries: int
    confirmed: int
    cancelled: int
    upcoming_events: int
    today_events: int
    pending_payments: int
    pending_menus: int
    total_revenue: float
    outstanding_amount: float
    pending_kitchen_plans: int
    pending_warehouse_requests: int
    payment_approvals: list["PaymentApproval"] = []
    pending_menus_list: list["PendingMenu"] = []


class PaymentApproval(BaseModel):
    id: str
    client_name: str
    event_type: str
    event_date: str | None = None
    status: str
    payment_status: str
    advance_amount: float = 0
    total_amount: float | None = None
    remaining_payment_date: str | None = None


class PendingMenu(BaseModel):
    id: str
    client_name: str
    event_type: str
    event_date: str | None = None
    status: str


class NextFollowUp(BaseModel):
    client_name: str
    follow_up_date: str
    remarks: str | None = None


class MeetingInfo(BaseModel):
    id: str
    inquiry_id: str | None = None
    client_name: str
    event_type: str
    meeting_at: str
    remarks: str | None = None
    status: str
    created_by_name: str | None = None


class TodayFollowUp(BaseModel):
    id: str
    inquiry_id: str
    client_name: str
    event_type: str
    follow_up_date: str
    remarks: str | None = None


class UpcomingFollowUp(TodayFollowUp):
    pass


class SalesKPIs(BaseModel):
    total_inquiries: int
    new_inquiries: int
    upcoming_followups: int
    overdue_followups: int
    confirmed: int
    cancelled: int
    pending_presentations: int
    pending_menus: int
    pending_payments: int
    total_sales_value: float
    conversion_rate: float
    next_follow_up: NextFollowUp | None = None
    upcoming_followups_list: list[TodayFollowUp] = []
    pending_menus_list: list[PendingMenu] = []
    meetings: list[MeetingInfo] = []


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
    new_inquiry: int
    assigned_inquiries: int
    pending_presentations: int
    client_meetings_today: int
    meetings: list[MeetingInfo] = []


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
