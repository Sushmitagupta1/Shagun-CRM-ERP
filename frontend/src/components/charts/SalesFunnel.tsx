import type { FunnelStage } from '@/types/dashboard'

const STAGE_COLORS = [
  '#5A0016',
  '#7A1030',
  '#D97706',
  '#CCA052',
  '#10B981',
]

interface SalesFunnelProps {
  data: FunnelStage[]
}

export function SalesFunnel({ data }: SalesFunnelProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="space-y-2">
      {data.map((stage, index) => {
        const widthPercent = (stage.count / maxCount) * 100
        return (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className="w-28 text-right">
              <p className="text-xs font-medium text-gray-600">{stage.stage}</p>
            </div>
            <div className="relative flex-1">
              <div
                className="flex h-8 items-center justify-end rounded-md pr-3 transition-all"
                style={{
                  width: `${Math.max(widthPercent, 8)}%`,
                  backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length],
                }}
              >
                <span className="text-xs font-bold text-white">{stage.count}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
