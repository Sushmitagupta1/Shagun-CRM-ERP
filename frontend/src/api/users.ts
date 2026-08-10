import client from './client'
import type { PaginatedResponse } from '@/types/common'
import type { User, Role } from '@/types/auth'

export async function getUsers(params: {
  page?: number
  per_page?: number
  role?: string
  search?: string
}): Promise<PaginatedResponse<User>> {
  const response = await client.get('/users', { params })
  return response.data
}

export async function getRoles(): Promise<Role[]> {
  const response = await client.get('/users/roles')
  return response.data
}

export async function createUser(data: {
  username: string
  email?: string
  password: string
  full_name: string
  role_id: string
}): Promise<User> {
  const response = await client.post('/users', data)
  return response.data
}

export async function updateUser(id: string, data: Partial<{
  username: string
  email?: string
  full_name: string
  role_id: string
  is_active: boolean
}>): Promise<User> {
  const response = await client.put(`/users/${id}`, data)
  return response.data
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`)
}
