import client from './client'
import type { AdminKPIs, SalesKPIs, FinanceKPIs, MonthlyTrend, StatusDistribution, FunnelStage, MenuPlannerKPIs, PresentationKPIs, OperationsKPIs, KitchenKPIs, WarehouseKPIs } from '@/types/dashboard'

export async function getAdminKPIs(): Promise<AdminKPIs> {
  const response = await client.get('/dashboard/admin')
  return response.data
}

export async function getSalesKPIs(): Promise<SalesKPIs> {
  const response = await client.get('/dashboard/sales')
  return response.data
}

export async function getFinanceKPIs(): Promise<FinanceKPIs> {
  const response = await client.get('/dashboard/finance')
  return response.data
}

export async function getMonthlyTrend(): Promise<MonthlyTrend[]> {
  const response = await client.get('/dashboard/charts/monthly-trend')
  return response.data
}

export async function getConversionRate(): Promise<StatusDistribution[]> {
  const response = await client.get('/dashboard/charts/conversion-rate')
  return response.data
}

export async function getSalesFunnel(): Promise<FunnelStage[]> {
  const response = await client.get('/dashboard/charts/sales-funnel')
  return response.data
}

export async function getMenuPlannerKPIs(): Promise<MenuPlannerKPIs> {
  const response = await client.get('/dashboard/menu-planner')
  return response.data
}

export async function getPresentationKPIs(): Promise<PresentationKPIs> {
  const response = await client.get('/dashboard/presentation')
  return response.data
}

export async function getOperationsKPIs(): Promise<OperationsKPIs> {
  const response = await client.get('/dashboard/operations')
  return response.data
}

export async function getKitchenKPIs(): Promise<KitchenKPIs> {
  const response = await client.get('/dashboard/kitchen')
  return response.data
}

export async function getWarehouseKPIs(): Promise<WarehouseKPIs> {
  const response = await client.get('/dashboard/warehouse')
  return response.data
}
