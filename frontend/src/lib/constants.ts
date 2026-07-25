export const INQUIRY_STATUSES = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800' },
  follow_up: { label: 'Follow Up', color: 'bg-amber-100 text-amber-800' },
  menu_ready: { label: 'Menu Ready', color: 'bg-purple-100 text-purple-800' },
  presentation_sent: { label: 'Presentation Sent', color: 'bg-indigo-100 text-indigo-800' },
  negotiation: { label: 'Negotiation', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-800' },
} as const

export const PAYMENT_STATUSES = {
  unpaid: { label: 'Unpaid', color: 'bg-rose-100 text-rose-800' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-800' },
} as const

export const SETTLEMENT_STATUSES = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
} as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  sales_head: 'Sales Head',
  menu_planner: 'Menu Planner',
  presentation_exec: 'Presentation Executive',
  operations_manager: 'Operations Manager',
  kitchen: 'Kitchen',
  warehouse: 'Warehouse',
  finance: 'Finance',
}

export const EVENT_TYPES = [
  'Wedding',
  'Birthday',
  'Corporate',
  'Anniversary',
  'Engagement',
  'Festival',
  'Other',
]
