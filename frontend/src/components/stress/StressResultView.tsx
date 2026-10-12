import { useState } from 'react'
import type { StressResult, StressPosition } from '../../types'
import { mono, serif, sans, fmt$, fmt$d, fmtPct, lossClr } from '../../lib/stress'
import { SectionLabel, ShockBadge } from './shared'

// ─── Summary cards ─────────────────────────────────────────────────────────────
function SummaryCards({ result }: { result: StressResult }) {
  const pct = result.total_value_change_pct
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
      {[
        { label: 'Original Value', value: fmt$(result.total_original_value), color: '#EDE8DF' },
        { label: 'Stressed Value', value: fmt$(result.total_stressed_value),  color: lossClr(pct) },
        { label: 'Value Change',   value: fmt$(result.total_value_change),    color: lossClr(pct), sub: fmtPct(pct) },
        { label: 'P&L Impact',     value: fmt$(result.total_pnl_change),      color: lossClr(result.total_pnl_change) },
      ].map(c => (
        <div key={c.label} className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-4 py-3.5">
          <p className="text-[9px] tracking-[0.16em] uppercase text-[#8BA4BE] mb-2" style={mono}>{c.label}</p>
          <p className="text-[17px] font-semibold tracking-tight" style={{ ...sans, color: c.color }}>{c.value}</p>
          {c.sub && <p className="text-[10px] mt-0.5 font-medium" style={{ ...mono, color: c.color }}>{c.sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Sector breakdown ──────────────────────────────────────────────────────────
function SectorBreakdown({ sectors }: { sectors: StressResult['sector_exposures'] }) {
  const sorted = [...sectors].sort((a, b) => a.total_value_change - b.total_value_change)
  const maxAbs = Math.max(...sorted.map(s => Math.abs(s.total_value_change)), 1)
  return (
    <div className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 mb-4">
      <SectionLabel>Sector Impact</SectionLabel>
      <div className="space-y-2.5">
        {sorted.map((s, i) => {
          const w = Math.min((Math.abs(s.total_value_change) / maxAbs) * 100, 100)
          const c = lossClr(s.total_value_change)
          return (
            <div key={s.sector} className="flex items-center gap-3">
              <div className="w-32 text-[10px] text-[#8BA4BE] truncate flex-shrink-0" style={mono}>{s.sector}</div>
              <div className="flex-1 h-4 bg-[#0A1628] rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${w}%`, background: `${c}28`, borderRight: `2px solid ${c}`, animation: `barGrow 0.55s ${i * 0.04}s cubic-bezier(0.16,1,0.3,1) both` }} />
              </div>
              <div className="w-28 text-right text-[11px] font-medium flex-shrink-0" style={{ ...mono, color: c }}>{fmt$(s.total_value_change)}</div>
              <div className="w-16 flex-shrink-0 text-right"><ShockBadge pct={s.average_shock} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Positions table ───────────────────────────────────────────────────────────
function PositionsTable({ positions }: { positions: StressPosition[] }) {
  const [expanded, setExpanded] = useState(false)
  const sorted = [...positions].sort((a, b) => a.pnl_change - b.pnl_change)
  const shown  = expanded ? sorted : sorted.slice(0, 8)
  return (
    <div className="border border-[#B8943C]/10 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#B8943C]/8 flex items-center justify-between bg-[#020810]/80">
        <span className="text-[10px] tracking-[0.18em] uppercase text-[#8BA4BE]" style={mono}>Position Impacts</span>
        <span className="text-[10px] text-[#8BA4BE]" style={mono}>{positions.length} positions</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#B8943C]/8">
              {['Symbol', 'Sector', 'Orig. Price', 'Stressed', 'Shock', 'Value Δ', 'P&L Δ', 'Type'].map((h, i) => (
                <th key={h} className={`py-2.5 px-4 text-[9px] tracking-[0.14em] uppercase text-[#8BA4BE] font-normal ${i === 0 ? 'text-left' : 'text-right'}`} style={mono}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((p, i) => (
              <tr key={p.symbol} className="border-b border-[#B8943C]/5 hover:bg-[#0A1628]/40 transition-colors opacity-0"
                style={{ animation: `fadeUp 0.3s ${0.04 + i * 0.025}s forwards` }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded border border-[#B8943C]/15 flex items-center justify-center bg-[#0A1628]/60 flex-shrink-0">
                      <span className="text-[8px] font-medium text-[#C9A84C]" style={mono}>{p.symbol.slice(0, 2)}</span>
                    </div>
                    <span className="text-[12px] font-medium text-[#EDE8DF]" style={mono}>{p.symbol}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-[11px] text-[#8BA4BE]" style={sans}>{p.sector}</td>
                <td className="px-4 py-3 text-right text-[11px] text-[#8BA4BE]" style={mono}>{fmt$d(p.original_price)}</td>
                <td className="px-4 py-3 text-right text-[11px] font-medium" style={{ ...mono, color: lossClr(p.value_change_pct) }}>{fmt$d(p.stressed_price)}</td>
                <td className="px-4 py-3 text-right"><ShockBadge pct={p.price_shock_pct} /></td>
                <td className="px-4 py-3 text-right text-[11px] font-medium" style={{ ...mono, color: lossClr(p.value_change) }}>{fmt$d(p.value_change)}</td>
                <td className="px-4 py-3 text-right text-[11px] font-medium" style={{ ...mono, color: lossClr(p.pnl_change) }}>{fmt$d(p.pnl_change)}</td>
                <td className="px-4 py-3 text-right">
                  {p.direct_shock_pct != null
                    ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ ...mono, color: '#7A9AB8', background: 'rgba(122,154,184,0.08)', border: '1px solid rgba(122,154,184,0.15)' }}>direct</span>
                    : p.spillover_shock_pct != null
                    ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ ...mono, color: '#C9A84C', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}>spillover</span>
                    : <span style={{ color: '#4A6278', ...mono }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {positions.length > 8 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-[10px] tracking-[0.14em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors border-t border-[#B8943C]/8"
          style={mono}>
          {expanded ? '▲ Show less' : `▼ Show all ${positions.length} positions`}
        </button>
      )}
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function StressResultView({ result }: { result: StressResult }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] tracking-[0.22em] text-[#B8943C] uppercase mb-1.5" style={mono}>Result</p>
          <h2 className="text-[26px] font-semibold text-[#EDE8DF] leading-tight" style={serif}>{result.scenario_name}</h2>
          <p className="text-[12px] text-[#8BA4BE] mt-1 font-light" style={sans}>{result.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {result.correlation_applied && (
            <span className="text-[9px] px-2.5 py-1 rounded-md" style={{ ...mono, color: '#7A9AB8', background: 'rgba(122,154,184,0.08)', border: '1px solid rgba(122,154,184,0.15)' }}>
              ρ avg {result.average_correlation?.toFixed(2)}
            </span>
          )}
          <span className="text-[9px] text-[#8BA4BE]" style={mono}>{result.applied_date}</span>
        </div>
      </div>
      <SummaryCards result={result} />
      <SectorBreakdown sectors={result.sector_exposures} />
      <PositionsTable positions={result.positions} />
    </div>
  )
}