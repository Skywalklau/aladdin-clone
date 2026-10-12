import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPortfolio } from '../api/portfolio'
import type { PortfolioSummary } from '../types'
import MarketIndices from '../components/MarketIndices'
import { mono, serif, sans } from '../lib/trading'
import { formatCurrency, formatPercent } from '../lib/formatters'

const getPnlPercent = (pnl: number, avgPrice: number, quantity: number) =>
  (pnl / (avgPrice * quantity))

const ANALYSIS_TOOLS = [
  {
    key:    'risk',
    label:  'Risk Analysis',
    desc:   'VaR · Beta · Sharpe ratio · Volatility · Correlation matrix',
    path:   (id: string) => `/portfolio/${id}/risk`,
    accent: '#C9A84C',
    icon:   '▲',
  },
  {
    key:    'stress',
    label:  'Stress Testing',
    desc:   'Market crash · Sector shock · Rate shock · Historical crises · Reverse stress',
    path:   (id: string) => `/portfolio/${id}/stress`,
    accent: '#E07B52',
    icon:   '◈',
  },
  {
    key:    'insights',
    label:  'AI Insights',
    desc:   'News sentiment · Per-stock analysis · Portfolio-level narrative',
    path:   (id: string) => `/portfolio/${id}/insights`,
    accent: '#7A9AB8',
    icon:   '◎',
  },
  {
    key:    'search',
    label:  'Search Stocks',
    desc:   'Stock screener · Real-time quotes · Technical charts · Fundamentals',
    path:   () => '/search',
    accent: '#52A8A8',
    icon:   '◉',
  },
]

