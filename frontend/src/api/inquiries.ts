import client from './client'
import type { PaginatedResponse } from '@/types/common'
import type { Inquiry, InquiryCreate, FollowUp, Meeting, MenuVersion, MenuSlot } from '@/types/inquiry'
import type { InventoryMovement, InventoryMovementCreate } from '@/types/inventory'

export async function getInquiries(params: {
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
}): Promise<PaginatedResponse<Inquiry>> {
  const response = await client.get('/inquiries', { params })
  return response.data
}

export async function getInquiry(id: string): Promise<Inquiry> {
  const response = await client.get(`/inquiries/${id}`)
  return response.data
}

export async function createInquiry(data: InquiryCreate): Promise<Inquiry> {
  const response = await client.post('/inquiries', data)
  return response.data
}

export async function updateInquiry(id: string, data: Partial<InquiryCreate>): Promise<Inquiry> {
  const response = await client.put(`/inquiries/${id}`, data)
  return response.data
}

export async function updateInquiryStatus(id: string, status: string): Promise<void> {
  await client.patch(`/inquiries/${id}/status?new_status=${status}`)
}

export async function setPresentationNotRequired(id: string, notRequired: boolean): Promise<void> {
  await client.patch(`/inquiries/${id}/presentation-not-required?not_required=${notRequired}`)
}

export async function updatePayment(id: string, paymentStatus: string, advanceAmount?: number): Promise<void> {
  const params = new URLSearchParams({ payment_status: paymentStatus })
  if (advanceAmount !== undefined) params.append('advance_amount', String(advanceAmount))
  await client.patch(`/inquiries/${id}/payment?${params.toString()}`)
}

export async function approvePayment(id: string): Promise<void> {
  await client.patch(`/inquiries/${id}/approve-payment`)
}

