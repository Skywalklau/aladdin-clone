import { mono, serif, sans, fmt$d, fmtPct, lossClr } from '../../lib/stress'
import { ShockBadge } from './shared'
import type { ReverseResult } from '../../types'

export default function ReverseResultView({ result }: { result: ReverseResult }) {
  const shockPct = result.required_market_shock * 100
  return (
    <div>
      <p className="text-[10px] tracking-[0.22em] text-[#B8943C] uppercase mb-1.5" style={mono}>Result</p>
      <h2 className="text-[26px] font-semibold text-[#EDE8DF] leading-tight mb-1" style={serif}>Reverse Stress Test</h2>
      <p className="text-[12px] text-[#8BA4BE] mb-6 font-light" style={sans}>
        Shock required to lose {(result.target_loss_pct * 100).toFixed(0)}% of portfolio value
      </p>

      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <div className="col-span-2 border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-5">
          <p className="text-[9px] tracking-[0.16em] uppercase text-[#8BA4BE] mb-2" style={mono}>Required Market Shock</p>
          <p className="text-[38px] font-bold leading-none mb-2" style={{ ...serif, color: lossClr(shockPct) }}>{fmtPct(shockPct)}</p>
          <p className="text-[12px] text-[#8BA4BE] font-light leading-relaxed" style={sans}>{result.scenario_description}</p>
        </div>
        <div className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-5">
          <p className="text-[9px] tracking-[0.16em] uppercase text-[#8BA4BE] mb-2" style={mono}>Target Loss</p>
          <p className="text-[38px] font-bold leading-none text-[#E05252]" style={serif}>{(result.target_loss_pct * 100).toFixed(0)}%</p>
          <p className="text-[11px] text-[#8BA4BE] mt-2 font-light" style={sans}>{result.affected_positions.length} positions affected</p>
        </div>
      </div>

      <div className="border border-[#B8943C]/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#B8943C]/8 bg-[#020810]/80">
          <span className="text-[10px] tracking-[0.18em] uppercase text-[#8BA4BE]" style={mono}>Affected Positions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#B8943C]/8">
                {['Symbol', 'Sector', 'Original', 'Stressed', 'Shock', 'Value Δ'].map((h, i) => (
                  <th key={h} className={`py-2.5 px-4 text-[9px] tracking-[0.14em] uppercase text-[#8BA4BE] font-normal ${i === 0 ? 'text-left' : 'text-right'}`} style={mono}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...result.affected_positions].sort((a, b) => a.pnl_change - b.pnl_change).map((p, i) => (
                <tr key={p.symbol} className="border-b border-[#B8943C]/5 hover:bg-[#0A1628]/40 transition-colors opacity-0"
                  style={{ animation: `fadeUp 0.3s ${0.04 + i * 0.025}s forwards` }}>
                  <td className="px-4 py-3 text-[12px] font-medium text-[#EDE8DF]" style={mono}>{p.symbol}</td>
                  <td className="px-4 py-3 text-right text-[11px] text-[#8BA4BE]" style={sans}>{p.sector}</td>
                  <td className="px-4 py-3 text-right text-[11px] text-[#8BA4BE]" style={mono}>{fmt$d(p.original_price)}</td>
                  <td className="px-4 py-3 text-right text-[11px] font-medium" style={{ ...mono, color: lossClr(p.value_change_pct) }}>{fmt$d(p.stressed_price)}</td>
                  <td className="px-4 py-3 text-right"><ShockBadge pct={p.price_shock_pct} /></td>
                  <td className="px-4 py-3 text-right text-[11px] font-medium" style={{ ...mono, color: lossClr(p.value_change) }}>{fmt$d(p.value_change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}