import client from './client'
import type { PaginatedResponse } from '@/types/common'
import type { Settlement, SettlementCreate } from '@/types/settlement'

export async function getSettlements(params: {
  page?: number
  per_page?: number
  status?: string
}): Promise<PaginatedResponse<Settlement>> {
  const response = await client.get('/settlements', { params })
  return response.data
}

export async function getSettlement(id: string): Promise<Settlement> {
  const response = await client.get(`/settlements/${id}`)
  return response.data
}

export async function getSettlementByEvent(inquiryId: string): Promise<Settlement> {
  const response = await client.get(`/settlements/event/${inquiryId}`)
  return response.data
}

export async function createSettlement(data: SettlementCreate): Promise<Settlement> {
  const response = await client.post('/settlements', data)
  return response.data
}

export async function updateSettlement(id: string, data: Partial<SettlementCreate>): Promise<Settlement> {
  const response = await client.put(`/settlements/${id}`, data)
  return response.data
}

export async function completeSettlement(id: string): Promise<void> {
  await client.patch(`/settlements/${id}/status`)
}

export async function exportSettlements(): Promise<void> {
  const response = await client.get('/settlements/export/excel', {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'settlements.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
}
