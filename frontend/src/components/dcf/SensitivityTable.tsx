import { mono, fmt, cellStyle, type Assumptions } from '../../lib/dcf'

export function SensitivityTable({
  growthRates,
  waccs,
  grid,
  assumptions,
  marketPrice,
  rateLabel,
}: {
  growthRates:  number[]
  waccs:        number[]
  grid:         number[][]
  assumptions:  Assumptions
  marketPrice:  number | null
  rateLabel?:   string
}) {
  const rateLabelStr = rateLabel ?? 'wacc'

  return (
    <div className="border border-[#1A2840] rounded-xl bg-[#0A1628]/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1A2840]">
        <p className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE]" style={mono}>Sensitivity Analysis</p>
        <p className="text-[11px] text-[#4A6070] mt-1 leading-relaxed" style={mono}>
          Intrinsic value · Stage 1 growth (rows) × {rateLabelStr} (cols). Your scenario is highlighted.
          {marketPrice ? ' Colour = margin of safety vs market.' : ''}
        </p>
      </div>
      <div className="px-5 py-4 overflow-x-auto">
        <table className="w-full border-collapse text-[11px]" style={mono}>
          <thead>
            <tr>
              <td className="pr-3 pb-2 text-[9px] text-[#4A6070] text-right whitespace-nowrap">
                growth ↓ · {rateLabelStr} →
              </td>
              {waccs.map(w => (
                <th
                  key={w}
                  className={`pb-2 px-2 text-center font-medium whitespace-nowrap ${
                    Math.abs(w - assumptions.discountRate) < 0.26 ? 'text-[#C9A84C]' : 'text-[#4A6070]'
                  }`}
                >
                  {w.toFixed(2)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {growthRates.map((g, gi) => (
              <tr key={g}>
                <td className={`pr-3 py-1.5 text-right font-medium whitespace-nowrap ${
                  Math.abs(g - assumptions.growthRate) < 2.6 ? 'text-[#C9A84C]' : 'text-[#4A6070]'
                }`}>
                  {g}%
                </td>
                {waccs.map((w, wi) => {
                  const val       = grid[gi][wi]
                  const isCurrent =
                    Math.abs(g - assumptions.growthRate)    < 2.6 &&
                    Math.abs(w - assumptions.discountRate)  < 0.26
                  return (
                    <td
                      key={w}
                      className={`py-1.5 px-2 text-center rounded transition-all ${
                        isCurrent ? 'ring-1 ring-[#C9A84C]/50 ring-inset' : ''
                      }`}
                      style={cellStyle(val, marketPrice)}
                    >
                      {isNaN(val) ? '—' : fmt(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {marketPrice && (
          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-[#1A2840] flex-wrap">
            <span className="text-[11px] text-[#8BA4BE]" style={mono}>vs {fmt(marketPrice)}:</span>
            {[
              { label: '>30% MoS',            bg: 'rgba(76,175,133,0.18)',  color: '#4CAF85' },
              { label: '10–30% MoS',          bg: 'rgba(76,175,133,0.08)',  color: '#7ECFAD' },
              { label: 'Fairly Valued (±10%)', bg: 'rgba(184,148,60,0.08)',  color: '#C9A84C' },
              { label: '10–30% Overvalued',    bg: 'rgba(224,82,82,0.08)',   color: '#E08070' },
              { label: '>30% Overvalued',      bg: 'rgba(224,82,82,0.16)',   color: '#E05252' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.bg, border: `1px solid ${l.color}40` }} />
                <span className="text-[11px]" style={{ ...mono, color: l.color }}>{l.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}