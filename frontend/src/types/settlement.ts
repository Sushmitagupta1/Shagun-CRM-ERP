export type SettlementStatus = 'pending' | 'completed'

export interface Settlement {
  id: string
  inquiry_id: string
  revenue: number
  vendor_cost: number
  other_expenses: number
  net_profit: number
  status: SettlementStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface SettlementCreate {
  inquiry_id: string
  revenue: number
  vendor_cost: number
  other_expenses?: number
  notes?: string
}

export interface SettlementUpdate {
  revenue?: number
  vendor_cost?: number
  other_expenses?: number
  notes?: string
}

export interface FnFSummary {
  total_revenue: number
  total_vendor_cost: number
  total_other_expenses: number
  total_net_profit: number
  pending_count: number
  completed_count: number
}
