export interface AdminKPIs {
  total_inquiries: number
  confirmed: number
  cancelled: number
  upcoming_events: number
  today_events: number
  pending_payments: number
  total_revenue: number
  outstanding_amount: number
  pending_kitchen_plans: number
  pending_warehouse_requests: number
}

export interface SalesKPIs {
  new_inquiries: number
  followups_today: number
  overdue_followups: number
  confirmed: number
  cancelled: number
  pending_presentations: number
  pending_menus: number
  pending_payments: number
  total_sales_value: number
  conversion_rate: number
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

export interface PresentationKPIs {
  assigned_inquiries: number
  pending_presentations: number
  client_meetings_today: number
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
