export interface AdminKPIs {
  total_inquiries: number
  confirmed: number
  cancelled: number
  upcoming_events: number
  today_events: number
  pending_payments: number
  pending_menus: number
  total_revenue: number
  outstanding_amount: number
  pending_kitchen_plans: number
  pending_warehouse_requests: number
  payment_approvals: PaymentApproval[]
  pending_menus_list: PendingMenu[]
}

export interface PaymentApproval {
  id: string
  client_name: string
  event_type: string
  event_date: string | null
  status: string
  payment_status: string
  advance_amount: number
  total_amount: number | null
  remaining_payment_date: string | null
}

export interface PendingMenu {
  id: string
  client_name: string
  event_type: string
  event_date: string | null
  status: string
}

export interface SalesKPIs {
  total_inquiries: number
  new_inquiries: number
  upcoming_followups: number
  overdue_followups: number
  confirmed: number
  cancelled: number
  pending_presentations: number
  pending_menus: number
  pending_payments: number
  total_sales_value: number
  conversion_rate: number
  next_follow_up: { client_name: string; follow_up_date: string; remarks: string | null } | null
  upcoming_followups_list: TodayFollowUp[]
  meetings: MeetingInfo[]
}

export interface TodayFollowUp {
  id: string
  inquiry_id: string
  client_name: string
  event_type: string
  follow_up_date: string
  remarks: string | null
}

export interface FinanceKPIs {
  pending_settlements: number
  completed_settlements: number
  total_profit: number
  total_revenue: number
  total_vendor_cost: number
}

export interface MonthlyTrend {
  month: string
  count: number
}

export interface StatusDistribution {
  status: string
  count: number
}

export interface FunnelStage {
  stage: string
  count: number
}

export interface MenuPlannerKPIs {
  assigned_inquiries: number
  pending_menus: number
  ai_menus_generated: number
}

export interface MeetingInfo {
  id: string
  inquiry_id?: string
  client_name: string
  event_type: string
  meeting_at: string
  remarks: string | null
  status: string
  created_by_name?: string | null
}

export interface PresentationKPIs {
  new_inquiry: number
  assigned_inquiries: number
  pending_presentations: number
  client_meetings_today: number
  meetings: MeetingInfo[]
}

export interface OperationsKPIs {
  upcoming_events: number
  todays_events: number
  pending_kitchen_plans: number
  pending_vendor_requests: number
  pending_warehouse_requests: number
}

export interface KitchenKPIs {
  pending_kitchen_plans: number
  todays_production: number
}

export interface WarehouseKPIs {
  pending_requests: number
  todays_issues: number
  stock_value: number
  low_stock_items: number
}
