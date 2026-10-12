import type { ReactNode } from 'react'
import { mono, serif } from '../../lib/trading'

interface ChartCardProps {
  title:        string
  subtitle?:    string
  color:        string
  latest:       string
  badge?:       string | null
  badgeUp?:     boolean
  isActive?:    boolean
  onExpand?:    () => void
  children:     ReactNode
  chartHeight?: number
}

function ChartCard({
  title, subtitle, color, latest, badge, badgeUp,
  isActive, onExpand, children, chartHeight = 110,
}: ChartCardProps) {
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col transition-all duration-200"
      onClick={onExpand}
      style={{
        background:  isActive ? `${color}08` : 'rgba(10,20,38,0.6)',
        border:      `1px solid ${isActive ? `${color}40` : '#243350'}`,
        boxShadow:   isActive ? `0 0 24px ${color}15` : 'none',
        cursor:      onExpand ? 'pointer' : 'default',
      }}
      onMouseEnter={e => { if (onExpand) (e.currentTarget as HTMLDivElement).style.border = `1px solid ${color}50` }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.border = `1px solid ${isActive ? `${color}40` : '#243350'}` }}
    >
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}20)` }} />
      <div className="px-4 pt-3 pb-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tracking-[0.14em] uppercase mb-0.5 font-medium"
              style={{ ...mono, color: '#7A96B4' }}>
              {title}
            </p>
            {subtitle && (
              <p className="text-[9px] mb-0.5" style={{ ...mono, color: '#4A6070' }}>{subtitle}</p>
            )}
            <p className="text-[22px] font-semibold leading-tight mt-0.5"
              style={{ ...serif, color: '#F0EBE0' }}>
              {latest}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 ml-2 flex-shrink-0">
            {badge != null && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{
                ...mono,
                color:      badgeUp ? '#5DD6A0' : '#F06B6B',
                background: badgeUp ? 'rgba(76,175,133,0.15)' : 'rgba(224,82,82,0.15)',
              }}>
                {badgeUp ? '▲' : '▼'} {badge}
              </span>
            )}
          </div>
        </div>
        <div style={{ height: chartHeight }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default ChartCard