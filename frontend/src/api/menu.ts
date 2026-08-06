import client from './client'

export interface MenuTemplate {
  id: string
  name: string
  category: string
  description: string | null
  dish_count: number
  gradient: string
  dishes: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface MenuTemplateUpdate {
  name?: string
  category?: string
  description?: string | null
  dish_count?: number
  gradient?: string
  dishes?: Record<string, unknown> | null
}

export async function getMenuTemplates(): Promise<MenuTemplate[]> {
  const response = await client.get('/menu-templates')
  return response.data
}

export async function createMenuTemplate(data: MenuTemplateUpdate): Promise<MenuTemplate> {
  const response = await client.post('/menu-templates', data)
  return response.data
}

export async function updateMenuTemplate(id: string, data: MenuTemplateUpdate): Promise<MenuTemplate> {
  const response = await client.put(`/menu-templates/${id}`, data)
  return response.data
}
