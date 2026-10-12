import { useState } from 'react'
import type { HistPoint } from '../../types/index'
import { mono } from '../../lib/trading'

interface BarChartProps {
  data:           HistPoint[]
  color:          string
  selectedPeriod: string | null
  onSelect:       (p: HistPoint) => void
  format:         (v: number) => string
  negColor?:      string
}

function BarChart({ data, color, selectedPeriod, onSelect, format, negColor = '#E05252' }: BarChartProps) {
  const [hov, setHov] = useState<number | null>(null)

  if (!data.length) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-[10px] text-[#2E4460]" style={mono}>No data available</p>
    </div>
  )

  const vals   = data.map(d => d.value)
  const maxVal = Math.max(...vals, 0)
  const minVal = Math.min(...vals, 0)
  const range  = (maxVal - minVal) || 0.001
  const hasNeg = minVal < 0

  const W       = 600
  const H       = 110
  const TOP_PAD = 6
  const chartH  = H - TOP_PAD
  const zeroY   = TOP_PAD + chartH * (maxVal / range)

  const n     = data.length
  const slotW = W / n
  const barW  = Math.max(slotW * 0.65, 2)
  const barX  = (i: number) => i * slotW + (slotW - barW) / 2

  const showLabel = (i: number) =>
    n <= 12 || i === 0 || i === n - 1 || i % Math.ceil(n / 8) === 0

  return (
    <div className="relative w-full h-full flex flex-col" onMouseLeave={() => setHov(null)}>
      {/* Chart SVG */}
      <div className="relative flex-1 min-h-0">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" overflow="visible">
          {hasNeg && (
            <line x1={0} x2={W} y1={zeroY} y2={zeroY}
              stroke="#4A6070" strokeWidth="0.8" strokeDasharray="4,3" />
          )}
          {data.map((point, i) => {
            const isSelected = point.period === selectedPeriod
            const isHov      = hov === i
            const isPos      = point.value >= 0
            const barColor   = isPos ? color : negColor
            const opacity    = isSelected || isHov ? 1 : 0.55
            const barH       = Math.max((Math.abs(point.value) / range) * chartH, 1.5)
            const x          = barX(i)
            const y          = isPos ? zeroY - barH : zeroY
            return (
              <g key={point.period}>
                <rect x={x} y={y} width={barW} height={barH}
                  fill={barColor} opacity={opacity} rx="1.5" />
                {isSelected && (
                  <rect x={x} y={y} width={barW} height={barH}
                    fill="none" stroke={barColor} strokeWidth="1" rx="1.5" opacity="0.7" />
                )}
                <rect
                  x={x - (slotW - barW) / 2} y={0} width={slotW} height={H}
                  fill="transparent" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHov(i)}
                  onClick={e => { e.stopPropagation(); onSelect(point) }}
                />
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hov !== null && data[hov] && (() => {
          const point    = data[hov]
          const prev     = hov > 0 ? vals[hov - 1] : null
          const yoy      = prev != null && prev !== 0 ? ((point.value - prev) / Math.abs(prev)) * 100 : null
          const barColor = point.value >= 0 ? color : negColor
          const leftPct  = ((barX(hov) + barW / 2) / W) * 100
          return (
            <div
              className="absolute pointer-events-none z-40 whitespace-nowrap"
              style={{ left: `${leftPct}%`, top: '8%', transform: 'translateX(-50%)' }}
            >
              <div className="rounded-lg px-2.5 py-2 text-center shadow-2xl"
                style={{ background: '#04091A', border: `1px solid ${barColor}40` }}>
                <p className="text-[12px] font-semibold" style={{ ...mono, color: barColor }}>
                  {format(point.value)}
                </p>
                {yoy !== null && (
                  <p className="text-[9px] mt-0.5"
                    style={{ ...mono, color: yoy >= 0 ? '#4CAF85' : '#E05252' }}>
                    {yoy >= 0 ? '▲' : '▼'} {Math.abs(yoy).toFixed(1)}% YoY
                  </p>
                )}
                <p className="text-[8px] text-[#4A6070] mt-0.5" style={mono}>{point.period}</p>
              </div>
            </div>
          )
        })()}
      </div>

      {/* X-axis labels */}
      <div className="flex w-full flex-shrink-0" style={{ height: 16 }}>
        {data.map((point, i) => (
          <div key={point.period} className="flex-1 flex items-center justify-center">
            {showLabel(i) && (
              <span className="text-[9px] leading-none"
                style={{ ...mono, color: hov === i ? color : '#7A96B4' }}>
                {point.period.replace(' 20', "'")}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default BarChart