import client from './client'
import type { EventListItem, EventDetail, InventoryItemSave, VendorSave } from '@/types/event'

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
