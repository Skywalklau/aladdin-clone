import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createChart, CandlestickSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import type { ISeriesApi } from 'lightweight-charts'
import { getIndexInfo, getIndexQuote, type IndexKey } from '../api/indices'
import type { Quote, StockCandle, RangeLabel, CandleSize } from '../types/index'
import MarketIndices from '../components/MarketIndices'
import { mono, serif, sans } from '../lib/trading'
import { fmtPctSigned as fmtPct } from '../lib/formatters'
import { FIXED_RANGES, defaultCandleSize, fetchCandles } from '../lib/stockChart'

const GOOGLE_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');`

/** Index prices use locale formatting rather than currency symbol */
const fmt = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function IndexDetail() {
  const { key } = useParams<{ key: string }>()
  const navigate = useNavigate()

  const indexInfo = key ? getIndexInfo(key as IndexKey) : null

  const [quote,      setQuote]      = useState<Quote | null>(null)
  const [candles,    setCandles]    = useState<StockCandle[]>([])
  const [range,      setRange]      = useState<RangeLabel>('3M')
  const [candleSize, setCandleSize] = useState<CandleSize>('D')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const seriesRef         = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const chartRef          = useRef<ReturnType<typeof createChart> | null>(null)

  // ── 1. Fetch quote + initial candles ──────────────────────────────────────
  useEffect(() => {
    if (!indexInfo) return
    setLoading(true)
    Promise.all([
      getIndexQuote(indexInfo.symbol),
      fetchCandles(indexInfo.symbol, '3M', 'D', ''), // '' → falls back to 1990
    ])
      .then(([q, c]) => { setQuote(q); setCandles(c.candles) })
      .catch(() => setError('Failed to load index data'))
      .finally(() => setLoading(false))
  }, [indexInfo])

  // ── 2. Init chart after data loads ────────────────────────────────────────
  useEffect(() => {
    if (loading || !chartContainerRef.current || chartRef.current) return

    const el    = chartContainerRef.current
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor:  '#8BA4BE',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize:   10,
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
        borderColor:                  '#B8943C15',
        timeVisible:                  false,
        fixLeftEdge:                  true,
        fixRightEdge:                 true,
        lockVisibleTimeRangeOnResize: true,
      },
      width:  el.clientWidth,
      height: 420,
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
    if (!indexInfo || loading) return
    fetchCandles(indexInfo.symbol, range, candleSize, '').then(r => setCandles(r.candles))
  }, [range, candleSize])

  const handleRangeChange = (r: RangeLabel) => {
    setRange(r)
    setCandleSize(defaultCandleSize(r))
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{GOOGLE_FONTS}</style>
      <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-7 h-7 border border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>Loading...</p>
        </div>
      </div>
    </>
  )

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !quote || !indexInfo) return (
    <>
      <style>{GOOGLE_FONTS}</style>
      <div className="min-h-screen bg-[#020810] flex items-center justify-center" style={sans}>
        <div className="text-center">
          <p className="text-[#E05252] text-[11px] tracking-[0.15em] uppercase mb-4" style={mono}>
            ⚠ {error || 'Index not found'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="text-[11px] tracking-[0.15em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors"
            style={mono}>
            ← Back to dashboard
          </button>
        </div>
      </div>
    </>
  )

  const isPositive = quote.dp >= 0

  return (
    <>
      <style>{`
        ${GOOGLE_FONTS}
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

        {/* ── NAVBAR ── */}
        <nav className="border-b border-[#B8943C]/10 px-10 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#020810]/95 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate(-1)}
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors"
              style={mono}>
              ← Back
            </button>
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
            <div>
              <p className="text-[10px] tracking-[0.24em] text-[#B8943C] uppercase mb-1" style={mono}>
                Market Index · {indexInfo.symbol}
              </p>
              <h1 className="text-[36px] font-semibold leading-tight" style={serif}>
                {indexInfo.name}
              </h1>
            </div>
            <div className="text-right">
              <p className="text-[38px] font-semibold" style={{ ...sans, letterSpacing: '-0.02em' }}>
                {fmt(quote.c)}
              </p>
              <p className={`text-[15px] font-medium mt-0.5 ${isPositive ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>
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
                    style={mono}>{r}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#020810]/40 rounded-b-xl">
              <div ref={chartContainerRef} style={{ width: '100%', height: '420px' }} />
            </div>
          </div>

          {/* ── STATS ── */}
          <div className="grid grid-cols-4 gap-3 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.2s_forwards]">
            {[
              { label: 'Open',       value: fmt(quote.o)  },
              { label: 'Prev Close', value: fmt(quote.pc) },
              { label: 'Day High',   value: fmt(quote.h)  },
              { label: 'Day Low',    value: fmt(quote.l)  },
            ].map(({ label, value }) => (
              <div key={label}
                className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 hover:border-[#B8943C]/20 transition-colors">
                <p className="text-[9px] tracking-[0.18em] uppercase text-[#8BA4BE] mb-2" style={mono}>{label}</p>
                <p className="text-[15px] font-medium text-[#EDE8DF] truncate" style={sans}>{value}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}