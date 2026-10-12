import { useState } from 'react'
import {
  mono, serif, fmt,
  runDCF,
  type Financials, type Assumptions, type AIScenario, type AISuggestion,
} from '../../lib/dcf'

function scenarioColor(label: string) {
  if (label === 'Bull')         return '#4CAF85'
  if (label === 'Conservative') return '#E05252'
  return '#9B8FEE'
}

export function AIDrawer({
  open, onClose, symbol, financials, assumptions, intrinsic, impliedGrowth, onApply,
}: {
  open:          boolean
  onClose:       () => void
  symbol:        string
  financials:    Financials
  assumptions:   Assumptions
  intrinsic:     number
  impliedGrowth: number | null
  onApply:       (s: AIScenario) => void
}) {
  const [loading,    setLoading]    = useState(false)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [error,      setError]      = useState('')
  const [appliedLbl, setAppliedLbl] = useState<string | null>(null)
  const [expanded,   setExpanded]   = useState<string | null>(null)

  const fetchSuggestion = async () => {
    setLoading(true); setError(''); setSuggestion(null); setAppliedLbl(null)
    try {
      const res = await fetch(`/api/stocks/${symbol}/dcf-suggest`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financials,
          current_assumptions: assumptions,
          current_intrinsic:   intrinsic,
          implied_growth:      impliedGrowth,
        }),
      })
      if (!res.ok) throw new Error('Request failed')
      setSuggestion(await res.json())
    } catch {
      setError('Failed — check your OpenAI API key.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = (s: AIScenario) => {
    onApply(s)
    setAppliedLbl(s.label)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(2,8,16,0.7)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: 480, background: '#0A1628', borderLeft: '1px solid #1A2840' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A2840] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[14px]">✦</span>
            <div>
              <p className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE]" style={mono}>AI Scenario Analysis</p>
              <p className="text-[10px] text-[#4A6070] mt-0.5" style={mono}>GPT-4o · Conservative, Base & Bull</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSuggestion}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] tracking-[0.08em] uppercase font-medium transition-all disabled:opacity-50"
              style={{ ...mono, background: 'rgba(155,143,238,0.12)', border: '1px solid rgba(155,143,238,0.25)', color: '#9B8FEE' }}
            >
              {loading
                ? <><div className="w-3 h-3 border border-[#9B8FEE]/40 border-t-[#9B8FEE] rounded-full animate-spin" /><span>Analysing</span></>
                : <span>{suggestion ? '↺ Re-analyse' : 'Analyse'}</span>
              }
            </button>
            <button onClick={onClose} className="text-[#4A6070] hover:text-[#8BA4BE] transition-colors text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <p className="text-[11px] text-[#E05252]" style={mono}>⚠ {error}</p>}

          {!suggestion && !loading && (
            <div className="rounded-xl px-5 py-10 text-center border border-[#1A2840]">
              <p className="text-[28px] mb-3">✦</p>
              <p className="text-[12px] text-[#4A6070] leading-relaxed max-w-[280px] mx-auto" style={mono}>
                Click Analyse to generate conservative, base & bull cases with full reasoning, upside drivers, and downside risks.
              </p>
            </div>
          )}

          {suggestion && !loading && (
            <>
              {suggestion.macro_context && (
                <div className="rounded-xl px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1A2840' }}>
                  <p className="text-[9px] tracking-[0.18em] uppercase text-[#4A6070] mb-2" style={mono}>Industry & Macro Context</p>
                  <p className="text-[11px] text-[#8BA4BE] leading-relaxed" style={mono}>{suggestion.macro_context}</p>
                </div>
              )}

              {suggestion.scenarios.map(s => {
                const color      = scenarioColor(s.label)
                const scenarioA: Assumptions = {
                  ...assumptions,
                  fcf:             s.base_fcf * 1e9,
                  growthRate:      s.stage1_growth,
                  growthRateYears: Math.min(s.stage1_years, assumptions.years - 1),
                  growthRate2:     s.stage2_growth,
                  terminalGrowth:  s.terminal_growth,
                  discountRate:    s.wacc,
                }
                const { intrinsic: sIntrinsic, invalid } = runDCF(scenarioA)
                const mos = financials.current_price && !invalid
                  ? ((sIntrinsic - financials.current_price) / financials.current_price) * 100
                  : null
                const isExpanded = expanded === s.label

                return (
                  <div key={s.label} className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${color}20`, background: `${color}06` }}>
                    <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${color}70, transparent)` }} />
                    <div className="p-4">

                      {/* Scenario header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] tracking-[0.2em] uppercase font-semibold" style={{ ...mono, color }}>
                              {s.label}
                            </span>
                            {appliedLbl === s.label && (
                              <span className="text-[8px] tracking-[0.12em] uppercase px-1.5 py-0.5 rounded"
                                style={{ ...mono, background: `${color}18`, color, border: `1px solid ${color}30` }}>
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8BA4BE] leading-relaxed pr-3" style={mono}>{s.thesis}</p>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <p className="text-[26px] font-semibold leading-none"
                            style={{ ...serif, color: invalid ? '#4A6070' : '#EDE8DF' }}>
                            {invalid ? 'N/A' : fmt(sIntrinsic)}
                          </p>
                          {mos !== null && (
                            <p className="text-[10px] mt-0.5"
                              style={{ ...mono, color: mos > 0 ? '#4CAF85' : '#E05252' }}>
                              {mos > 0 ? '+' : ''}{mos.toFixed(2)}% vs market
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Params strip */}
                      <div className="grid grid-cols-5 gap-1 mb-3">
                        {[
                          { l: 'Base FCF',  v: `$${s.base_fcf.toFixed(1)}B` },
                          { l: 'S1 Growth', v: `${s.stage1_growth}% · ${s.stage1_years}yr` },
                          { l: 'S2 Growth', v: `${s.stage2_growth}%` },
                          { l: 'Terminal',  v: `${s.terminal_growth}%` },
                          { l: 'WACC',      v: `${s.wacc}%` },
                        ].map(p => (
                          <div key={p.l} className="text-center rounded-md py-1.5 px-1"
                            style={{ background: `${color}0C`, border: `1px solid ${color}18` }}>
                            <p className="text-[8px] uppercase tracking-[0.08em] text-[#4A6070] mb-0.5" style={mono}>{p.l}</p>
                            <p className="text-[10px] font-medium text-[#EDE8DF]" style={mono}>{p.v}</p>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApply(s)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] tracking-[0.12em] uppercase font-medium transition-all"
                          style={{
                            ...mono,
                            background: appliedLbl === s.label ? `${color}20` : `${color}10`,
                            border: `1px solid ${color}${appliedLbl === s.label ? '40' : '20'}`,
                            color:  appliedLbl === s.label ? color : `${color}80`,
                          }}
                        >
                          {appliedLbl === s.label ? '✓ Applied' : `Apply ${s.label}`}
                        </button>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : s.label)}
                          className="py-1.5 px-3 rounded-lg text-[10px] tracking-[0.10em] uppercase transition-all"
                          style={{
                            ...mono,
                            background: isExpanded ? `${color}15` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isExpanded ? color + '30' : '#1A2840'}`,
                            color:  isExpanded ? color : '#4A6070',
                          }}
                        >
                          {isExpanded ? '↑ Less' : '↓ Detail'}
                        </button>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-3.5" style={{ borderColor: `${color}15` }}>
                          <div>
                            <p className="text-[9px] tracking-[0.18em] uppercase mb-1.5"
                              style={{ ...mono, color: `${color}99` }}>Why These Numbers</p>
                            <p className="text-[11px] text-[#8BA4BE] leading-relaxed" style={mono}>
                              {s.assumptions_rationale}
                            </p>
                          </div>
                          {s.upside_drivers?.length > 0 && (
                            <div>
                              <p className="text-[9px] tracking-[0.18em] uppercase text-[#4CAF85]/60 mb-1.5" style={mono}>
                                Upside Drivers
                              </p>
                              <ul className="space-y-1.5">
                                {s.upside_drivers.map((d, i) => (
                                  <li key={i} className="flex gap-2 text-[11px] text-[#8BA4BE] leading-relaxed" style={mono}>
                                    <span className="text-[#4CAF85]/50 flex-shrink-0">+</span><span>{d}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {s.downside_risks?.length > 0 && (
                            <div>
                              <p className="text-[9px] tracking-[0.18em] uppercase text-[#E05252]/60 mb-1.5" style={mono}>
                                Key Risks
                              </p>
                              <ul className="space-y-1.5">
                                {s.downside_risks.map((r, i) => (
                                  <li key={i} className="flex gap-2 text-[11px] text-[#8BA4BE] leading-relaxed" style={mono}>
                                    <span className="text-[#E05252]/50 flex-shrink-0">−</span><span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {suggestion.risks && (
                <div className="rounded-xl px-4 py-3.5"
                  style={{ background: 'rgba(224,82,82,0.03)', border: '1px solid rgba(224,82,82,0.10)' }}>
                  <p className="text-[9px] tracking-[0.18em] uppercase text-[#E05252]/60 mb-1.5" style={mono}>
                    Cross-Scenario Risks
                  </p>
                  <p className="text-[11px] text-[#8BA4BE] leading-relaxed" style={mono}>{suggestion.risks}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}