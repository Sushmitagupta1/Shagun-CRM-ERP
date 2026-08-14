import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as eventsApi from '@/api/events'
import type { InventoryItemSave, InventoryItemPatch, VendorSave } from '@/types/event'

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

export function useWarehouseRequests(id: string) {
  return useQuery({
    queryKey: ['warehouse-requests', id],
    queryFn: () => eventsApi.getWarehouseRequests(id),
  })
}

export function useCreateWarehouseRequests(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { from_ingredient: boolean; items?: { item_name: string; quantity: number; unit?: string | null }[] }) =>
      eventsApi.createWarehouseRequests(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-requests', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operations'] })
    },
  })
}

export function useIssueWarehouseRequest(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => eventsApi.issueWarehouseRequest(id, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-requests', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operations'] })
    },
  })
}

export function useReceiveWarehouseRequest(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => eventsApi.receiveWarehouseRequest(id, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-requests', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'operations'] })
    },
  })
}

export function useUploadEventPhoto(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ category, file }: { category: string; file: File }) => eventsApi.uploadEventPhoto(id, category, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-detail', id] }),
  })
}

export function useCreateTransfer(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { item_name: string; quantity: number; unit?: string | null; to_inquiry_id: string }) =>
      eventsApi.createTransfer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['transfers', id] })
    },
  })
}

export function useTransfers(id: string) {
  return useQuery({
    queryKey: ['transfers', id],
    queryFn: () => eventsApi.getTransfers(id),
  })
}

export function usePatchInventoryItem(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InventoryItemPatch) => eventsApi.patchInventoryItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['event-audit', id] })
    },
  })
}

export function useReceiveAllInventory(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.receiveAllInventory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['event-audit', id] })
    },
  })
}

export function useReturnAllInventory(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => eventsApi.returnAllInventory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['event-audit', id] })
    },
  })
}

export function useEventAudit(id: string) {
  return useQuery({
    queryKey: ['event-audit', id],
    queryFn: () => eventsApi.getEventAudit(id),
    enabled: Boolean(id),
  })
}
