import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import {
  mono, sans, serif,
  fmt, fmtB, fmtShares, fmtPct,
  computeWACC, computeKe, computeFCFE,
  runDCF, solveImpliedGrowth, buildSensitivityGrid, makeDefaultAssumptions,
  type Financials, type Assumptions, type AIScenario, type CompsData, type Summary,
} from '../lib/dcf'

import MarketIndices from '../components/MarketIndices'

import { AssumptionRow }       from '../components/dcf/AssumptionRow'
import { StageBadge }          from '../components/dcf/StageBadge'
import { FCFHistoryChart }     from '../components/dcf/FCFHistoryChart'
import { SensitivityTable }    from '../components/dcf/SensitivityTable'
import { PVWaterfall }         from '../components/dcf/PVWaterfall'
import { AIDrawer }            from '../components/dcf/AIDrawer'
import { ValuationModeToggle } from '../components/dcf/ValuationModeToggle'
import { CompsPanel }          from '../components/dcf/CompsPanel'

// ── Tab config ────────────────────────────────────────────────────────────────
type Tab = 'growth' | 'wacc' | 'capital' | 'comps'
const TABS: { id: Tab; label: string }[] = [
  { id: 'growth',  label: 'Cash Flows'        },
  { id: 'wacc',    label: 'Discount Rate'     },
  { id: 'capital', label: 'Capital Structure' },
  { id: 'comps',   label: 'Comps'             },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function DCFCalculator() {
  const { id, symbol } = useParams<{ id?: string; symbol: string }>()
  const navigate = useNavigate()

  const [financials, setFinancials] = useState<Financials | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [activeTab,  setActiveTab]  = useState<Tab>('growth')
  const [aiOpen,     setAiOpen]     = useState(false)

  // ── Comps / summary state ──────────────────────────────────────────────────
  const [compsData, setCompsData] = useState<CompsData | null>(null)
  const [summary,   setSummary]   = useState<Summary   | null>(null)

  // ── Valuation-mode state ───────────────────────────────────────────────────
  const [mode, setMode] = useState<'FCFF' | 'FCFE'>('FCFF')
  const [wacc, setWacc] = useState<number>(0)
  const [ke,   setKe]   = useState<number>(0)

  const [assumptions,    setAssumptions]    = useState<Assumptions>({
    fcf: 1e9, growthRate: 10, growthRateYears: 5, growthRate2: 5,
    terminalGrowth: 3, discountRate: 10, riskFreeRate: 4.3, erp: 5.5,
    years: 10, sharesOut: 1e9, netDebt: 0, minorityInterest: 0, preferredStock: 0,
    mode: 'FCFF',
  })
  const [waccBreakdown,  setWaccBreakdown]  = useState('')
  const [waccOverridden, setWaccOverridden] = useState(false)

  const set = useCallback((key: keyof Assumptions) => (v: number) =>
    setAssumptions(prev => {
      const next = { ...prev, [key]: v }
      if (key === 'years')           next.years           = Math.round(v)
      if (key === 'growthRateYears') next.growthRateYears = Math.round(v)
      if (key === 'years')           next.growthRateYears = Math.min(prev.growthRateYears, Math.round(v) - 1)
      if (key === 'growthRateYears') next.growthRateYears = Math.min(Math.round(v), prev.years - 1)
      return next
    }), [])

  const resetAssumptions = useCallback((f: Financials, riskFreeRate?: number, erp?: number, currentMode?: 'FCFF' | 'FCFE') => {
    const rfr    = riskFreeRate ?? f.risk_free_rate ?? 4.3
    const erpVal = erp ?? 5.5
    const m      = currentMode ?? 'FCFF'
    const { assumptions: a, wacc: w, ke: k, breakdown } = makeDefaultAssumptions(f, rfr, erpVal, m)
    setAssumptions(a)
    setWaccBreakdown(breakdown)
    setWacc(w)
    setKe(k)
    setWaccOverridden(false)
  }, [])

  // ── Mode-switch handler ────────────────────────────────────────────────────
  const handleModeChange = useCallback((next: 'FCFF' | 'FCFE') => {
    if (!financials) return
    setMode(next)
    setAssumptions(prev => ({
      ...prev,
      mode:         next,
      fcf:          next === 'FCFE'
                      ? computeFCFE(financials)
                      : (financials.free_cash_flow ?? 1e9),
      discountRate: next === 'FCFE' ? ke : wacc,
    }))
    setWaccOverridden(false)
  }, [financials, ke, wacc])

  const applyAISuggestion = useCallback((s: AIScenario) => {
    setAssumptions(prev => ({
      ...prev,
      fcf:             s.base_fcf * 1e9,
      growthRate:      s.stage1_growth,
      growthRateYears: Math.min(s.stage1_years, prev.years - 1),
      growthRate2:     s.stage2_growth,
      terminalGrowth:  s.terminal_growth,
      discountRate:    s.wacc,
    }))
    setWaccOverridden(true)
  }, [])

  // ── Recompute WACC / Ke when CAPM inputs change ────────────────────────────
  useEffect(() => {
    if (!financials) return
    const { wacc: w, breakdown } = computeWACC(financials, assumptions.riskFreeRate, assumptions.erp)
    const k = computeKe(financials, assumptions.riskFreeRate, assumptions.erp)
    setWaccBreakdown(breakdown)
    setWacc(w)
    setKe(k)
    if (!waccOverridden) {
      if (assumptions.mode === 'FCFE') {
        setAssumptions(prev => ({ ...prev, discountRate: k }))
      } else {
        setAssumptions(prev => ({ ...prev, discountRate: w }))
      }
    }
  }, [assumptions.riskFreeRate, assumptions.erp, assumptions.mode, financials, waccOverridden])

  // ── Fetch financials ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetch(`/api/stocks/${symbol}/financials`)
      .then(r => r.json())
      .then((f: Financials) => { setFinancials(f); resetAssumptions(f) })
      .catch(() => setError('Failed to load financials'))
      .finally(() => setLoading(false))
  }, [symbol])

  // ── Fetch comps + summary (best-effort) ───────────────────────────────────
  useEffect(() => {
    if (!symbol) return
    fetch(`/api/stocks/${symbol}/comps`)
      .then(r => r.ok ? r.json() : null)
      .then((d: CompsData | null) => { if (d) setCompsData(d) })
      .catch(() => {/* comps are optional */})

    fetch(`/api/stocks/${symbol}/summary`)
      .then(r => r.ok ? r.json() : null)
      .then((d: Partial<Summary> | null) => { if (d) setSummary(d as Summary) })
      .catch(() => {/* summary is optional */})
  }, [symbol])

  // ── Re-fetch comps when user edits peer list ───────────────────────────────
  const handlePeersChange = useCallback(async (peers: string[]) => {
    if (!symbol) return
    const override = peers.join(',')
    try {
      const r = await fetch(`/api/stocks/${symbol}/comps?peers=${encodeURIComponent(override)}`)
      const d: CompsData | null = r.ok ? await r.json() : null
      if (d) setCompsData(d)
    } catch {
      /* comps are optional */
    }
  }, [symbol])

  // ── DCF results ───────────────────────────────────────────────────────────
  const { pvs, terminalPV, intrinsic, enterpriseValue, invalid } = runDCF(assumptions)
  const sumPVs    = pvs.reduce((s, v) => s + v, 0)
  const totalPV   = sumPVs + terminalPV
  const hasNegFCF = pvs.some(v => v < 0)
  const marketPrice = financials?.current_price ?? null
  const margin    = !invalid && marketPrice ? ((intrinsic - marketPrice) / marketPrice) * 100 : null
  const isUnder   = !invalid && margin !== null && margin > 0

  const equityValue = assumptions.mode === 'FCFE'
    ? enterpriseValue
    : enterpriseValue - assumptions.netDebt - assumptions.minorityInterest - assumptions.preferredStock

  const netDebtHint = financials
    ? [
        financials.total_debt           != null ? `Debt ${fmtB(financials.total_debt)}` : null,
        financials.cash_and_equivalents != null ? `Cash ${fmtB(financials.cash_and_equivalents)}` : null,
      ].filter(Boolean).join(' · ') || undefined
    : undefined

  const { growthRates, waccs, grid } = useMemo(
    () => buildSensitivityGrid(assumptions),
    [
      assumptions.fcf, assumptions.growthRate, assumptions.discountRate,
      assumptions.terminalGrowth, assumptions.growthRateYears, assumptions.growthRate2,
      assumptions.years, assumptions.sharesOut, assumptions.netDebt,
      assumptions.minorityInterest, assumptions.preferredStock,
    ],
  )

  const impliedGrowth = useMemo(
    () => marketPrice ? solveImpliedGrowth(assumptions, marketPrice) : null,
    [
      assumptions.fcf, assumptions.discountRate, assumptions.terminalGrowth,
      assumptions.growthRateYears, assumptions.growthRate2, assumptions.years,
      assumptions.sharesOut, assumptions.netDebt, assumptions.minorityInterest,
      assumptions.preferredStock, marketPrice,
    ],
  )

  if (loading) return (
    <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-6 h-6 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#4A6070]" style={mono}>Loading financials…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
      <div className="text-center">
        <p className="text-[#E05252] text-[11px] tracking-[0.15em] uppercase mb-4" style={mono}>⚠ {error}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors"
          style={mono}
        >← Back</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

      <nav className="border-b border-[#1A2840] px-8 py-4 flex items-center gap-4 sticky top-0 z-30 bg-[#020810]/95 backdrop-blur-md">
        <button
          onClick={() => navigate(id ? `/portfolio/${id}/stock/${symbol}` : `/stock/${symbol}`)}
          className="text-[11px] tracking-[0.10em] uppercase text-[#4A6070] hover:text-[#EDE8DF] transition-colors flex items-center gap-1.5"
          style={mono}
        >
          <span>←</span><span>Back</span>
        </button>
        <div className="w-px h-4 bg-[#1A2840]" />
        <button onClick={() => navigate('/')} className="text-[18px] font-bold hover:opacity-80 transition-opacity" style={serif}>Ala<span className="text-[#C9A84C]">ddin</span></button>
        <div className="flex-1" />
        <MarketIndices />
        <div className="w-px h-4 bg-[#1A2840]" />
        <button
          onClick={() => setAiOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] tracking-[0.08em] uppercase font-medium transition-all"
          style={{ ...mono, background: 'rgba(155,143,238,0.10)', border: '1px solid rgba(155,143,238,0.22)', color: '#9B8FEE' }}
        >
          <span>✦</span><span>AI Analysis</span>
        </button>
        {!invalid && margin !== null && (
          <span
            className={`text-[11px] font-medium px-3 py-1.5 rounded-lg ${
              isUnder
                ? 'text-[#4CAF85] bg-[#4CAF85]/08 border border-[#4CAF85]/20'
                : 'text-[#E05252] bg-[#E05252]/08 border border-[#E05252]/20'
            }`}
            style={mono}
          >
            {isUnder ? '▲' : '▼'} {Math.abs(margin).toFixed(2)}% {isUnder ? 'undervalued' : 'overvalued'}
          </span>
        )}
      </nav>

      <div className="border-b border-[#1A2840] px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#C9A84C] mb-1" style={mono}>DCF Valuation · {symbol}</p>
            <h1 className="text-[26px] font-semibold leading-tight" style={serif}>{financials?.company_name || symbol}</h1>
          </div>
          {marketPrice && (
            <div className="text-right">
              <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A6070] mb-1" style={mono}>Market Price</p>
              <p className="text-[20px] font-medium text-[#8BA4BE]" style={serif}>{fmt(marketPrice)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">

          {/* LEFT */}
          <div className="space-y-4">
            {financials?.fcf_history && financials.fcf_history.length > 0 && (
              <details className="border border-[#1A2840] rounded-xl bg-[#0A1628]/40 overflow-hidden group">
                <summary className="px-5 py-3.5 flex items-center justify-between cursor-pointer list-none select-none hover:bg-[#1A2840]/30 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1 h-1 rounded-full bg-[#C9A84C]" />
                    <p className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE]" style={mono}>Historical Free Cash Flow</p>
                  </div>
                  <span className="text-[#4A6070] text-[11px] group-open:rotate-180 transition-transform" style={mono}>↓</span>
                </summary>
                <div className="px-5 pb-4 pt-2 border-t border-[#1A2840]">
                  <p className="text-[10px] text-[#4A6070] mb-3 leading-relaxed" style={mono}>Trend to anchor your Stage 1 growth assumption.</p>
                  <FCFHistoryChart history={financials.fcf_history} />
                </div>
              </details>
            )}

            <div className="border border-[#1A2840] rounded-xl bg-[#0A1628]/40 overflow-hidden">
              <div className="flex border-b border-[#1A2840]">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-center transition-all ${
                      activeTab === tab.id
                        ? 'border-b-2 border-[#C9A84C] bg-[#C9A84C]/04'
                        : 'border-b-2 border-transparent hover:bg-[#1A2840]/30'
                    }`}>
                    <p className={`text-[11px] tracking-[0.10em] uppercase font-medium transition-colors ${
                      activeTab === tab.id ? 'text-[#C9A84C]' : 'text-[#4A6070]'
                    }`} style={mono}>{tab.label}</p>
                  </button>
                ))}
                <div className="flex items-center px-4">
                  <button
                    onClick={() => financials && resetAssumptions(financials, assumptions.riskFreeRate, assumptions.erp, mode)}
                    className="text-[10px] tracking-[0.10em] uppercase text-[#4A6070] hover:text-[#8BA4BE] transition-colors"
                    style={mono}
                  >↺ Reset</button>
                </div>
              </div>

              <div className="px-6 py-6 space-y-7">
                {activeTab === 'growth' && (
                  <>
                    <ValuationModeToggle
                      mode={assumptions.mode ?? 'FCFF'}
                      wacc={wacc}
                      ke={ke}
                      onModeChange={handleModeChange}
                    />
                    <div className="h-px bg-[#1A2840]" />
                    <div>
                      <StageBadge label="Starting Point" sub="What the business earns today" />
                      <AssumptionRow
                        label={assumptions.mode === 'FCFE' ? 'Base FCFE' : 'Base FCFF'}
                        hint={
                          assumptions.mode === 'FCFE'
                            ? `FCFF − after-tax interest + net borrowing${financials?.free_cash_flow ? ` · Latest FCFF: ${fmtB(financials.free_cash_flow)}` : ''}`
                            : financials?.free_cash_flow
                              ? [
                                  `Latest: ${fmtB(financials.free_cash_flow)}`,
                                  financials.fcf_3yr_avg != null ? `3yr avg: ${fmtB(financials.fcf_3yr_avg)}` : null,
                                ].filter(Boolean).join(' · ')
                              : 'Cash generated after capex.'
                        }
                        value={assumptions.fcf}
                        min={-50e9} max={200e9} step={500e6} unit="$"
                        onChange={set('fcf')} />
                    </div>
                    <div className="h-px bg-[#1A2840]" />
                    <div>
                      <StageBadge label="Stage 1 · High Growth" sub={`Years 1–${assumptions.growthRateYears}`} />
                      <div className="space-y-6">
                        <AssumptionRow label="Growth Rate" value={assumptions.growthRate}
                          min={-20} max={60} step={0.5} unit="%" hint="Annual FCF growth during the high-growth phase."
                          onChange={set('growthRate')} />
                        <AssumptionRow label="Duration" value={assumptions.growthRateYears}
                          min={1} max={Math.max(assumptions.years - 1, 1)} step={1} unit=" yrs"
                          hint="Years before competition or scale slow growth."
                          onChange={set('growthRateYears')} />
                      </div>
                    </div>
                    <div className="h-px bg-[#1A2840]" />
                    <div>
                      <StageBadge label="Stage 2 · Maturing" sub={`Years ${assumptions.growthRateYears + 1}–${assumptions.years}`} />
                      <div className="space-y-6">
                        <AssumptionRow label="Growth Rate" value={assumptions.growthRate2}
                          min={-20} max={40} step={0.5} unit="%" hint="Lower than Stage 1 — the business is scaling slowly."
                          onChange={set('growthRate2')} />
                        <AssumptionRow label="Total Projection Years" value={assumptions.years}
                          min={3} max={20} step={1} unit=" yrs" hint="Total explicit forecast horizon. 10 years is standard."
                          onChange={set('years')} />
                      </div>
                    </div>
                    <div className="h-px bg-[#1A2840]" />
                    <div>
                      <StageBadge label="Terminal · Perpetuity" sub={`After Year ${assumptions.years}`} />
                      <AssumptionRow label="Terminal Growth Rate" value={assumptions.terminalGrowth}
                        min={0} max={6} step={0.1} unit="%" hint="Perpetual rate — should not exceed long-run GDP (~2–3%)."
                        onChange={set('terminalGrowth')} />
                    </div>
                  </>
                )}

                {activeTab === 'wacc' && (
                  <>
                    <div>
                      <StageBadge label="CAPM Input" sub="Drives cost of equity" />
                      <div className="space-y-6">
                        <AssumptionRow label="Risk-Free Rate" value={assumptions.riskFreeRate}
                          min={0} max={8} step={0.1} unit="%" hint="Current 10-year US Treasury yield."
                          onChange={set('riskFreeRate')} />
                        <AssumptionRow label="Equity Risk Premium" value={assumptions.erp}
                          min={2} max={10} step={0.1} unit="%"
                          hint="Damodaran estimate ~4.5–5.5%. Extra return required above the risk-free rate."
                          onChange={set('erp')} />
                      </div>
                    </div>
                    <div className="h-px bg-[#1A2840]" />
                    <div>
                      <StageBadge
                        label={
                          assumptions.mode === 'FCFE'
                            ? (waccOverridden ? 'Cost of Equity · Manual Override' : 'Cost of Equity · Auto-computed')
                            : (waccOverridden ? 'WACC · Manual Override'          : 'WACC · Auto-computed')
                        }
                        sub={waccOverridden ? 'Manually adjusted' : assumptions.mode === 'FCFE' ? 'CAPM: Rf + β×ERP' : 'From beta, debt & taxes'}
                      />
                      <AssumptionRow
                        label={assumptions.mode === 'FCFE' ? 'Discount Rate (Ke)' : 'Discount Rate (WACC)'}
                        value={assumptions.discountRate}
                        min={4} max={25} step={0.5} unit="%"
                        hint={
                          assumptions.mode === 'FCFE'
                            ? `Cost of equity via CAPM. Ke = ${ke.toFixed(2)}%`
                            : waccOverridden
                              ? `Override active. Formula: ${waccBreakdown}`
                              : 'Higher WACC = more risk = lower valuation.'
                        }
                        onChange={v => { setWaccOverridden(true); set('discountRate')(v) }} />
                      {waccOverridden && (
                        <button
                          onClick={() => {
                            if (!financials) return
                            const restored = assumptions.mode === 'FCFE' ? ke : wacc
                            setWaccOverridden(false)
                            setAssumptions(prev => ({ ...prev, discountRate: restored }))
                          }}
                          className="mt-3 text-[10px] tracking-[0.10em] uppercase text-[#C9A84C]/60 hover:text-[#C9A84C] transition-colors"
                          style={mono}
                        >↺ Restore computed {assumptions.mode === 'FCFE' ? 'Ke' : 'WACC'}</button>
                      )}
                    </div>
                    {waccBreakdown && (
                      <div className="rounded-xl bg-[#020810] border border-[#1A2840] px-4 py-3.5">
                        <p className="text-[9px] tracking-[0.15em] uppercase text-[#4A6070] mb-2" style={mono}>WACC Breakdown</p>
                        <p className="text-[11px] text-[#8BA4BE] leading-relaxed" style={mono}>{waccBreakdown}</p>
                        <p className="text-[10px] text-[#4A6070] mt-1.5" style={mono}>
                          Ke = {ke.toFixed(2)}%
                          {assumptions.mode === 'FCFE' && <span className="text-[#C9A84C]/70"> · active (FCFE mode)</span>}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'capital' && (
                  <>
                    <div>
                      <StageBadge label="Equity" sub="Per-share divisor" />
                      <AssumptionRow label="Shares Outstanding" value={assumptions.sharesOut}
                        min={1e6} max={100e9} step={10e6} unit=" shares"
                        hint={financials?.shares_outstanding ? `Reported: ${fmtShares(financials.shares_outstanding)} shares` : 'Divides equity value into per-share intrinsic value.'}
                        onChange={set('sharesOut')} />
                    </div>
                    <div className="h-px bg-[#1A2840]" />
                    <div>
                      <StageBadge
                        label={assumptions.mode === 'FCFE' ? 'EV → Equity Bridge' : 'EV → Equity Bridge'}
                        sub={assumptions.mode === 'FCFE' ? 'Not applied — FCFE is already equity-level' : 'Deductions from enterprise value'}
                      />
                      {assumptions.mode === 'FCFE' ? (
                        <div className="rounded-xl bg-[#020810] border border-[#1A2840] px-4 py-3.5 mt-3">
                          <p className="text-[10px] text-[#4A6070] leading-relaxed" style={mono}>
                            In FCFE mode, cash flows are already equity-level. No debt bridge is subtracted — the equity value equals the discounted sum of FCFEs directly.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6 mt-0">
                          <AssumptionRow label="Net Debt" value={assumptions.netDebt}
                            min={-500e9} max={2000e9} step={1e9} unit="$"
                            hint={netDebtHint ? `${netDebtHint} · +ve = net borrower` : 'Total debt minus cash.'}
                            onChange={set('netDebt')} />
                          <AssumptionRow label="Minority Interest" value={assumptions.minorityInterest}
                            min={0} max={500e9} step={100e6} unit="$"
                            hint={financials?.minority_interest != null ? `Reported: ${fmtB(financials.minority_interest)}` : 'Subsidiaries owned by outside shareholders.'}
                            onChange={set('minorityInterest')} />
                          <AssumptionRow label="Preferred Stock" value={assumptions.preferredStock}
                            min={0} max={500e9} step={100e6} unit="$"
                            hint={financials?.preferred_stock != null ? `Reported: ${fmtB(financials.preferred_stock)}` : 'Senior claim ahead of common equity.'}
                            onChange={set('preferredStock')} />
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl bg-[#020810] border border-[#1A2840] px-4 py-4">
                      <p className="text-[9px] tracking-[0.15em] uppercase text-[#4A6070] mb-4" style={mono}>Bridge Summary</p>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Enterprise Value',    value: fmtB(enterpriseValue),                     color: '#EDE8DF' },
                          ...(assumptions.mode !== 'FCFE' ? [
                            { label: '− Net Debt',          value: fmtB(-assumptions.netDebt),                color: '#8BA4BE' },
                            { label: '− Minority Interest', value: fmtB(-assumptions.minorityInterest),       color: '#8BA4BE', hide: assumptions.minorityInterest === 0 },
                            { label: '− Preferred Stock',   value: fmtB(-assumptions.preferredStock),         color: '#8BA4BE', hide: assumptions.preferredStock === 0   },
                          ] : []),
                          { label: 'Equity Value',        value: fmtB(equityValue),                         color: '#C9A84C', border: true },
                          { label: '÷ Shares',            value: `${fmtShares(assumptions.sharesOut)} shs`, color: '#8BA4BE' },
                          { label: 'Intrinsic / Share',   value: invalid ? '—' : fmt(intrinsic),            color: '#C9A84C', border: true },
                        ].filter(r => !('hide' in r && r.hide)).map((row, i) => (
                          <div key={i} className={`flex justify-between items-center ${'border' in row && row.border ? 'pt-2.5 mt-1 border-t border-[#1A2840]' : ''}`}>
                            <span className="text-[11px] text-[#8BA4BE]" style={mono}>{row.label}</span>
                            <span className="text-[12px] font-medium" style={{ ...mono, color: row.color }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'comps' && (
                  <>
                    {compsData && financials ? (
                      <CompsPanel
                        comps={compsData}
                        financials={financials}
                        summary={summary}
                        intrinsic={invalid ? 0 : intrinsic}
                        onPeersChange={handlePeersChange}
                      />
                    ) : (
                      <div className="py-12 flex flex-col items-center gap-3">
                        {compsData === null && !financials ? (
                          <div className="w-5 h-5 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
                        ) : (
                          <>
                            <p className="text-[11px] tracking-[0.15em] uppercase text-[#4A6070]" style={mono}>No comps data available</p>
                            <p className="text-[10px] text-[#4A6070] leading-relaxed text-center max-w-xs" style={mono}>
                              Ensure the <code className="text-[#8BA4BE]">/api/stocks/{symbol}/comps</code> endpoint returns a <code className="text-[#8BA4BE]">CompsData</code> object.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="border border-[#1A2840] rounded-xl px-5 py-3 bg-[#0A1628]/20">
              <p className="text-[10px] text-[#4A6070] leading-relaxed" style={mono}>
                ⚠ Terminal value typically represents 60–80% of total EV. Use as one input among many, not a price target.
              </p>
            </div>
          </div>

          {/* RIGHT — sticky */}
          <div className="space-y-4" style={{ position: 'sticky', top: 88 }}>
            <div className="border border-[#1A2840] rounded-xl bg-[#0A1628]/60 overflow-hidden">
              <div className="h-[3px]" style={{
                background: invalid ? '#E05252' : isUnder
                  ? 'linear-gradient(90deg, #4CAF85, #4CAF8560)'
                  : 'linear-gradient(90deg, #C9A84C, #C9A84C50)',
              }} />
              <div className="px-5 py-5">
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A6070] mb-3" style={mono}>Intrinsic Value / Share</p>
                {invalid ? (
                  <div className="border border-[#E05252]/25 rounded-lg bg-[#E05252]/04 px-4 py-3">
                    <p className="text-[12px] text-[#E05252]" style={mono}>⚠ Discount Rate ≤ Terminal Growth</p>
                    <p className="text-[10px] text-[#E05252]/60 mt-1.5 leading-relaxed" style={mono}>Raise WACC or lower terminal growth.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[52px] font-semibold leading-none tracking-tight mb-2" style={{ ...serif, color: '#EDE8DF' }}>
                      {fmt(intrinsic)}
                    </p>
                    {marketPrice && margin !== null && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] text-[#8BA4BE]" style={mono}>{fmt(marketPrice)} market</span>
                        <span className={`text-[13px] font-semibold ${isUnder ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>
                          {isUnder ? '+' : ''}{margin.toFixed(2)}%
                        </span>
                      </div>
                    )}
                    <p className="text-[9px] text-[#4A6070] mt-2" style={mono}>
                      {assumptions.mode === 'FCFE' ? 'FCFE mode · Ke discount · no debt bridge' : 'FCFF mode · WACC discount'}
                    </p>
                  </>
                )}
              </div>
            </div>

            <button onClick={() => setAiOpen(true)}
              className="w-full rounded-xl overflow-hidden transition-all group"
              style={{ border: '1px solid rgba(155,143,238,0.20)', background: 'rgba(155,143,238,0.05)' }}>
              <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #9B8FEE, #9B8FEE40)' }} />
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[14px]">✦</span>
                  <div className="text-left">
                    <p className="text-[11px] tracking-[0.12em] uppercase text-[#9B8FEE]" style={mono}>AI Scenario Analysis</p>
                    <p className="text-[10px] text-[#4A6070] mt-0.5" style={mono}>Conservative · Base · Bull</p>
                  </div>
                </div>
                <span className="text-[#9B8FEE]/60 group-hover:text-[#9B8FEE] transition-colors text-[11px]" style={mono}>Open →</span>
              </div>
            </button>

            {marketPrice && (
              <div className="border border-[#1A2840] rounded-xl bg-[#0A1628]/40 px-5 py-4">
                <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A6070] mb-1" style={mono}>Implied Growth Rate</p>
                <p className="text-[10px] text-[#4A6070] mb-3 leading-relaxed" style={mono}>
                  Stage 1 growth priced in at {fmt(marketPrice)}, all else fixed.
                </p>
                {impliedGrowth !== null ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-[32px] font-semibold" style={{ ...serif, color: '#EDE8DF' }}>{impliedGrowth.toFixed(2)}%</span>
                      <span className="text-[11px] text-[#8BA4BE]" style={mono}>/ yr (Stage 1)</span>
                    </div>
                    <div className="pt-3 border-t border-[#1A2840]">
                      {impliedGrowth > assumptions.growthRate + 0.1 ? (
                        <p className="text-[10px] text-[#E08070] leading-relaxed" style={mono}>
                          ▲ Market implies {(impliedGrowth - assumptions.growthRate).toFixed(2)}% more growth than your assumption.
                        </p>
                      ) : impliedGrowth < assumptions.growthRate - 0.1 ? (
                        <p className="text-[10px] text-[#4CAF85] leading-relaxed" style={mono}>
                          ▼ Market prices in {(assumptions.growthRate - impliedGrowth).toFixed(2)}% less — if you're right, it's undervalued.
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#C9A84C] leading-relaxed" style={mono}>≈ Market is pricing in roughly your assumed growth rate.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-[#4A6070]" style={mono}>No solution in range.</p>
                )}
              </div>
            )}

            {!invalid && (
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Enterprise Value', value: fmtB(enterpriseValue) },
                  { label: 'Equity Value',      value: fmtB(equityValue)     },
                  { label: 'FCF PV Sum',        value: fmtB(sumPVs),   sub: totalPV !== 0 ? `${fmtPct((sumPVs / totalPV) * 100)} of EV` : '' },
                  { label: 'Terminal PV',       value: fmtB(terminalPV), sub: totalPV !== 0 ? `${fmtPct((terminalPV / totalPV) * 100)} of EV` : '', accent: true },
                ].map(m => (
                  <div key={m.label} className="border border-[#1A2840] rounded-xl bg-[#0A1628]/40 px-4 py-3">
                    <p className="text-[9px] tracking-[0.12em] uppercase text-[#4A6070] mb-1.5" style={mono}>{m.label}</p>
                    <p className={`text-[15px] font-medium ${m.accent ? 'text-[#C9A84C]' : 'text-[#EDE8DF]'}`} style={sans}>{m.value}</p>
                    {m.sub && <p className="text-[10px] text-[#4A6070] mt-0.5" style={mono}>{m.sub}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SensitivityTable
            growthRates={growthRates}
            waccs={waccs}
            grid={grid}
            assumptions={assumptions}
            marketPrice={marketPrice}
            rateLabel={assumptions.mode === 'FCFE' ? 'Ke' : 'WACC'}
          />
          <PVWaterfall
            pvs={pvs}
            terminalPV={terminalPV}
            assumptions={assumptions}
            hasNegFCF={hasNegFCF}
          />
        </div>
      </div>

      {financials && (
        <AIDrawer
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          symbol={symbol!}
          financials={financials}
          assumptions={assumptions}
          intrinsic={invalid ? 0 : intrinsic}
          impliedGrowth={impliedGrowth}
          onApply={applyAISuggestion}
        />
      )}
    </div>
  )
}