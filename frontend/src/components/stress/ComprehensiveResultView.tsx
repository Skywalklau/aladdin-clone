import { useState, useEffect } from 'react'
import type { ComprehensiveResult, StressResult } from '../../types'
import { mono, serif, sans, fmt$, fmtPct, lossClr } from '../../lib/stress'
import { SectionLabel } from './shared'
import StressResultView from './StressResultView'

export default function ComprehensiveResultView({ result }: { result: ComprehensiveResult }) {
  const [selected, setSelected] = useState<StressResult | null>(null)
  const sorted = [...result.scenarios].sort((a, b) => a.total_value_change_pct - b.total_value_change_pct)

  useEffect(() => {
    window.history.replaceState({ comprehensiveView: 'overview' }, '')
    const onPop = (e: PopStateEvent) => {
      if (e.state?.comprehensiveView === 'overview') setSelected(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const drillInto = (scenario: StressResult) => {
    window.history.pushState({ comprehensiveView: 'detail' }, '')
    setSelected(scenario)
  }

  if (selected) {
    return (
      <div>
        <button onClick={() => window.history.back()}
          className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors mb-5"
          style={mono}>← All Scenarios</button>
        <StressResultView result={selected} />
      </div>
    )
  }

  return (
    <div>
      <p className="text-[10px] tracking-[0.22em] text-[#B8943C] uppercase mb-1.5" style={mono}>Result</p>
      <h2 className="text-[26px] font-semibold text-[#EDE8DF] leading-tight mb-1" style={serif}>Comprehensive Analysis</h2>
      <p className="text-[12px] text-[#8BA4BE] mb-6 font-light" style={sans}>{result.scenarios.length} scenarios across all stress types</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
        {[
          { label: 'Worst Case', value: result.worst_case_scenario,                 sub: fmtPct(result.worst_case_loss_pct),  color: '#E05252' },
          { label: 'Best Case',  value: result.best_case_scenario,                  sub: fmtPct(result.best_case_loss_pct),   color: '#4CAF85' },
          { label: 'Avg Loss',   value: fmt$(result.average_loss_across_scenarios), sub: 'across all scenarios',              color: '#E07B52' },
          { label: '>20% Loss',  value: `${result.scenarios_with_loss_over_20pct}`, sub: `${result.scenarios_with_loss_over_50pct} over 50%`, color: '#E05252' },
        ].map(c => (
          <div key={c.label} className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-4 py-3.5">
            <p className="text-[9px] tracking-[0.14em] uppercase text-[#8BA4BE] mb-2" style={mono}>{c.label}</p>
            <p className="text-[14px] font-semibold leading-snug" style={{ ...sans, color: c.color }}>{c.value}</p>
            <p className="text-[10px] text-[#8BA4BE] mt-1" style={mono}>{c.sub}</p>
          </div>
        ))}
      </div>

      <SectionLabel>All Scenarios — click to drill in</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sorted.map((scenario, i) => {
          const pct   = scenario.total_value_change_pct
          const barW  = Math.min(Math.abs(pct) / 70 * 100, 100)
          const color = lossClr(pct)
          return (
            <button key={scenario.scenario_name} onClick={() => drillInto(scenario)}
              className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-4 py-4 text-left hover:border-[#B8943C]/25 hover:bg-[#0A1628]/40 transition-all group opacity-0"
              style={{ animation: `fadeUp 0.3s ${0.04 + i * 0.025}s forwards` }}>
              <div className="flex items-start justify-between mb-2.5">
                <div>
                  <p className="text-[12px] font-medium text-[#EDE8DF] group-hover:text-[#C9A84C] transition-colors" style={mono}>{scenario.scenario_name}</p>
                  <p className="text-[9px] text-[#8BA4BE] mt-0.5 capitalize" style={mono}>{scenario.scenario_type}</p>
                </div>
                <span className="text-[16px] font-bold flex-shrink-0 ml-3" style={{ ...serif, color }}>{fmtPct(pct)}</span>
              </div>
              <div className="w-full h-1 bg-[#0A1628] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${barW}%`, background: `${color}55`, animation: `barGrow 0.5s ${0.1 + i * 0.025}s cubic-bezier(0.16,1,0.3,1) both` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-[#8BA4BE]" style={mono}>{fmt$(scenario.total_value_change)}</span>
                <span className="text-[9px] text-[#8BA4BE]/40 group-hover:text-[#8BA4BE] transition-colors" style={mono}>detail →</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}