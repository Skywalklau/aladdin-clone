import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createChart, CandlestickSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import type { ISeriesApi } from 'lightweight-charts'
import type { Quote, Profile, StockCandle, RangeLabel, CandleSize } from '../types/index'
import MarketIndices from '../components/MarketIndices'
import { mono, serif, sans } from '../lib/trading'
import { formatCurrency as fmt, fmtBigCap as fmtB, fmtPctSigned as fmtPct } from '../lib/formatters'
import { FIXED_RANGES, defaultCandleSize, fetchCandles } from '../lib/stockChart'

export default function StockDetail() {
  // id is optional — undefined when accessed via /stock/:symbol (standalone mode)
  const { id, symbol } = useParams<{ id?: string; symbol: string }>()
  const navigate = useNavigate()

  const [quote,          setQuote]          = useState<Quote | null>(null)
  const [profile,        setProfile]        = useState<Profile | null>(null)
  const [candles,        setCandles]        = useState<StockCandle[]>([])
  const [range,          setRange]          = useState<RangeLabel>('3M')
  const [candleSize,     setCandleSize]     = useState<CandleSize>('D')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [incompleteData, setIncompleteData] = useState(false)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const seriesRef         = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const chartRef          = useRef<ReturnType<typeof createChart> | null>(null)

  // ── Navigation helpers ────────────────────────────────────────────────────
  const backPath = id ? `/portfolio/${id}` : '/search'
  const dcfPath  = id ? `/portfolio/${id}/stock/${symbol}/dcf`       : `/stock/${symbol}/dcf`
  const finPath  = id ? `/portfolio/${id}/stock/${symbol}/financials` : `/stock/${symbol}/financials`

  // ── 1. Fetch quote + profile + initial candles ────────────────────────────
  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    Promise.all([
      fetch(`/api/stocks/${symbol}/quote`).then(r => r.json()),
      fetch(`/api/stocks/${symbol}/profile`).then(r => r.json()),
    ])
      .then(async ([q, p]) => {
        setQuote(q)
        setProfile(p)
        const { candles: c, isIncomplete } = await fetchCandles(symbol, '3M', 'D', p.ipo ?? '')
        setCandles(c)
        setIncompleteData(isIncomplete)
      })
      .catch(() => setError('Failed to load stock data'))
      .finally(() => setLoading(false))
  }, [symbol])

  // ── 2. Init chart after data loads ────────────────────────────────────────
  useEffect(() => {
    if (loading || !chartContainerRef.current || chartRef.current) return

    const el    = chartContainerRef.current
    const chart = createChart(el, {
      layout: {
        background:  { type: ColorType.Solid, color: 'transparent' },
        textColor:   '#8BA4BE',
        fontFamily:  "'IBM Plex Mono', monospace",
        fontSize:    10,
      },
      grid: {
        vertLines: { color: '#B8943C08' },
        horzLines: { color: '#B8943C08' },
      },
      crosshair: {
        mode:     CrosshairMode.Normal,
        vertLine: { color: '#C9A84C40', labelBackgroundColor: '#0A1628' },
        horzLine: { color: '#C9A84C40', labelBackgroundColor: '#0A1628' },
      },
      rightPriceScale: {
        borderColor:  '#B8943C15',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor:                   '#B8943C15',
        timeVisible:                   false,
        fixLeftEdge:                   true,
        fixRightEdge:                  true,
        lockVisibleTimeRangeOnResize:  true,
      },
      width:  el.clientWidth,
      height: 380,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor:       '#4CAF85',
      downColor:     '#E05252',
      borderVisible: false,
      wickUpColor:   '#4CAF8590',
      wickDownColor: '#E0525290',
    })

    chartRef.current  = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  }, [loading])

  // ── 3. Push candles into series ───────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return
    seriesRef.current.setData(candles as any)
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  // ── 4. Re-fetch on range or candle size change ────────────────────────────
  useEffect(() => {
    if (!symbol || loading || !profile) return
    fetchCandles(symbol, range, candleSize, profile.ipo ?? '').then(
      ({ candles: c, isIncomplete }) => {
        setCandles(c)
        setIncompleteData(isIncomplete)
      }
    )
  }, [range, candleSize])

  const handleRangeChange = (r: RangeLabel) => {
    setRange(r)
    setCandleSize(defaultCandleSize(r))
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-7 h-7 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>Loading...</p>
      </div>
    </div>
  )

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !quote || !profile) return (
    <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
      <div className="text-center">
        <p className="text-[#E05252] text-[11px] tracking-[0.15em] uppercase mb-4" style={mono}>
          ⚠ {error || 'Stock not found'}
        </p>
        <button onClick={() => navigate(backPath)}
          className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors"
          style={mono}>← Back</button>
      </div>
    </div>
  )

  const isPositive = quote.dp >= 0

  return (
    <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

      {/* ── NAVBAR ── */}
      <nav className="border-b border-[#B8943C]/10 px-10 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#020810]/95 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(backPath)}
            className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors"
            style={mono}>← Back</button>
          <div className="w-px h-4 bg-[#B8943C]/20" />
          <button onClick={() => navigate('/')} className="text-[22px] font-bold hover:opacity-80 transition-opacity" style={serif}>
            Ala<span className="text-[#C9A84C]">ddin</span>
          </button>
        </div>
        <MarketIndices />
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between mb-8 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.05s_forwards]">
          <div className="flex items-center gap-5">
            {profile.logo && (
              <div className="w-12 h-12 rounded-xl border border-[#B8943C]/15 bg-white/5 flex items-center justify-center flex-shrink-0">
                <img src={profile.logo} alt={profile.name} className="w-8 h-8 object-contain"
                  onError={e => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
            <div>
              <p className="text-[10px] tracking-[0.24em] text-[#B8943C] uppercase mb-1" style={mono}>
                {symbol} · {profile.finnhubIndustry}
              </p>
              <h1 className="text-[32px] font-semibold leading-tight" style={serif}>
                {profile.name || symbol}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[34px] font-semibold" style={{ ...sans, letterSpacing: '-0.02em' }}>
              {fmt(quote.c)}
            </p>
            <p className={`text-[14px] font-medium mt-0.5 ${isPositive ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>
              {isPositive ? '▲' : '▼'} {fmt(Math.abs(quote.d))} ({fmtPct(quote.dp)})
            </p>
          </div>
        </div>

        {/* ── CHART ── */}
        <div className="border border-[#B8943C]/10 rounded-xl mb-6 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.12s_forwards]">
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#B8943C]/10 bg-[#020810]/80 rounded-t-xl">
            <div className="flex items-center gap-1">
              {(['D', 'W', 'M'] as CandleSize[]).map(s => (
                <button key={s} onClick={() => setCandleSize(s)}
                  className={`px-3 py-1 rounded-md text-[10px] tracking-[0.12em] transition-all cursor-pointer ${
                    candleSize === s
                      ? 'bg-[#7A9AB8]/15 text-[#7A9AB8] border border-[#7A9AB8]/30'
                      : 'text-[#8BA4BE] hover:text-[#EDE8DF] border border-transparent'
                  }`}
                  style={mono}>
                  {s === 'D' ? 'Daily' : s === 'W' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {FIXED_RANGES.map(r => (
                <button key={r} onClick={() => handleRangeChange(r)}
                  className={`px-3 py-1 rounded-md text-[10px] tracking-[0.12em] transition-all cursor-pointer ${
                    range === r
                      ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30'
                      : 'text-[#8BA4BE] hover:text-[#EDE8DF] border border-transparent'
                  }`}
                  style={mono}>{r}</button>
              ))}
            </div>
          </div>

          {/* ── Incomplete data banner ── */}
          {incompleteData && (
            <div
              className="flex items-center gap-2.5 px-6 py-2.5 border-b border-[#B8943C]/10"
              style={{ background: 'rgba(184, 148, 60, 0.04)' }}
            >
              <span className="text-[#C9A84C] text-[12px] flex-shrink-0">⚠</span>
              <p className="text-[10px] tracking-[0.08em] text-[#B8943C] leading-relaxed" style={mono}>
                Full candlestick history unavailable — chart displays the earliest data the provider holds,
                which may not extend back to the IPO date.
              </p>
            </div>
          )}

          <div className="bg-[#020810]/40 rounded-b-xl">
            <div ref={chartContainerRef} style={{ width: '100%', height: '380px' }} />
          </div>
        </div>

        {/* ── STATS + TOOL CARDS ── */}
        <div className="grid grid-cols-4 gap-3 mb-6 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.2s_forwards]">

          {/* Stats — 2 cols */}
          <div className="col-span-2 grid grid-cols-3 gap-3">
            {[
              { label: 'Open',       value: fmt(quote.o)   },
              { label: 'Prev Close', value: fmt(quote.pc)  },
              { label: 'Day High',   value: fmt(quote.h)   },
              { label: 'Day Low',    value: fmt(quote.l)   },
              { label: 'Mkt Cap',    value: fmtB(profile.marketCapitalization * 1e6) },
              { label: 'IPO Date',   value: profile.ipo || '—' },
            ].map(({ label, value }) => (
              <div key={label}
                className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 hover:border-[#B8943C]/20 transition-colors">
                <p className="text-[9px] tracking-[0.18em] uppercase text-[#8BA4BE] mb-2" style={mono}>{label}</p>
                <p className="text-[14px] font-medium text-[#EDE8DF] truncate" style={sans}>{value}</p>
              </div>
            ))}
          </div>

          {/* DCF card */}
          <button
            onClick={() => navigate(dcfPath)}
            className="group col-span-1 relative border border-[#4E7FA0]/20 rounded-xl bg-[#020810]/60 px-6 py-5 text-left hover:border-[#7A9AB8]/40 hover:bg-[#0A1628]/60 transition-all hover:-translate-y-0.5 overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
              style={{ background: 'radial-gradient(ellipse at top right, #7A9AB808, transparent 70%)' }} />
            <div className="relative flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[18px]" style={{ ...mono, color: '#7A9AB8' }}>◈</span>
                  <span className="text-[#8BA4BE]/40 group-hover:text-[#7A9AB8] transition-colors text-[16px]">→</span>
                </div>
                <p className="text-[12px] font-medium text-[#EDE8DF] mb-2" style={mono}>DCF Valuation</p>
                <p className="text-[10px] text-[#8BA4BE] leading-relaxed font-light">
                  Model intrinsic value using discounted cash flow analysis
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['FCF', 'WACC', 'Terminal Value'].map(tag => (
                  <span key={tag}
                    className="text-[8px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-md border border-[#7A9AB8]/15 text-[#4E7FA0]"
                    style={mono}>{tag}</span>
                ))}
              </div>
              <div className="mt-4 h-px w-0 group-hover:w-full transition-all duration-300 rounded-full"
                style={{ background: 'linear-gradient(90deg, #7A9AB860, transparent)' }} />
            </div>
          </button>

          {/* Financials card */}
          <button
            onClick={() => navigate(finPath)}
            className="group col-span-1 relative border border-[#C9A84C]/15 rounded-xl bg-[#020810]/60 px-6 py-5 text-left hover:border-[#C9A84C]/35 hover:bg-[#0A1628]/60 transition-all hover:-translate-y-0.5 overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
              style={{ background: 'radial-gradient(ellipse at top right, #C9A84C06, transparent 70%)' }} />
            <div className="relative flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[18px]" style={{ ...mono, color: '#C9A84C' }}>▣</span>
                  <span className="text-[#8BA4BE]/40 group-hover:text-[#C9A84C] transition-colors text-[16px]">→</span>
                </div>
                <p className="text-[12px] font-medium text-[#EDE8DF] mb-2" style={mono}>Financial Statements</p>
                <p className="text-[10px] text-[#8BA4BE] leading-relaxed font-light">
                  Revenue, FCF, capex & cash flow history with AI period analysis
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['Revenue', 'FCF', 'Capex', 'OCF'].map(tag => (
                  <span key={tag}
                    className="text-[8px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-md border border-[#C9A84C]/15 text-[#C9A84C]/60"
                    style={mono}>{tag}</span>
                ))}
              </div>
              <div className="mt-4 h-px w-0 group-hover:w-full transition-all duration-300 rounded-full"
                style={{ background: 'linear-gradient(90deg, #C9A84C60, transparent)' }} />
            </div>
          </button>

        </div>

        {/* ── WEBSITE ── */}
        {profile.weburl && (
          <div className="opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.28s_forwards]">
            <a href={profile.weburl} target="_blank" rel="noopener noreferrer"
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors"
              style={mono}>{profile.weburl} ↗</a>
          </div>
        )}

      </div>
    </div>
  )
}