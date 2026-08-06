import client from './client'

export interface TemplateCategory {
  name: string
  files: string[]
  count: number
}

export async function getTemplateCategories(): Promise<TemplateCategory[]> {
  const res = await client.get('/templates')
  return res.data
}

export function getTemplateUrl(category: string, file: string): string {
  return `/api/templates/static/${category}/${encodeURIComponent(file)}?t=${Date.now()}`
}
