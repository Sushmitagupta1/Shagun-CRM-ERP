import client from './client'
import type { PaginatedResponse } from '@/types/common'
import type { Inquiry, InquiryCreate, FollowUp } from '@/types/inquiry'

export async function getInquiries(params: {
  page?: number
  per_page?: number
  status?: string
  search?: string
  assigned_to?: string
  event_type?: string
  date_from?: string
  date_to?: string
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

export async function updatePayment(id: string, paymentStatus: string, advanceAmount?: number): Promise<void> {
  const params = new URLSearchParams({ payment_status: paymentStatus })
  if (advanceAmount !== undefined) params.append('advance_amount', String(advanceAmount))
  await client.patch(`/inquiries/${id}/payment?${params.toString()}`)
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

export async function uploadInquiryFile(
  id: string,
  fileType: 'menu' | 'presentation',
  file: File
): Promise<{ file_name: string; file_path: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post(`/inquiries/${id}/upload?file_type=${fileType}`, formData)
  return response.data
}

export async function downloadInquiryFile(id: string, fileType: 'menu' | 'presentation', fileName?: string | null): Promise<void> {
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
