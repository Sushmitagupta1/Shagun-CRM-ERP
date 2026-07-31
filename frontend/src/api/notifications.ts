import client from './client'
import type { PaginatedResponse } from '@/types/common'

export interface AppNotification {
  id: string
  title: string
  message: string
  type: string
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
}

export async function getNotifications(params: {
  page?: number
  per_page?: number
  unread_only?: boolean
} = {}): Promise<PaginatedResponse<AppNotification>> {
  const response = await client.get('/notifications', { params })
  return response.data
}

export async function markNotificationRead(id: string): Promise<void> {
  await client.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await client.patch('/notifications/read-all')
}
