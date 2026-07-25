import type { LoginRequest, TokenResponse, User } from '@/types/auth'
import client from './client'

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const response = await client.post<TokenResponse>('/auth/login', credentials)
  return response.data
}

export async function getCurrentUser(): Promise<User> {
  const response = await client.get<User>('/auth/me')
  return response.data
}

export async function logout(): Promise<void> {
  await client.post('/auth/logout')
}
