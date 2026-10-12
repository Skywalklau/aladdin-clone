import { useState, useRef, useEffect } from 'react'
import { mono, fmtB } from '../../lib/dcf'

export function FCFHistoryChart({ history }: { history: { year: number; fcf: number }[] }) {
  if (!history?.length) return null
  const [hovered, setHovered] = useState<number | null>(null)

  const [tooltipH, setTooltipH] = useState(20)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const HALF_H = 80
  const GAP = 6

  const max = Math.max(...history.map(h => Math.abs(h.fcf)), 1)

  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipH(tooltipRef.current.offsetHeight)
    }
  }, [hovered])

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-1">
        {history.map((item, i) => {
          const isNeg = item.fcf < 0
          const barH  = Math.max((Math.abs(item.fcf) / max) * HALF_H, 2)
          const yoy   = i > 0 && history[i - 1].fcf !== 0
            ? ((item.fcf - history[i - 1].fcf) / Math.abs(history[i - 1].fcf)) * 100
            : null
          const isHov = hovered === i
          const solid = isNeg ? '#E05252' : '#4CAF85'
          const rgba  = isNeg ? 'rgba(224,82,82,' : 'rgba(76,175,133,'
          const glow  = isNeg ? 'rgba(224,82,82,0.4)' : 'rgba(76,175,133,0.35)'

          // 🧠 Smart tooltip positioning (no overflow)
          const shouldFlip = barH > HALF_H - tooltipH - GAP
          const tooltipPos = isNeg
            ? shouldFlip
              ? { bottom: GAP }
              : { top: barH + GAP }
            : shouldFlip
              ? { top: GAP }
              : { bottom: barH + GAP }

          const Tooltip = () => (
            <div
              ref={tooltipRef}
              className="absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-center pointer-events-none z-10"
              style={{
                background:  '#0A1628',
                border:      '1px solid #1A2840',
                whiteSpace:  'nowrap',
                ...tooltipPos,
              }}
            >
              <p className="text-[11px] font-medium" style={{ ...mono, color: solid }}>
                {fmtB(item.fcf)}
              </p>
              {yoy !== null && (
                <p
                  className="text-[9px] mt-0.5"
                  style={{ ...mono, color: yoy >= 0 ? '#4CAF85' : '#E05252' }}
                >
                  {yoy >= 0 ? '+' : ''}
                  {yoy.toFixed(0)}%
                </p>
              )}
            </div>
          )

          return (
            <div
              key={item.year}
              className="flex-1 flex flex-col cursor-default"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Upper half — positive bars grow upward */}
              <div className="relative flex flex-col justify-end" style={{ height: HALF_H }}>
                {!isNeg && (
                  <div
                    className="w-full rounded-t-sm transition-all duration-150"
                    style={{
                      height:    barH,
                      background: `${rgba}${isHov ? '1' : '0.65'})`,
                      boxShadow: isHov ? `0 0 8px ${glow}` : 'none',
                    }}
                  />
                )}
                {!isNeg && isHov && <Tooltip />}
              </div>

              {/* Zero line */}
              <div className="h-px flex-shrink-0" style={{ background: isHov ? '#4A6070' : '#1A2840' }} />

              {/* Lower half — negative bars hang downward */}
              <div className="relative flex flex-col justify-start" style={{ height: HALF_H }}>
                {isNeg && (
                  <div
                    className="w-full rounded-b-sm transition-all duration-150"
                    style={{
                      height:    barH,
                      background: `${rgba}${isHov ? '1' : '0.7'})`,
                      boxShadow: isHov ? `0 0 8px ${glow}` : 'none',
                    }}
                  />
                )}
                {isNeg && isHov && <Tooltip />}
              </div>

              {/* Year label */}
              <p
                className="text-[9px] text-center mt-1 truncate"
                style={{ ...mono, color: isHov ? '#8BA4BE' : '#4A6070' }}
              >
                '{String(item.year).slice(2)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}