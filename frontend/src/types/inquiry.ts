export type InquiryStatus =
  | 'new'
  | 'follow_up'
  | 'menu_ready'
  | 'presentation_sent'
  | 'negotiation'
  | 'confirmed'
  | 'completed'
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Inquiry {
  id: string
  client_name: string
  client_phone: string
  event_type: string
  event_date: string | null
  pax: number | null
  budget: number | null
  status: InquiryStatus
  assigned_to: string | null
  created_by: string
  follow_up_date: string | null
  remarks: string | null
  advance_amount: number
  payment_status: PaymentStatus
  created_at: string
  updated_at: string
}

export interface InquiryCreate {
  client_name: string
  client_phone: string
  event_type: string
  event_date?: string
  pax?: number
  budget?: number
  assigned_to?: string
  follow_up_date?: string
  remarks?: string
}

export interface InquiryUpdate extends Partial<InquiryCreate> {}

export interface InquiryListParams {
  page?: number
  per_page?: number
  status?: InquiryStatus
  assigned_to?: string
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
