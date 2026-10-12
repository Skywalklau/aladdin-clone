import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { CompData, HistPoint, SelectedBar, BarAnalysis, ChartEntry, DivRow } from '../types/index'
import MarketIndices from '../components/MarketIndices'
import BarChart        from '../components/financials/BarChart'
import StackedBarChart from '../components/financials/StackedBarChart'
import ChartCard       from '../components/financials/ChartCard'
import ExpandedModal   from '../components/financials/ExpandedModal'
import KPISummary      from '../components/financials/KPISummary'
import ValuationTab    from '../components/financials/ValuationTab'
import AnalysisPanel   from '../components/financials/AnalysisPanel'
import { mono, serif, sans } from '../lib/trading'
import { fmtB, fmtDollar } from '../lib/formatters'
import { incomePoints, cashPoints, balPoints, latestBadge } from '../lib/financials'

const TABS = ['overview', 'income', 'cashflow', 'balance', 'valuation'] as const
type Tab = typeof TABS[number]

export default function Financials() {
  const { id, symbol } = useParams<{ id?: string; symbol: string }>()
  const navigate = useNavigate()

  const [data,      setData]      = useState<CompData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [period,    setPeriod]    = useState<'annual' | 'quarterly'>('annual')
  const [tab,       setTab]       = useState<Tab>('overview')
  const [selected,  setSelected]  = useState<SelectedBar | null>(null)
  const [analysis,  setAnalysis]  = useState<BarAnalysis | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetch(`/api/stocks/${symbol}/comprehensive`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => setData(d))
      .catch(() => setError('Failed to load financial data'))
      .finally(() => setLoading(false))
  }, [symbol])

  // ── AI bar-click analysis ─────────────────────────────────────────────────
  const handleBarClick = useCallback(async (
    metric: string, label: string, color: string,
    point: HistPoint, history: HistPoint[],
  ) => {
    if (selected?.metric === metric && selected.period === point.period) {
      setSelected(null); setAnalysis(null); return
    }
    setSelected({ metric, period: point.period, value: point.value, history, label, color })
    setAnalysis(null); setAnalysing(true)
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    try {
      const res = await fetch(`/api/stocks/${symbol}/period-analysis`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  abortRef.current.signal,
        body: JSON.stringify({
          company_name:  data?.company_name || symbol,
          metric, period: point.period, value: point.value, history,
          current_price: data?.current_price,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setAnalysis(await res.json())
    } catch (e: any) {
      if (e.name !== 'AbortError') setAnalysis(null)
    } finally {
      setAnalysing(false)
    }
  }, [data, selected, symbol])

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-6 h-6 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#4A6070]" style={mono}>
          Loading financials…
        </p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
      <p className="text-[#E05252] text-[11px]" style={mono}>⚠ {error || 'No data'}</p>
    </div>
  )

  // ── Derive data arrays ────────────────────────────────────────────────────
  const inc  = period === 'quarterly' ? data.income_quarterly   : data.income_annual
  const cash = period === 'quarterly' ? data.cashflow_quarterly : data.cashflow_annual
  const bal  = period === 'quarterly' ? data.balance_quarterly  : data.balance_annual

  const revPts  = incomePoints(inc, 'revenue')
  const gpPts   = incomePoints(inc, 'gross_profit')
  const oiPts   = incomePoints(inc, 'operating_income')
  const ebPts   = incomePoints(inc, 'ebitda')
  const niPts   = incomePoints(inc, 'net_income')
  const epsPts  = incomePoints(inc, 'eps_diluted', 1)
  const rdPts   = incomePoints(inc, 'rd_expense')
  const sgaPts  = incomePoints(inc, 'sga_expense')
  const deprPts = incomePoints(inc, 'depreciation')

  const ocfPts = cashPoints(cash, 'operating_cf')
  const fcfPts = cashPoints(cash, 'fcf')
  const capPts = cashPoints(cash, 'capex')
  const sbcPts = cashPoints(cash, 'sbc')
  const buyPts = cashPoints(cash, 'buybacks')
  const divPts = cashPoints(cash, 'dividends_paid')
  const fadPts = cashPoints(cash, 'fcf_adj')

  const div  = period === 'quarterly' ? data.dividend_quarterly : data.dividend_annual
  const divPoints = (rows: DivRow[], key: keyof DivRow): HistPoint[] =>
    rows.filter(r => r[key] != null).map(r => ({ period: r.period, value: r[key] as number }))
  const dpsPts        = divPoints(div, 'dps')
  const payoutPts     = divPoints(div, 'payout_ratio')
  const divYieldPts   = divPoints(div, 'div_yield')

  const cshPts = balPoints(bal, 'cash')
  const dbtPts = balPoints(bal, 'total_debt')
  const ncPts  = balPoints(bal, 'net_cash')
  const taPts  = balPoints(bal, 'total_assets')
  const tePts  = balPoints(bal, 'total_equity')
  const rePts  = balPoints(bal, 'retained_earnings')

  const L = (pts: HistPoint[]) => pts.length ? pts[pts.length - 1].value : undefined

  // ── Chart definitions per tab ─────────────────────────────────────────────
  const getCharts = (): ChartEntry[] => {
    if (tab === 'overview') return [
      { key: 'revenue',          label: 'Revenue',          color: '#C9A84C', pts: revPts,  format: fmtB },
      { key: 'net_income',       label: 'Net Income',       color: '#4CAF85', pts: niPts,   format: fmtB, negColor: '#E05252' },
      { key: 'fcf',              label: 'Free Cash Flow',   color: '#6DBF95', pts: fcfPts,  format: fmtB, negColor: '#E05252' },
      { key: 'ebitda',           label: 'EBITDA',           color: '#7A9AB8', pts: ebPts,   format: fmtB },
      { key: 'gross_profit',     label: 'Gross Profit',     color: '#A87AB8', pts: gpPts,   format: fmtB },
      { key: 'operating_income', label: 'Operating Income', color: '#E07B52', pts: oiPts,   format: fmtB, negColor: '#E05252' },
      { key: 'eps_diluted',      label: 'EPS Diluted',      color: '#D4B896', pts: epsPts,  format: fmtDollar },
      { key: 'cash_debt',        label: 'Cash & Debt',      color: '#4CAF85', pts: [],      special: 'cashdebt', balData: bal },
    ]
    if (tab === 'income') return [
      { key: 'revenue',          label: 'Revenue',          color: '#C9A84C', pts: revPts,  format: fmtB },
      { key: 'gross_profit',     label: 'Gross Profit',     color: '#A87AB8', pts: gpPts,   format: fmtB },
      { key: 'operating_income', label: 'Operating Income', color: '#E07B52', pts: oiPts,   format: fmtB, negColor: '#E05252' },
      { key: 'ebitda',           label: 'EBITDA',           color: '#7A9AB8', pts: ebPts,   format: fmtB },
      { key: 'net_income',       label: 'Net Income',       color: '#4CAF85', pts: niPts,   format: fmtB, negColor: '#E05252' },
      { key: 'eps_diluted',      label: 'EPS Diluted',      color: '#D4B896', pts: epsPts,  format: fmtDollar },
      { key: 'rd_expense',       label: 'R&D Expense',      color: '#9AB87A', pts: rdPts,   format: fmtB },
      { key: 'sga_expense',      label: 'SG&A Expense',     color: '#B87A9A', pts: sgaPts,  format: fmtB },
      { key: 'depreciation',     label: 'D&A',              color: '#7AB8B8', pts: deprPts, format: fmtB },
      { key: 'gross_margin',     label: 'Gross Margin',     color: '#A87AB8', pts: incomePoints(inc, 'gross_margin', 1),     format: v => `${v.toFixed(1)}%` },
      { key: 'operating_margin', label: 'Operating Margin', color: '#E07B52', pts: incomePoints(inc, 'operating_margin', 1), format: v => `${v.toFixed(1)}%`, negColor: '#E05252' },
      { key: 'net_margin',       label: 'Net Margin',       color: '#4CAF85', pts: incomePoints(inc, 'net_margin', 1),       format: v => `${v.toFixed(1)}%`, negColor: '#E05252' },
      { key: 'ebitda_margin',    label: 'EBITDA Margin',    color: '#7A9AB8', pts: incomePoints(inc, 'ebitda_margin', 1),    format: v => `${v.toFixed(1)}%` },
    ]
    if (tab === 'cashflow') return [
      { key: 'operating_cf',   label: 'Operating Cash Flow', color: '#5B8FB9', pts: ocfPts, format: fmtB },
      { key: 'capex',          label: 'Capital Expenditure', color: '#E05252', pts: capPts, format: fmtB },
      { key: 'fcf',            label: 'Free Cash Flow',      color: '#4CAF85', pts: fcfPts, format: fmtB, negColor: '#E05252' },
      { key: 'fcf_adj',        label: 'SBC-Adj FCF',         color: '#6DBF95', pts: fadPts, format: fmtB, negColor: '#E05252' },
      { key: 'sbc',            label: 'Stock-Based Comp',    color: '#C9A84C', pts: sbcPts, format: fmtB },
      { key: 'buybacks',       label: 'Share Buybacks',      color: '#7AB8A8', pts: buyPts, format: fmtB },
      { key: 'dividends_paid', label: 'Dividends Paid',      color: '#B8A87A', pts: divPts,      format: fmtB },
      { key: 'dps',            label: 'Dividend Per Share',  color: '#C9A84C', pts: dpsPts,      format: v => '$' + v.toFixed(2) },
      { key: 'div_yield',      label: 'Dividend Yield',      color: '#E8C97A', pts: divYieldPts, format: v => v.toFixed(2) + '%' },
      { key: 'payout_ratio',   label: 'Payout Ratio',        color: '#D4B896', pts: payoutPts,   format: v => v.toFixed(1) + '%' },
    ]
    if (tab === 'balance') return [
      { key: 'cash',              label: 'Cash & Equivalents',   color: '#4CAF85', pts: cshPts, format: fmtB },
      { key: 'total_debt',        label: 'Total Debt',           color: '#E05252', pts: dbtPts, format: fmtB },
      { key: 'net_cash',          label: 'Net Cash / Debt',      color: '#7AB8A8', pts: ncPts,  format: fmtB, negColor: '#E05252' },
      { key: 'cash_debt',         label: 'Cash vs Debt',         color: '#4CAF85', pts: [],     special: 'cashdebt', balData: bal },
      { key: 'total_assets',      label: 'Total Assets',         color: '#7A9AB8', pts: taPts,  format: fmtB },
      { key: 'total_equity',      label: 'Shareholders Equity',  color: '#A87AB8', pts: tePts,  format: fmtB, negColor: '#E05252' },
      { key: 'retained_earnings', label: 'Retained Earnings',    color: '#D4B896', pts: rePts,  format: fmtB, negColor: '#E05252' },
    ]
    return []
  }

  const charts = getCharts()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

      {/* ── Nav ── */}
      <nav className="border-b border-[#1A2840] px-8 py-4 flex items-center gap-4 sticky top-0 z-50 bg-[#020810]/96 backdrop-blur-md">
        <button
          onClick={() => navigate(id ? `/portfolio/${id}/stock/${symbol}` : `/stock/${symbol}`)}
          className="text-[10px] tracking-[0.10em] uppercase text-[#4A6070] hover:text-[#EDE8DF] transition-colors flex items-center gap-1.5"
          style={mono}
        >
          ← Back
        </button>
        <div className="w-px h-4 bg-[#1A2840]" />
        <button onClick={() => navigate('/')} className="text-[17px] font-bold hover:opacity-80 transition-opacity" style={serif}>
          Ala<span className="text-[#C9A84C]">ddin</span>
        </button>
        <div className="flex-1" />
        <MarketIndices />
      </nav>

      {/* ── Header ── */}
      <div className="border-b border-[#1A2840] px-8 py-4">
        <div className="max-w-[1400px] mx-auto flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p className="text-[9px] tracking-[0.18em] uppercase text-[#C9A84C]" style={mono}>
                {symbol} · {data.exchange || 'NASDAQ'}
              </p>
              {data.summary.sector   && <p className="text-[9px] text-[#7A96B4]" style={mono}>{data.summary.sector}</p>}
              {data.summary.industry && <p className="text-[9px] text-[#7A96B4]" style={mono}>· {data.summary.industry}</p>}
            </div>
            <h1 className="text-[22px] font-semibold leading-tight" style={serif}>{data.company_name}</h1>
            {data.summary.employees && (
              <p className="text-[9px] text-[#7A96B4] mt-1" style={mono}>
                {data.summary.employees.toLocaleString()} employees · Click any bar for AI analysis
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[9px] text-[#4A6070] mb-1" style={mono}>Current Price</p>
            <p className="text-[22px] font-medium" style={{ ...serif, color: '#8BA4BE' }}>
              ${data.current_price?.toFixed(2) ?? '—'}
            </p>
            <p className="text-[9px] text-[#4A6070] mt-0.5" style={mono}>{data.currency}</p>
          </div>
        </div>
      </div>

      {/* ── KPI Summary ── */}
      <KPISummary s={data.summary} />

      {/* ── Tab + Period Controls ── */}
      <div className="border-b border-[#1A2840] px-8 py-3 sticky top-[57px] z-40 bg-[#020810]/96 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t}
                onClick={() => { setTab(t); setSelected(null); setAnalysis(null) }}
                className="px-3.5 py-1.5 rounded-lg text-[10px] tracking-[0.10em] uppercase transition-all duration-150"
                style={{
                  ...mono,
                  background: tab === t ? '#C9A84C15' : 'transparent',
                  border:     `1px solid ${tab === t ? '#C9A84C40' : 'transparent'}`,
                  color:      tab === t ? '#C9A84C'   : '#4A6070',
                }}>
                {t === 'cashflow' ? 'Cash Flow' : t === 'balance' ? 'Balance Sheet' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab !== 'valuation' && (
            <div className="flex gap-1 p-0.5 rounded-lg"
              style={{ background: '#0A1628', border: '1px solid #1A2840' }}>
              {(['annual', 'quarterly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-3.5 py-1.5 rounded-md text-[10px] tracking-[0.08em] uppercase transition-all duration-150"
                  style={{
                    ...mono,
                    background: period === p ? '#1A2840' : 'transparent',
                    color:      period === p ? '#EDE8DF' : '#4A6070',
                  }}>
                  {p === 'annual' ? 'Annual' : 'Quarterly'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {tab === 'valuation' ? (
          <ValuationTab s={data.summary} price={data.current_price} />
        ) : (
          <div className="flex gap-5">
            <div className="flex-1 min-w-0 transition-all duration-300">
              <div className="grid gap-4" style={{
                gridTemplateColumns: selected ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
              }}>
                {charts.map(c => {
                  if (c.special === 'cashdebt') {
                    const { badge, up } = latestBadge(cshPts)
                    const ncHistory     = ncPts.length ? ncPts : balPoints(bal, 'net_cash')
                    return (
                      <ChartCard key="cashdebt" title="Cash & Debt" color="#4CAF85"
                        latest={L(cshPts) != null ? fmtB(L(cshPts)!) : '—'}
                        badge={badge} badgeUp={up} chartHeight={110}
                        isActive={selected?.metric === 'cash_debt'}
                        subtitle="Green = Cash · Red = Debt · Tan = Capital Lease"
                        onExpand={() => setExpanded('cashdebt')}>
                        <StackedBarChart data={bal} onSelect={d => {
                          const value = (d.net_cash ?? 0) / 1e9
                          handleBarClick('cash_debt', 'Cash & Debt (Net Position)', '#4CAF85',
                            { period: d.period, value }, ncHistory)
                        }} />
                      </ChartCard>
                    )
                  }

                  if (!c.pts.length) return null
                  const { badge, up } = latestBadge(c.pts)
                  const latestV       = L(c.pts)
                  const fmt           = c.format || fmtB

                  return (
                    <ChartCard key={c.key} title={c.label} color={c.color}
                      latest={latestV != null ? fmt(latestV) : '—'}
                      badge={badge} badgeUp={up}
                      isActive={selected?.metric === c.key}
                      onExpand={() => setExpanded(c.key)}
                      chartHeight={110}>
                      <BarChart
                        data={c.pts}
                        color={c.color}
                        negColor={c.negColor}
                        selectedPeriod={selected?.metric === c.key ? selected.period : null}
                        onSelect={p => handleBarClick(c.key, c.label, c.color, p, c.pts)}
                        format={fmt}
                      />
                    </ChartCard>
                  )
                })}
              </div>

              {!selected && (
                <div className="mt-4 border border-[#1A2840] rounded-xl px-5 py-3">
                  <p className="text-[9px] text-[#2E4460]" style={mono}>
                    ▣ Click any card to expand · Click any bar for AI-powered period analysis
                  </p>
                </div>
              )}
            </div>

            {selected && (
              <div className="flex-shrink-0 transition-all duration-300" style={{ width: 320 }}>
                <AnalysisPanel
                  selected={selected}
                  analysis={analysis}
                  loading={analysing}
                  onClose={() => { setSelected(null); setAnalysis(null) }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Expanded Chart Modal ── */}
      {expanded && (() => {
        if (expanded === 'cashdebt') {
          const { badge, up } = latestBadge(cshPts)
          return (
            <ExpandedModal title="Cash & Debt" color="#4CAF85"
              latest={L(cshPts) != null ? fmtB(L(cshPts)!) : '—'}
              badge={badge} badgeUp={up} onClose={() => setExpanded(null)}>
              <StackedBarChart data={bal} onSelect={d => {
                setExpanded(null)
                const value = (d.net_cash ?? 0) / 1e9
                handleBarClick('cash_debt', 'Cash & Debt (Net Position)', '#4CAF85',
                  { period: d.period, value }, ncPts)
              }} />
            </ExpandedModal>
          )
        }
        const c = charts.find(ch => ch.key === expanded)
        if (!c || !c.pts.length) return null
        const { badge, up } = latestBadge(c.pts)
        const fmt = c.format || fmtB
        return (
          <ExpandedModal title={c.label} color={c.color}
            latest={L(c.pts) != null ? fmt(L(c.pts)!) : '—'}
            badge={badge} badgeUp={up} onClose={() => setExpanded(null)}>
            <BarChart data={c.pts} color={c.color} negColor={c.negColor}
              selectedPeriod={null}
              onSelect={p => { setExpanded(null); handleBarClick(c.key, c.label, c.color, p, c.pts) }}
              format={fmt} />
          </ExpandedModal>
        )
      })()}

    </div>
  )
}