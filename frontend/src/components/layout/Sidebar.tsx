import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  Calendar,
  Bell,
  Settings,
  BarChart3,
  Package,
  ChefHat,
  ClipboardList,
  Presentation,
  Truck,
  BookOpen,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSidebarStore } from '@/store/sidebarStore'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  roles?: string[]
  excludeRoles?: string[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { to: '/sales', label: 'My Pipeline', icon: ClipboardList, roles: ['sales_head'] },
  { to: '/menu', label: 'Menu Planning', icon: ChefHat, roles: ['menu_planner'] },
  { to: '/menu-library', label: 'Menu Library', icon: BookOpen, roles: ['menu_planner', 'admin'] },
  { to: '/presentations', label: 'Presentations', icon: Presentation, roles: ['presentation_exec'] },
  { to: '/operations', label: 'Operations', icon: Truck, roles: ['operations_manager'] },
  { to: '/kitchen', label: 'Kitchen', icon: ChefHat, roles: ['kitchen'] },
  { to: '/warehouse', label: 'Warehouse (THOL)', icon: Package, roles: ['warehouse'] },
  { to: '/users', label: 'User Management', icon: Users, roles: ['admin'] },
  { to: '/finance', label: 'Finance & Settlements', icon: Wallet, roles: ['admin'] },
  { to: '/inquiries', label: 'Inquiries', icon: FileText, excludeRoles: ['operations_manager'] },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
]

const sidebarContent = (
  <>
    {/* Logo */}
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex h-52 items-center justify-center bg-[#F5E7CC] px-5 shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
    >
      <img src="/sidebar-logo.png" alt="Shagun" className="h-auto max-h-[168px] w-auto max-w-[200px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />    </motion.div>

    {/* Nav Items */}
    <nav className="mt-4 flex-1 space-y-1 px-3 overflow-y-auto">
      <NavItems />
    </nav>

    {/* Footer */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="border-t border-white/10 p-4"
    >
      <p className="text-[10px] uppercase tracking-wider text-white/30">
        Shagun ERP v1.0
      </p>
    </motion.div>
  </>
)

function NavItems() {
  const { user } = useAuth()
  const { close } = useSidebarStore()
  const location = useLocation()

  const filteredItems = navItems.filter(
    (item) =>
      (!item.roles || item.roles.includes(user?.role.name ?? '')) &&
      !item.excludeRoles?.includes(user?.role.name ?? '')
  )

  // Close sidebar on route change (mobile).
  // Skip the first run so the drawer doesn't immediately close when it mounts.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    close()
  }, [location.pathname, close])

  return (
    <>
      {filteredItems.map((item, index) => (
        <motion.div
          key={item.to}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 + index * 0.04 }}
        >
          <NavLink
            to={item.to}
            onClick={close}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gold/15 text-gold shadow-sm shadow-gold/10'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={18}
                  className={cn(
                    'shrink-0 transition-all duration-200',
                    isActive
                      ? 'text-gold drop-shadow-sm'
                      : 'text-white/40 group-hover:text-white/70 group-hover:scale-110'
                  )}
                />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-gold shadow-sm shadow-gold/50"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        </motion.div>
      ))}
    </>
  )
}

export default function Sidebar() {
  const { isOpen, close } = useSidebarStore()

  return (
    <>
      {/* Desktop Sidebar — always visible */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col bg-gradient-to-b from-maroon to-maroon-dark lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar — slide-in overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={close}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 flex h-screen w-60 flex-col bg-gradient-to-b from-maroon to-maroon-dark shadow-2xl lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
