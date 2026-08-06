export const INQUIRY_STATUSES = {
  new_inquiry: { label: 'New Inquiry', color: 'bg-blue-100 text-blue-800' },
  followup: { label: 'Follow-up', color: 'bg-amber-100 text-amber-800' },
  menu_sent: { label: 'Menu Sent', color: 'bg-indigo-100 text-indigo-800' },
  client_confirmation: { label: 'Client Confirmation', color: 'bg-purple-100 text-purple-800' },
  advance_receive: { label: 'Advance Received', color: 'bg-emerald-100 text-emerald-800' },
  operation_handover: { label: 'Operation Handover', color: 'bg-teal-100 text-teal-800' },
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
  sales_head: 'Catering Sales Manager',
  menu_planner: 'Data Entry Operator',
  presentation_exec: 'Event Manager',
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
