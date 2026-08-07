import { useQuery } from '@tanstack/react-query'
import * as inquiriesApi from '@/api/inquiries'

export function useInquiries(params: {
  page?: number
  per_page?: number
  status?: string
  search?: string
  assigned_to?: string
  event_type?: string
  date_from?: string
  date_to?: string
  event_date_from?: string
  event_date_to?: string
  followup?: string
}) {
  return useQuery({
    queryKey: ['inquiries', params],
    queryFn: () => inquiriesApi.getInquiries(params),
  })
}
