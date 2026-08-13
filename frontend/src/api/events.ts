import client from './client'
import type { EventListItem, EventDetail, InventoryItemSave, VendorSave, WarehouseRequestRow, TransferRow } from '@/types/event'

export async function getEvents(): Promise<EventListItem[]> {
  const response = await client.get('/events')
  return response.data
}

export async function getEventDetail(id: string): Promise<EventDetail> {
  const response = await client.get(`/events/${id}`)
  return response.data
}

export async function saveInventoryItems(id: string, rows: InventoryItemSave[]): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/inventory-items`, { rows })
  return response.data
}

export async function saveVendors(id: string, rows: VendorSave[]): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/vendors`, { rows })
  return response.data
}

export async function completeEvent(id: string): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/complete`)
  return response.data
}

export async function downloadUploadVersion(id: string, versionId: string, fileName?: string | null): Promise<void> {
  const response = await client.get(`/events/${id}/uploads/${versionId}/download`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName || `version_${versionId}`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function createWarehouseRequests(
  id: string,
  payload: { from_ingredient: boolean; items?: { item_name: string; quantity: number; unit?: string | null }[] },
): Promise<{ ok: boolean; created: number }> {
  const response = await client.post(`/events/${id}/warehouse-requests`, payload)
  return response.data
}

export async function issueWarehouseRequest(id: string, requestId: string): Promise<{ ok: boolean; status: string }> {
  const response = await client.patch(`/events/${id}/warehouse-requests/${requestId}/issue`)
  return response.data
}

export async function receiveWarehouseRequest(id: string, requestId: string): Promise<{ ok: boolean; status: string }> {
  const response = await client.patch(`/events/${id}/warehouse-requests/${requestId}/receive`)
  return response.data
}

export async function getWarehouseRequests(id: string): Promise<WarehouseRequestRow[]> {
  const response = await client.get(`/events/${id}/warehouse-requests`)
  return response.data
}

export async function uploadEventPhoto(id: string, category: string, file: File): Promise<{ id: string; file_name: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('category', category)
  const response = await client.post(`/events/${id}/photos`, formData)
  return response.data
}

export async function getEventPhotoBlob(id: string, photoId: string): Promise<Blob> {
  const response = await client.get(`/events/${id}/photos/${photoId}/download`, { responseType: 'blob' })
  return response.data
}

export async function createTransfer(
  id: string,
  payload: { item_name: string; quantity: number; unit?: string | null; to_inquiry_id: string },
): Promise<{ ok: boolean }> {
  const response = await client.post(`/events/${id}/transfers`, payload)
  return response.data
}

export async function getTransfers(id: string): Promise<TransferRow[]> {
  const response = await client.get(`/events/${id}/transfers`)
  return response.data
}

export async function downloadEventPhoto(id: string, photoId: string, fileName?: string | null): Promise<void> {
  const response = await client.get(`/events/${id}/photos/${photoId}/download`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName || `photo_${photoId}`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
