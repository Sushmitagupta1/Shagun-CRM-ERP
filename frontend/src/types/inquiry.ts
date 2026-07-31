export type InquiryStatus =
  | 'new_inquiry'
  | 'followup'
  | 'client_confirmation'
  | 'menu_sent'
  | 'advance_receive'
  | 'operation_handover'
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Inquiry {
  id: string
  client_name: string
  client_phone: string
  event_type: string
  event_date: string | null
  inquiry_date: string | null
  pax: number | null
  per_plate_rate: number | null
  add_on: number | null
  total_amount: number | null
  status: InquiryStatus
  assigned_to: string | null
  created_by: string
  remarks: string | null
  menu_uploaded: boolean
  menu_content: string | null
  menu_file_name: string | null
  presentation_file_name: string | null
  advance_amount: number
  payment_status: PaymentStatus
  method: string | null
  method_details: string | null
  advance_payment_date: string | null
  remaining_payment_date: string | null
  birthday_date: string | null
  anniversary_date: string | null
  created_at: string
  updated_at: string
}

export interface FollowUp {
  id: string
  inquiry_id: string
  follow_up_date: string
  remarks: string | null
  created_by: string
  created_at: string
}

export interface Meeting {
  id: string
  inquiry_id: string
  meeting_at: string
  remarks: string | null
  status: 'scheduled' | 'completed'
  created_by: string
  created_at: string
}

export interface InquiryCreate {
  client_name: string
  client_phone: string
  event_type: string
  event_date?: string
  inquiry_date?: string
  pax?: number
  per_plate_rate?: number
  add_on?: number
  assigned_to?: string
  follow_up_date?: string
  remarks?: string
  menu_uploaded?: boolean
  menu_content?: string
  method?: string
  method_details?: string
  advance_payment_date?: string
  remaining_payment_date?: string
  birthday_date?: string
  anniversary_date?: string
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
  event_type?: string
  date_from?: string
  date_to?: string
}
