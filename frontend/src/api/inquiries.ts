import client from './client'
import type { PaginatedResponse } from '@/types/common'
import type { Inquiry, InquiryCreate } from '@/types/inquiry'

export async function getInquiries(params: {
  page?: number
  per_page?: number
  status?: string
  search?: string
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
