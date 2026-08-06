import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
  blockedRoles?: string[]
}

const ROLE_HOME: Record<string, string> = {
  admin: '/dashboard',
  sales_head: '/sales',
  menu_planner: '/menu',
  presentation_exec: '/presentations',
  operations_manager: '/operations',
  kitchen: '/kitchen',
  warehouse: '/warehouse',
}

export function getHomeForRole(role?: string): string {
  return ROLE_HOME[role ?? ''] ?? '/inquiries'
}

export default function ProtectedRoute({ children, allowedRoles, blockedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasAnyRole } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-maroon border-t-transparent" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (blockedRoles?.includes(user?.role.name ?? '')) {
    return <Navigate to={getHomeForRole(user?.role.name)} replace />
  }

  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    return <Navigate to={getHomeForRole(user?.role.name)} replace />
  }

  return <>{children}</>
}
