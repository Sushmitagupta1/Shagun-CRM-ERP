import { useQuery } from '@tanstack/react-query'
import * as dashboardApi from '@/api/dashboard'

export function useAdminKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: dashboardApi.getAdminKPIs,
  })
}

export function useSalesKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'sales'],
    queryFn: dashboardApi.getSalesKPIs,
  })
}

export function useFinanceKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'finance'],
    queryFn: dashboardApi.getFinanceKPIs,
  })
}

export function useMonthlyTrend() {
  return useQuery({
    queryKey: ['dashboard', 'monthly-trend'],
    queryFn: dashboardApi.getMonthlyTrend,
  })
}

export function useConversionRate() {
  return useQuery({
    queryKey: ['dashboard', 'conversion-rate'],
    queryFn: dashboardApi.getConversionRate,
  })
}

export function useSalesFunnel() {
  return useQuery({
    queryKey: ['dashboard', 'sales-funnel'],
    queryFn: dashboardApi.getSalesFunnel,
  })
}

export function useMenuPlannerKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'menu-planner'],
    queryFn: dashboardApi.getMenuPlannerKPIs,
  })
}

export function usePresentationKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'presentation'],
    queryFn: dashboardApi.getPresentationKPIs,
  })
}

export function useOperationsKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'operations'],
    queryFn: dashboardApi.getOperationsKPIs,
  })
}

export function useKitchenKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'kitchen'],
    queryFn: dashboardApi.getKitchenKPIs,
  })
}

export function useWarehouseKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'warehouse'],
    queryFn: dashboardApi.getWarehouseKPIs,
  })
}
