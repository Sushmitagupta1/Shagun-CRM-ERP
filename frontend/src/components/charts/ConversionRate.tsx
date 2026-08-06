import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts'
import type { StatusDistribution } from '@/types/dashboard'

const COLORS: Record<string, string> = {
  new_inquiry: '#3B82F6',
  followup: '#F59E0B',
  client_confirmation: '#8B5CF6',
  menu_sent: '#06B6D4',
  advance_receive: '#10B981',
  operation_handover: '#14B8A6',
}

const LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  followup: 'Follow Up',
  client_confirmation: 'Client Confirmation',
  menu_sent: 'Menu Sent',
  advance_receive: 'Advance Receive',
  operation_handover: 'Operation Handover',
}

interface ConversionRateProps {
  data: StatusDistribution[]
}

export function ConversionRate({ data }: ConversionRateProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="flex items-center">
      <ResponsiveContainer width="60%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="count"
            nameKey="status"
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={COLORS[entry.status] || '#9CA3AF'} />
            ))}
          </Pie>
          <Legend
            formatter={(value: string) => LABELS[value] || value}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pl-4 text-center">
        <p className="text-2xl font-bold text-gray-900">{total}</p>
        <p className="text-xs text-gray-500">Total Inquiries</p>
      </div>
    </div>
  )
}
