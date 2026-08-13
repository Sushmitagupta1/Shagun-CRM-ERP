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
