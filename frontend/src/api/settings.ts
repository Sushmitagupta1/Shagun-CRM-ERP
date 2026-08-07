import client from './client'

export interface CompanySettings {
  id: number
  name: string
  email: string
  phone: string
  gst: string
  address: string
  logo_file_name: string | null
  logo_path: string | null
}

export interface CompanySettingsUpdate {
  name?: string
  email?: string
  phone?: string
  gst?: string
  address?: string
}

export const LOGO_URL = `${client.defaults.baseURL}/settings/company/logo`

export async function getCompanySettings() {
  const response = await client.get<CompanySettings>('/settings/company')
  return response.data
}

export async function updateCompanySettings(data: CompanySettingsUpdate) {
  const response = await client.put<CompanySettings>('/settings/company', data)
  return response.data
}

export async function uploadCompanyLogo(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post<CompanySettings>('/settings/company/logo', formData)
  return response.data
}
