import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as eventsApi from '@/api/events'
import type { InventoryItemSave, VendorSave } from '@/types/event'

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: eventsApi.getEvents,
  })
}

export function useEventDetail(id?: string) {
  return useQuery({
    queryKey: ['event-detail', id],
    queryFn: () => eventsApi.getEventDetail(id!),
    enabled: Boolean(id),
  })
}

export function useSaveInventoryItems(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: InventoryItemSave[]) => eventsApi.saveInventoryItems(id, rows),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useSaveVendors(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: VendorSave[]) => eventsApi.saveVendors(id, rows),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useCompleteEvent(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.completeEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
