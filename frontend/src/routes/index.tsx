import { createBrowserRouter, Navigate } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AuthLayout from '@/components/layout/AuthLayout'
import ProtectedRoute, { getHomeForRole } from '@/routes/ProtectedRoute'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import UserManagement from '@/pages/admin/UserManagement'
import FinancePage from '@/pages/admin/FinancePage'
import ReportsPage from '@/pages/admin/ReportsPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import SalesDashboard from '@/pages/sales/SalesDashboard'
import MenuPlannerDashboard from '@/pages/menu/MenuPlannerDashboard'
import MenuLibrary from '@/pages/menu/MenuLibrary'
import MenuGenerator from '@/pages/menu/MenuGenerator'
import PresentationDashboard from '@/pages/presentation/PresentationDashboard'
import OperationsDashboard from '@/pages/operations/OperationsDashboard'
import EventList from '@/pages/events/EventList'
import EventView from '@/pages/events/EventView'
import KitchenDashboard from '@/pages/kitchen/KitchenDashboard'
import WarehouseDashboard from '@/pages/warehouse/WarehouseDashboard'
import InquiryList from '@/pages/inquiries/InquiryList'
import InquiryDetail from '@/pages/inquiries/InquiryDetail'
import CalendarPage from '@/pages/Calendar'
import NotificationsPage from '@/pages/Notifications'
import { useAuth } from '@/hooks/useAuth'

function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={getHomeForRole(user?.role.name)} replace />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <Login />,
      },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <RootRedirect />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inquiries',
        element: (
          <ProtectedRoute blockedRoles={['operations_manager']}>
            <InquiryList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inquiries/:id',
        element: (
          <ProtectedRoute blockedRoles={['operations_manager']}>
            <InquiryDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'calendar',
        element: <CalendarPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'sales',
        element: (
          <ProtectedRoute allowedRoles={['sales_head']}>
            <SalesDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'menu',
        element: (
          <ProtectedRoute allowedRoles={['menu_planner']}>
            <MenuPlannerDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'menu-library',
        element: (
          <ProtectedRoute allowedRoles={['menu_planner', 'admin']}>
            <MenuLibrary />
          </ProtectedRoute>
        ),
      },
      {
        path: 'menu-generator/:inquiryId',
        element: (
          <ProtectedRoute allowedRoles={['menu_planner']}>
            <MenuGenerator />
          </ProtectedRoute>
        ),
      },
      {
        path: 'presentations',
        element: (
          <ProtectedRoute allowedRoles={['presentation_exec']}>
            <PresentationDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'operations',
        element: (
          <ProtectedRoute allowedRoles={['operations_manager']}>
            <OperationsDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'events',
        element: (
          <ProtectedRoute allowedRoles={['operations_manager', 'kitchen', 'admin', 'warehouse']}>
            <EventList />
          </ProtectedRoute>
        ),
      },
      {
        path: 'events/:id',
        element: (
          <ProtectedRoute allowedRoles={['operations_manager', 'kitchen', 'admin', 'warehouse']}>
            <EventView />
          </ProtectedRoute>
        ),
      },
      {
        path: 'kitchen',
        element: (
          <ProtectedRoute allowedRoles={['kitchen']}>
            <KitchenDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'warehouse',
        element: (
          <ProtectedRoute allowedRoles={['warehouse']}>
            <WarehouseDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: 'finance',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <FinancePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
