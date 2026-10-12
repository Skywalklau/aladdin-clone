import { useState } from 'react'
import type { BalRow } from '../../types/index'
import { mono } from '../../lib/trading'
import { fmtB } from '../../lib/formatters'

interface StackedBarChartProps {
  data:      BalRow[]
  onSelect?: (d: BalRow) => void
}

function StackedBarChart({ data, onSelect }: StackedBarChartProps) {
  const [hov, setHov] = useState<number | null>(null)

  if (!data?.length) return null

  const W       = 600
  const H       = 110
  const TOP_PAD = 6
  const chartH  = H - TOP_PAD
  const maxV    = Math.max(...data.map(d => Math.max(d.cash || 0, d.total_debt || 0)), 0.001)
  const n       = data.length
  const slotW   = W / n
  const barW    = Math.max(slotW * 0.3, 2)

  const showLabel = (i: number) =>
    n <= 12 || i === 0 || i === n - 1 || i % Math.ceil(n / 8) === 0

  return (
    <div className="relative w-full h-full flex flex-col" onMouseLeave={() => setHov(null)}>
      <div className="relative flex-1 min-h-0">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" overflow="visible">
          {data.map((d, i) => {
            const isHov    = hov === i
            const cashH    = Math.max(((d.cash || 0) / maxV) * chartH, 1)
            const debtH    = Math.max(((d.total_debt || 0) / maxV) * chartH, 1)
            const leaseH   = (d.capital_lease ?? 0) > 0
              ? Math.max((d.capital_lease! / maxV) * chartH, 1)
              : 0
            const baseY      = TOP_PAD + chartH
            const op         = isHov ? 1 : 0.6
            const totalBars  = 2 + (leaseH > 0 ? 1 : 0)
            const groupW     = barW * totalBars + 1 * (totalBars - 1)
            const groupX     = i * slotW + (slotW - groupW) / 2

            return (
              <g key={d.period}>
                <rect x={groupX}                   y={baseY - cashH}  width={barW} height={cashH}  fill="#4CAF85" opacity={op} rx="1" />
                {(d.total_debt || 0) > 0 && (
                  <rect x={groupX + barW + 1}       y={baseY - debtH}  width={barW} height={debtH}  fill="#E05252" opacity={op} rx="1" />
                )}
                {leaseH > 0 && (
                  <rect x={groupX + (barW + 1) * 2} y={baseY - leaseH} width={barW} height={leaseH} fill="#C9A84C" opacity={op} rx="1" />
                )}
                <rect
                  x={i * slotW} y={0} width={slotW} height={H}
                  fill="transparent" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHov(i)}
                  onClick={e => { e.stopPropagation(); onSelect?.(d) }}
                />
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hov !== null && data[hov] && (() => {
          const d       = data[hov]
          const leftPct = ((hov * slotW + slotW / 2) / W) * 100
          return (
            <div
              className="absolute pointer-events-none z-40 whitespace-nowrap"
              style={{ left: `${leftPct}%`, top: '10%', transform: 'translateX(-50%)' }}
            >
              <div className="rounded-lg px-2.5 py-2"
                style={{ background: '#04091A', border: '1px solid #1A2840' }}>
                <p className="text-[8px] text-[#4A6070] mb-1 text-center" style={mono}>{d.period}</p>
                {d.cash      != null && <p className="text-[10px]" style={{ ...mono, color: '#4CAF85' }}>Cash:  {fmtB(d.cash / 1e9)}</p>}
                {d.total_debt != null && <p className="text-[10px]" style={{ ...mono, color: '#E05252' }}>Debt:  {fmtB(d.total_debt / 1e9)}</p>}
                {d.capital_lease != null && d.capital_lease > 0 && (
                  <p className="text-[10px]" style={{ ...mono, color: '#C9A84C' }}>
                    Lease: {fmtB(d.capital_lease / 1e9)}
                  </p>
                )}
                {d.net_cash != null && (
                  <p className="text-[10px] mt-1 pt-1 border-t border-[#1A2840]"
                    style={{ ...mono, color: d.net_cash >= 0 ? '#4CAF85' : '#E05252' }}>
                    Net:   {fmtB(d.net_cash / 1e9)}
                  </p>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* X-axis labels */}
      <div className="flex w-full flex-shrink-0" style={{ height: 16 }}>
        {data.map((d, i) => (
          <div key={d.period} className="flex-1 flex items-center justify-center">
            {showLabel(i) && (
              <span className="text-[9px] leading-none" style={{ ...mono, color: '#7A96B4' }}>
                {d.period.replace(' 20', "'")}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default StackedBarChart