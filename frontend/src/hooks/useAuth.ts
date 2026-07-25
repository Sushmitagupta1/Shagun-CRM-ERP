import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const store = useAuthStore()

  useEffect(() => {
    if (store.isLoading) {
      store.initialize()
    }
  }, [store.isLoading])

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    login: store.login,
    logout: store.logout,
    hasRole: (role: string) => store.user?.role.name === role,
    hasAnyRole: (roles: string[]) => roles.includes(store.user?.role.name ?? ''),
  }
}
