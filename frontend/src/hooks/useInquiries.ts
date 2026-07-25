import { useQuery } from '@tanstack/react-query'
import * as inquiriesApi from '@/api/inquiries'

export function useInquiries(params: {
  page?: number
  per_page?: number
  status?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['inquiries', params],
    queryFn: () => inquiriesApi.getInquiries(params),
  })
}
