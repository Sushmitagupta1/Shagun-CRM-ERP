import { useQuery } from '@tanstack/react-query'
import * as settlementsApi from '@/api/settlements'

export function useSettlements(params: {
  page?: number
  per_page?: number
  status?: string
  date_from?: string
  date_to?: string
}) {
  return useQuery({
    queryKey: ['settlements', params],
    queryFn: () => settlementsApi.getSettlements(params),
  })
}
