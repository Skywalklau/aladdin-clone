import { mono, fmtB, type Assumptions } from '../../lib/dcf'

export function PVWaterfall({
  pvs,
  terminalPV,
  assumptions,
  hasNegFCF,
}: {
  pvs:         number[]
  terminalPV:  number
  assumptions: Assumptions
  hasNegFCF:   boolean
}) {
  const maxPV    = Math.max(...pvs.map(Math.abs), Math.abs(terminalPV), 1)
  const fcfLabel = assumptions.mode === 'FCFE' ? 'FCFE' : 'FCF'

  return (
    <div className="border border-[#1A2840] rounded-xl bg-[#0A1628]/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1A2840]">
        <p className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE]" style={mono}>
          Present Value Breakdown
        </p>
        <p className="text-[10px] text-[#4A6070] mt-1 leading-relaxed" style={mono}>
          Each bar = one year of {fcfLabel} discounted to today.
          {hasNegFCF && <span className="text-[#E07B52]"> Negative {fcfLabel} detected — raise Base {fcfLabel}.</span>}
        </p>
      </div>

      <div className="px-5 py-4 space-y-2">
        {pvs.map((pv, i) => {
          const isNeg        = pv < 0
          const isStage2     = (i + 1) > Math.round(assumptions.growthRateYears)
          const isTransition = i > 0 && i === Math.round(assumptions.growthRateYears)
          const barPct       = (Math.abs(pv) / maxPV) * 100
          const barColor     = isNeg ? '#E05252' : isStage2 ? '#8BA4BE' : '#C9A84C'

          return (
            <div key={i}>
              {isTransition && (
                <div className="flex items-center gap-2 my-2.5">
                  <div className="flex-1 border-t border-dashed border-[#1A2840]" />
                  <span className="text-[9px] text-[#4A6070] px-1" style={mono}>stage 2</span>
                  <div className="flex-1 border-t border-dashed border-[#1A2840]" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] w-6 flex-shrink-0 ${isStage2 ? 'text-[#4A6070]' : 'text-[#8BA4BE]'}`}
                  style={mono}
                >
                  Y{i + 1}
                </span>
                <div className="flex-1 h-[5px] bg-[#020810] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct}%`, background: barColor, opacity: isStage2 ? 0.45 : 0.80 }}
                  />
                </div>
                <span
                  className={`text-[11px] w-14 text-right flex-shrink-0 ${
                    isNeg ? 'text-[#E05252]' : isStage2 ? 'text-[#4A6070]' : 'text-[#8BA4BE]'
                  }`}
                  style={mono}
                >
                  {fmtB(pv)}
                </span>
              </div>
            </div>
          )
        })}

        {/* Terminal value bar */}
        <div className="flex items-center gap-3 pt-3 mt-1.5 border-t border-[#1A2840]">
          <span className="text-[10px] text-[#C9A84C] w-6 flex-shrink-0" style={mono}>TV</span>
          <div className="flex-1 h-[5px] bg-[#020810] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(Math.abs(terminalPV) / maxPV) * 100}%`, background: '#C9A84C' }}
            />
          </div>
          <span className="text-[11px] text-[#C9A84C] w-14 text-right flex-shrink-0" style={mono}>
            {fmtB(terminalPV)}
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 pt-3 border-t border-[#1A2840]">
          {[
            { color: '#C9A84C', label: 'Stage 1',  opacity: 0.8  },
            { color: '#8BA4BE', label: 'Stage 2',  opacity: 0.45 },
            { color: '#C9A84C', label: 'Terminal', opacity: 0.8  },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ background: l.color, opacity: l.opacity }} />
              <span className="text-[9px] text-[#4A6070]" style={mono}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}