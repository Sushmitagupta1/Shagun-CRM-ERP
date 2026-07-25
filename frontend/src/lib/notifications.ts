import type { ComponentType } from 'react'
import {
  CheckCircle2,
  Clock,
  Wallet,
  FileText,
  Users,
  ChefHat,
  Package,
  Calendar,
  Truck,
  Presentation,
  Settings,
} from 'lucide-react'

export interface Notification {
  id: string
  type: string
  title: string
  detail: string
  time: string
  read: boolean
  icon: ComponentType<{ size?: number; className?: string }>
  color: string
  roles: string[]
}

export const allNotifications: Notification[] = [
  // Admin-only
  { id: '1', type: 'user', title: 'New user registered', detail: 'THOL account created by admin', time: '1 day ago', read: true, icon: Users, color: 'bg-blue-100 text-blue-600', roles: ['admin'] },
  { id: '2', type: 'payment', title: 'Payment received', detail: '₹50,000 advance from Tata Motors Corp', time: '15 min ago', read: false, icon: Wallet, color: 'bg-emerald-100 text-emerald-600', roles: ['admin'] },
  { id: '3', type: 'settlement', title: 'Settlement pending', detail: 'Kapoor Engagement — FnF settlement awaiting', time: '1 day ago', read: true, icon: Wallet, color: 'bg-rose-100 text-rose-600', roles: ['admin'] },
  { id: '4', type: 'setting', title: 'System settings updated', detail: 'Notification preferences changed', time: '2 days ago', read: true, icon: Settings, color: 'bg-gray-100 text-gray-600', roles: ['admin'] },

  // Sales
  { id: '10', type: 'inquiry', title: 'New inquiry received', detail: 'Mehta Family — Birthday event, 80 pax', time: '5 min ago', read: false, icon: FileText, color: 'bg-blue-100 text-blue-600', roles: ['admin', 'sales_head'] },
  { id: '11', type: 'status', title: 'Inquiry status updated', detail: 'Gupta Wedding → Confirmed by Vinod', time: '1 hr ago', read: false, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', roles: ['admin', 'sales_head'] },
  { id: '12', type: 'followup', title: 'Follow-up overdue', detail: 'Agarwal Family — follow-up was Jul 22', time: '5 hr ago', read: true, icon: Clock, color: 'bg-amber-100 text-amber-600', roles: ['admin', 'sales_head'] },
  { id: '13', type: 'followup', title: 'Follow-up today', detail: 'Sharma Wedding — call scheduled', time: '8:30 AM', read: false, icon: Clock, color: 'bg-blue-100 text-blue-600', roles: ['admin', 'sales_head'] },

  // Menu Planner
  { id: '20', type: 'menu', title: 'Menu assigned to you', detail: 'Infosys Team Dinner — finalize menu', time: '30 min ago', read: false, icon: ChefHat, color: 'bg-purple-100 text-purple-600', roles: ['admin', 'menu_planner'] },
  { id: '21', type: 'menu', title: 'Menu uploaded', detail: 'Vishal uploaded menu for Infosys Team Dinner', time: '2 hr ago', read: true, icon: ChefHat, color: 'bg-purple-100 text-purple-600', roles: ['admin', 'menu_planner'] },
  { id: '22', type: 'menu', title: 'Dietary requirements updated', detail: 'Mehta Birthday — 5 Jain guests added', time: '3 hr ago', read: true, icon: ChefHat, color: 'bg-amber-100 text-amber-600', roles: ['admin', 'menu_planner'] },

  // Presentation
  { id: '30', type: 'presentation', title: 'New presentation assigned', detail: 'Sharma Wedding — Theme Selection', time: '1 hr ago', read: false, icon: Presentation, color: 'bg-indigo-100 text-indigo-600', roles: ['admin', 'presentation_exec'] },
  { id: '31', type: 'meeting', title: 'Meeting scheduled', detail: 'Tata Corp — Final Walkthrough at 2:30 PM', time: '2 hr ago', read: true, icon: Calendar, color: 'bg-blue-100 text-blue-600', roles: ['admin', 'presentation_exec'] },
  { id: '32', type: 'theme', title: 'Theme approved', detail: 'Mehta Family approved Garden Party theme', time: '4 hr ago', read: true, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', roles: ['admin', 'presentation_exec'] },

  // Operations
  { id: '40', type: 'event', title: 'Event tomorrow', detail: 'Mehta Family Birthday — Grand Hyatt, 11:00 AM', time: '1 day ago', read: true, icon: Calendar, color: 'bg-indigo-100 text-indigo-600', roles: ['admin', 'operations_manager'] },
  { id: '41', type: 'vendor', title: 'Vendor payment due', detail: 'Fresh Produce Co — ₹25,000 by Jul 25', time: '3 hr ago', read: false, icon: Truck, color: 'bg-amber-100 text-amber-600', roles: ['admin', 'operations_manager'] },
  { id: '42', type: 'settlement', title: 'Settlement due', detail: 'Kapoor Engagement — FnF settlement in 2 days', time: '5 hr ago', read: true, icon: Wallet, color: 'bg-rose-100 text-rose-600', roles: ['admin', 'operations_manager'] },

  // Kitchen
  { id: '50', type: 'kitchen', title: 'Kitchen plan submitted', detail: 'Ingredient list ready for Mehta Birthday', time: '3 hr ago', read: true, icon: ChefHat, color: 'bg-amber-100 text-amber-600', roles: ['admin', 'kitchen'] },
  { id: '51', type: 'kitchen', title: 'Production scheduled', detail: 'Sharma Wedding — 150 pax, prep starts 6 AM', time: '4 hr ago', read: false, icon: ChefHat, color: 'bg-blue-100 text-blue-600', roles: ['admin', 'kitchen'] },
  { id: '52', type: 'kitchen', title: 'Ingredient shortage', detail: 'Saffron stock low — 2 packs remaining', time: '5 hr ago', read: true, icon: ChefHat, color: 'bg-rose-100 text-rose-600', roles: ['admin', 'kitchen'] },

  // Warehouse
  { id: '60', type: 'warehouse', title: 'Warehouse request pending', detail: 'Sharma Wedding — 12 items awaiting approval', time: '4 hr ago', read: true, icon: Package, color: 'bg-rose-100 text-rose-600', roles: ['admin', 'warehouse'] },
  { id: '61', type: 'warehouse', title: 'Low stock alert', detail: 'Disposable plates — 50 units left', time: '6 hr ago', read: false, icon: Package, color: 'bg-amber-100 text-amber-600', roles: ['admin', 'warehouse'] },
  { id: '62', type: 'warehouse', title: 'Dispatch completed', detail: 'Mehta Birthday — all items dispatched', time: '1 day ago', read: true, icon: Package, color: 'bg-emerald-100 text-emerald-600', roles: ['admin', 'warehouse'] },
]

export function getNotificationsForRole(role?: string): Notification[] {
  if (!role) return []
  return allNotifications.filter((n) => n.roles.includes(role))
}