export default function PortfolioDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const fetchPortfolio = useCallback(async (portfolioId: number) => {
    try {
      const data = await getPortfolio(portfolioId)
      setPortfolio(data)
    } catch {
      setError('Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    const portfolioId = parseInt(id)
    fetchPortfolio(portfolioId)
    const interval = setInterval(() => fetchPortfolio(portfolioId), 60_000)
    return () => clearInterval(interval)
  }, [id, fetchPortfolio])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');`}</style>
        <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-7 h-7 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>Loading...</p>
          </div>
        </div>
      </>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !portfolio) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');`}</style>
        <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
          <div className="text-center">
            <p className="text-[#E05252] text-[11px] tracking-[0.15em] uppercase mb-4" style={mono}>
              ⚠ {error || 'Portfolio not found'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors"
              style={mono}>
              ← Back to portfolios
            </button>
          </div>
        </div>
      </>
    )
  }

  const totalCost       = portfolio.positions.reduce((sum, p) => sum + p.avg_price * p.quantity, 0)
  const totalPnlPercent = (portfolio.total_pnl / totalCost)
  const dailyPnlPct     = (portfolio.total_daily_pnl / (portfolio.total_value - portfolio.total_daily_pnl))

  const SUMMARY_CARDS = [
    { label: 'Market Value', value: formatCurrency(portfolio.total_value),     pnl: false },
    { label: 'Total Cost',   value: formatCurrency(totalCost),                  pnl: false },
    { label: 'Total P&L',    value: formatCurrency(portfolio.total_pnl),        pnl: true, positive: portfolio.total_pnl >= 0 },
    { label: 'Total Return', value: formatPercent(totalPnlPercent),             pnl: true, positive: totalPnlPercent >= 0 },
    { label: "Today's P&L",  value: formatCurrency(portfolio.total_daily_pnl),  pnl: true, positive: portfolio.total_daily_pnl >= 0 },
    { label: "Today's Move", value: formatPercent(dailyPnlPct),                 pnl: true, positive: dailyPnlPct >= 0 },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

        {/* ── NAVBAR ── */}
        <nav className="border-b border-[#B8943C]/10 px-10 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#020810]/95 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors"
              style={mono}>
              ← Back
            </button>
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <span className="text-[22px] font-bold" style={serif}>
              Ala<span className="text-[#C9A84C]">ddin</span>
            </span>
          </div>
          <MarketIndices />
        </nav>

        <div className="max-w-6xl mx-auto px-8 py-10">

          {/* ── PAGE HEADER ── */}
          <div className="mb-8 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.05s_forwards]">
            <p className="text-[10px] tracking-[0.24em] text-[#B8943C] uppercase mb-2" style={mono}>
              Portfolio Overview
            </p>
            <h1 className="text-[36px] font-semibold leading-tight" style={serif}>
              {portfolio.positions.length} Position{portfolio.positions.length !== 1 ? 's' : ''}
            </h1>
            <p className="text-[12px] text-[#8BA4BE] mt-1.5 font-light">
              Live market data · P&L at current prices
            </p>
          </div>

          {/* ── SUMMARY CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.12s_forwards]">
            {SUMMARY_CARDS.map(({ label, value, pnl, positive }) => (
              <div key={label}
                className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 hover:border-[#B8943C]/20 transition-colors">
                <p className="text-[9px] tracking-[0.18em] uppercase text-[#8BA4BE] mb-2" style={mono}>
                  {label}
                </p>
                <p className={`text-[18px] font-semibold tracking-tight ${
                  pnl ? (positive ? 'text-[#4CAF85]' : 'text-[#E05252]') : 'text-[#EDE8DF]'
                }`} style={sans}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* ── ANALYSIS TOOLS ── */}
          <div className="mb-10 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.2s_forwards]">
            <p className="text-[10px] tracking-[0.22em] text-[#8BA4BE] uppercase mb-3" style={mono}>
              Analysis Tools
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ANALYSIS_TOOLS.map(({ key, label, desc, path, accent, icon }) => (
                <button
                  key={key}
                  onClick={() => navigate(path(id!))}
                  className="group text-left rounded-xl bg-[#020810]/60 px-5 py-4 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer hover:bg-[#0F1E35]"
                  style={{ border: `1px solid ${accent}25`, boxShadow: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${accent}60`; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${accent}12` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${accent}25`; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px]" style={{ ...mono, color: accent }}>{icon}</span>
                      <span className="text-[12px] font-medium text-[#EDE8DF]" style={mono}>{label}</span>
                    </div>
                    <span className="text-[#8BA4BE]/40 group-hover:text-[#8BA4BE] transition-colors text-[14px]">→</span>
                  </div>
                  <p className="text-[10px] text-[#8BA4BE] leading-relaxed font-light">{desc}</p>
                  <div className="mt-3 h-px w-0 group-hover:w-full transition-all duration-300 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${accent}60, transparent)` }} />
                </button>
              ))}
            </div>
          </div>

          {/* ── POSITIONS TABLE ── */}
          <div className="border border-[#B8943C]/10 rounded-xl overflow-hidden opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.3s_forwards]">
            <div className="px-6 py-4 border-b border-[#B8943C]/10 flex items-center justify-between bg-[#020810]/80">
              <span className="text-[11px] tracking-[0.18em] uppercase text-[#8BA4BE]" style={mono}>
                Positions
              </span>
              <span className="text-[10px] text-[#2E4460]" style={mono}>
                {portfolio.positions.length} holdings
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#B8943C]/8">
                    {['Symbol', 'Qty', 'Avg Price', 'Current', 'Mkt Value', 'P&L', 'Return', 'Day P&L', 'Weight'].map((col, i) => (
                      <th key={col}
                        className={`py-3 px-4 text-[9px] tracking-[0.15em] uppercase text-[#8BA4BE] font-normal ${i === 0 ? 'text-left' : 'text-right'}`}
                        style={mono}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {portfolio.positions.map((position, i) => {
                    const pnlPct = getPnlPercent(position.pnl, position.avg_price, position.quantity)
                    const isPos  = position.pnl >= 0
                    return (
                      <tr
                        key={position.symbol}
                        onClick={() => navigate(`/portfolio/${id}/stock/${position.symbol}`)}
                        className="border-b border-[#B8943C]/5 cursor-pointer transition-all duration-150 opacity-0 translate-y-1
                          hover:bg-[#0F1E35] hover:border-[#B8943C]/20"
                        style={{ animation: `fadeUp 0.4s ${0.35 + i * 0.04}s forwards` }}>

                        {/* Symbol */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-md border border-[#B8943C]/15 flex items-center justify-center flex-shrink-0 bg-[#0A1628]/60">
                              <span className="text-[9px] font-medium text-[#C9A84C]" style={mono}>
                                {position.symbol.slice(0, 2)}
                              </span>
                            </div>
                            <span className="text-[13px] font-medium text-[#EDE8DF]" style={mono}>
                              {position.symbol}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right text-[12px] text-[#8BA4BE]" style={sans}>
                          {position.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[12px] text-[#8BA4BE]" style={sans}>
                          {formatCurrency(position.avg_price)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[12px] text-[#EDE8DF]" style={sans}>
                          {formatCurrency(position.current_price)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[12px] text-[#EDE8DF]" style={sans}>
                          {formatCurrency(position.market_value)}
                        </td>
                        <td className={`px-4 py-3.5 text-right text-[12px] font-medium ${isPos ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={sans}>
                          {formatCurrency(position.pnl)}
                        </td>
                        <td className={`px-4 py-3.5 text-right text-[12px] font-medium ${pnlPct >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={sans}>
                          {formatPercent(pnlPct)}
                        </td>
                        <td className={`px-4 py-3.5 text-right text-[12px] font-medium ${position.daily_pnl >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={sans}>
                          <div>{formatCurrency(position.daily_pnl)}</div>
                          <div className="text-[10px] opacity-70">{formatPercent(position.daily_pnl_pct)}</div>
                        </td>

                        {/* Weight with bar */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-10 h-1 bg-[#0A1628] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width:      `${Math.min(position.allocation_pct, 100)}%`,
                                  background: 'linear-gradient(90deg, #C9A84C80, #C9A84C40)',
                                }} />
                            </div>
                            <span className="text-[11px] text-[#8BA4BE]" style={sans}>
                              {position.allocation_pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Footer totals */}
                <tfoot>
                  <tr className="border-t border-[#B8943C]/15 bg-[#020810]/60">
                    <td className="px-4 py-4 text-[10px] tracking-[0.12em] uppercase text-[#8BA4BE]" style={mono} colSpan={4}>
                      Total
                    </td>
                    <td className="px-4 py-4 text-right text-[13px] font-semibold text-[#EDE8DF]" style={sans}>
                      {formatCurrency(portfolio.total_value)}
                    </td>
                    <td className={`px-4 py-4 text-right text-[13px] font-semibold ${portfolio.total_pnl >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={sans}>
                      {formatCurrency(portfolio.total_pnl)}
                    </td>
                    <td className={`px-4 py-4 text-right text-[13px] font-semibold ${totalPnlPercent >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={sans}>
                      {formatPercent(totalPnlPercent)}
                    </td>
                    <td className={`px-4 py-4 text-right text-[13px] font-semibold ${portfolio.total_daily_pnl >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={sans}>
                      <div>{formatCurrency(portfolio.total_daily_pnl)}</div>
                      <div className="text-[10px] opacity-70">{formatPercent(dailyPnlPct)}</div>
                    </td>
                    <td className="px-4 py-4 text-right text-[11px] text-[#8BA4BE]" style={sans}>
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}