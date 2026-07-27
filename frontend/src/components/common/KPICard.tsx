import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface KPICardProps {
  label: string
  value: string | number
  trend?: {
    value: number
    isPositive: boolean
  }
  onClick?: () => void
  className?: string
  index?: number
}

export default function KPICard({ label, value, trend, onClick, className, index = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{
        y: -2,
        boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.1)',
        transition: { duration: 0.2 },
      }}
      onClick={onClick}
      className={cn(
        'flex h-[105px] flex-col justify-between rounded-xl bg-white p-4 shadow-md transition-all duration-200 hover:border-gold/20 hover:shadow-lg',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <motion.p
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: index * 0.06 + 0.2, type: 'spring', stiffness: 200 }}
        className="text-2xl font-bold text-slate-900"
      >
        {value}
      </motion.p>
      {trend && (
        <p
          className={cn(
            'text-xs font-medium',
            trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
          )}
        >
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </p>
      )}
    </motion.div>
  )
}
