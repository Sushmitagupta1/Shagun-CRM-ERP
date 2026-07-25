import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatusPillProps {
  label: string
  color: string
  className?: string
}

export default function StatusPill({ label, color, className }: StatusPillProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        color,
        className
      )}
    >
      {label}
    </motion.span>
  )
}