export async function exportInquiriesExcel(params: {
  status?: string
  search?: string
  assigned_to?: string
  event_type?: string
  date_from?: string
  date_to?: string
}): Promise<void> {
  const response = await client.get('/inquiries/export/excel', { params, responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'inquiries.xlsx')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function getFollowUps(id: string): Promise<FollowUp[]> {
  const response = await client.get(`/inquiries/${id}/follow-ups`)
  return response.data
}

export async function addFollowUp(id: string, data: { follow_up_date: string; remarks?: string }): Promise<FollowUp> {
  const response = await client.post(`/inquiries/${id}/follow-ups`, data)
  return response.data
}

export async function updateFollowUpDone(id: string, followUpId: string, data: { is_done: boolean; remarks?: string }): Promise<FollowUp> {
  const response = await client.patch(`/inquiries/${id}/follow-ups/${followUpId}`, data)
  return response.data
}

export async function exportSingleInquiryExcel(id: string): Promise<void> {
  const response = await client.get(`/inquiries/${id}/export/excel`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `inquiry_${id}.xlsx`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export type InquiryFileType = 'menu' | 'presentation' | 'ingredient' | 'inventory' | 'returned' | 'transferred' | 'wastage' | 'call_recording'

export async function uploadInquiryFile(
  id: string,
  fileType: InquiryFileType,
  file: File
): Promise<{ file_name: string; file_path: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post(`/inquiries/${id}/upload?file_type=${fileType}`, formData)
  return response.data
}

export async function downloadInquiryFile(id: string, fileType: InquiryFileType, fileName?: string | null): Promise<void> {
  const response = await client.get(`/inquiries/${id}/file/${fileType}`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName || `${fileType}_${id}`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function viewInquiryFile(id: string, fileType: InquiryFileType): Promise<void> {
  const response = await client.get(`/inquiries/${id}/file/${fileType}`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  window.open(url, '_blank')
}

export async function previewInquiryFile(
  id: string,
  fileType: InquiryFileType
): Promise<{ file_name: string; rows: (string | number)[][] }> {
  const response = await client.get(`/inquiries/${id}/file/${fileType}/preview`)
  return response.data
}

export async function getMeetings(id: string): Promise<Meeting[]> {
  const response = await client.get(`/inquiries/${id}/meetings`)
  return response.data
}

export interface CalendarFollowUp {
  id: string
  inquiry_id: string
  client_name: string
  event_type: string
  follow_up_date: string
  remarks: string | null
  is_done: boolean
}

export interface CalendarMeeting {
  id: string
  inquiry_id: string
  client_name: string
  event_type: string
  meeting_at: string
  remarks: string | null
  status: string
}

export interface CalendarData {
  events: Inquiry[]
  followups: CalendarFollowUp[]
  meetings: CalendarMeeting[]
}

export async function getCalendarData(fromDate: string, toDate: string): Promise<CalendarData> {
  const response = await client.get('/inquiries/calendar', { params: { from_date: fromDate, to_date: toDate } })
  return response.data
}

export async function addMeeting(id: string, data: { meeting_at: string; remarks?: string }): Promise<Meeting> {
  const response = await client.post(`/inquiries/${id}/meetings`, data)
  return response.data
}

export async function updateMeetingStatus(id: string, meetingId: string, status: 'scheduled' | 'completed', remarks?: string): Promise<Meeting> {
  const response = await client.patch(`/inquiries/${id}/meetings/${meetingId}`, { status, remarks })
  return response.data
}

export async function getInventoryMovements(inquiryId: string): Promise<InventoryMovement[]> {
  const response = await client.get(`/inquiries/${inquiryId}/inventory-movements`)
  return response.data
}

export async function addInventoryMovement(inquiryId: string, data: InventoryMovementCreate): Promise<InventoryMovement> {
  const response = await client.post(`/inquiries/${inquiryId}/inventory-movements`, data)
  return response.data
}

export async function deleteInventoryMovement(inquiryId: string, movementId: string): Promise<void> {
  await client.delete(`/inquiries/${inquiryId}/inventory-movements/${movementId}`)
}

export async function getMenuVersions(inquiryId: string): Promise<MenuVersion[]> {
  const response = await client.get(`/inquiries/${inquiryId}/menu-versions`)
  return response.data
}

export async function createMenuVersion(
  inquiryId: string,
  data: { menu_text: string | null; designs: { id: string; name: string; pages: { html: string; index: number }[]; raw: string }[]; template_category: string | null; template_file: string | null }
): Promise<MenuVersion> {
  const response = await client.post(`/inquiries/${inquiryId}/menu-versions`, data)
  return response.data
}

export async function uploadInventoryMovementFile(
  inquiryId: string,
  movementType: 'received' | 'returned' | 'transferred' | 'wastage',
  file: File
): Promise<{ file_name: string; entries_created: number }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post(`/inquiries/${inquiryId}/inventory-upload?movement_type=${movementType}`, formData)
  return response.data
}

export async function getMenuSlots(inquiryId: string): Promise<MenuSlot[]> {
  const response = await client.get(`/inquiries/${inquiryId}/menu-slots`)
  return response.data
}

export async function createMenuSlot(inquiryId: string): Promise<MenuSlot> {
  const response = await client.post(`/inquiries/${inquiryId}/menu-slots`)
  return response.data
}

export async function uploadMenuSlotFile(inquiryId: string, slotId: string, file: File): Promise<MenuSlot> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post(`/inquiries/${inquiryId}/menu-slots/${slotId}/upload`, formData)
  return response.data
}

export async function setFinalMenuSlot(inquiryId: string, slotId: string): Promise<MenuSlot> {
  const response = await client.patch(`/inquiries/${inquiryId}/menu-slots/${slotId}/final`)
  return response.data
}

export async function deleteMenuSlot(inquiryId: string, slotId: string): Promise<void> {
  await client.delete(`/inquiries/${inquiryId}/menu-slots/${slotId}`)
}

export async function downloadMenuSlotFile(inquiryId: string, slotId: string, fileName?: string | null): Promise<void> {
  const response = await client.get(`/inquiries/${inquiryId}/menu-slots/${slotId}/download`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName || `menu_slot_${slotId}`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
