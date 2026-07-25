import { create } from 'zustand'
import type { AuthState, LoginRequest } from '@/types/auth'
import * as authApi from '@/api/auth'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials: LoginRequest) => {
    const data = await authApi.login(credentials)
    localStorage.setItem('access_token', data.access_token)
    set({ token: data.access_token })

    const user = await authApi.getCurrentUser()
    set({ user, isAuthenticated: true })
  },

  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      localStorage.removeItem('access_token')
      set({ user: null, token: null, isAuthenticated: false })
    }
  },

  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('access_token', token)
    } else {
      localStorage.removeItem('access_token')
    }
    set({ token })
  },

  initialize: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isLoading: false })
      return
    }

    try {
      const user = await authApi.getCurrentUser()
      set({ user, token, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('access_token')
      set({ token: null, user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
