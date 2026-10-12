import { useState, useEffect, useRef, useCallback } from 'react'
import type { TradingPosition, FeedItem } from '../../types/index'
import CandleChart from './CandleChart'
import {
  mono, serif,
  ASSETS,
  QTY_PRESETS,
  STARTING_CASH,
  CANDLE_COUNT,
  TICK_MS,
  seedCandles,
  nextCandle,
} from '../../lib/trading'

export default function TradingGame() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [candles,   setCandles]   = useState(() =>
    ASSETS.map(a => seedCandles(a.base, a.vol, CANDLE_COUNT)),
  )
  const [cash,      setCash]      = useState(STARTING_CASH)
  const [positions, setPositions] = useState<TradingPosition[]>(
    ASSETS.map(() => ({ qty: 0, avg: 0 })),
  )
  const [qty,       setQty]       = useState(5)
  const [flash,     setFlash]     = useState<'buy' | 'sell' | null>(null)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [hoverIdx,  setHoverIdx]  = useState<number | null>(null)
  const feedId = useRef(0)

  // Tick: append a new candle to every asset on each interval
  useEffect(() => {
    const id = setInterval(() => {
      setCandles(prev =>
        prev.map((cs, i) => {
          const next = nextCandle(cs[cs.length - 1], ASSETS[i].vol)
          return [...cs.slice(-(CANDLE_COUNT - 1)), next]
        }),
      )
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const addFeed = useCallback((text: string, pos: boolean) => {
    const id = feedId.current++
    setFeedItems(prev => [{ id, text, pos }, ...prev.slice(0, 4)])
  }, [])

  // ── Derived values ────────────────────────────────────────────────────────
  const curAsset   = ASSETS[activeIdx]
  const curCandles = candles[activeIdx]
  const last       = curCandles[curCandles.length - 1]
  const prev2      = curCandles[curCandles.length - 2]
  const curPrice   = last.c
  const pChange    = ((last.c - prev2.c) / prev2.c) * 100
  const dayChange  = ((curPrice - curCandles[0].o) / curCandles[0].o) * 100
  const curPos     = positions[activeIdx]
  const unrealised = curPos.qty > 0 ? (curPrice - curPos.avg) * curPos.qty : 0
  const equity     = positions.reduce(
    (sum, p, i) => sum + p.qty * candles[i][candles[i].length - 1].c,
    0,
  )
  const totalValue = cash + equity
  const totalPnl   = totalValue - STARTING_CASH
  const hc         = hoverIdx !== null ? curCandles[hoverIdx] : last

  // ── Trade handlers ────────────────────────────────────────────────────────
  const handleBuy = () => {
    const cost = qty * curPrice
    if (cost > cash) { addFeed('Insufficient funds', false); return }
    setCash(c => parseFloat((c - cost).toFixed(2)))
    setPositions(prev =>
      prev.map((p, i) => {
        if (i !== activeIdx) return p
        const newQty = p.qty + qty
        return {
          qty: newQty,
          avg: parseFloat(((p.avg * p.qty + curPrice * qty) / newQty).toFixed(2)),
        }
      }),
    )
    setFlash('buy')
    addFeed(`Bought ${qty}× ${curAsset.id} @ $${curPrice.toFixed(2)}`, true)
    setTimeout(() => setFlash(null), 450)
  }

  const handleSell = () => {
    if (curPos.qty < qty) { addFeed('Not enough shares', false); return }
    const pnl = (curPrice - curPos.avg) * qty
    setCash(c => parseFloat((c + qty * curPrice).toFixed(2)))
    setPositions(prev =>
      prev.map((p, i) => {
        if (i !== activeIdx) return p
        const newQty = p.qty - qty
        return { qty: newQty, avg: newQty === 0 ? 0 : p.avg }
      }),
    )
    setFlash('sell')
    addFeed(`Sold ${qty}× ${curAsset.id}  ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)} PnL`, pnl >= 0)
    setTimeout(() => setFlash(null), 450)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2 select-none">

      {/* ── Row 1: ticker tabs + portfolio value ── */}
      <div className="flex items-center gap-1.5">
        {ASSETS.map((a, i) => {
          const lc   = candles[i][candles[i].length - 1]
          const pc   = candles[i][candles[i].length - 2]
          const chg  = ((lc.c - pc.c) / pc.c) * 100
          const bull = chg >= 0
          return (
            <button
              key={a.id}
              onClick={() => setActiveIdx(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer ${
                i === activeIdx
                  ? 'bg-[#0A1628] border-[#B8943C]/40'
                  : 'bg-transparent border-[#B8943C]/10 hover:border-[#B8943C]/25'
              }`}
            >
              <span className="text-[11px] font-medium text-[#EDE8DF]" style={mono}>{a.id}</span>
              <span className="text-[10px] text-[#8BA4BE]" style={mono}>${lc.c.toFixed(2)}</span>
              <span className={`text-[9px] ${bull ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>
                {bull ? '▲' : '▼'}{Math.abs(chg).toFixed(2)}%
              </span>
            </button>
          )
        })}

        {/* Portfolio value pushed to right */}
        <div className="ml-auto text-right flex-shrink-0">
          <p
            className={`text-[16px] font-semibold leading-none ${totalPnl >= 0 ? 'text-[#C9A84C]' : 'text-[#E05252]'}`}
            style={serif}
          >
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-[9px] mt-0.5 ${totalPnl >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} ({((totalPnl / STARTING_CASH) * 100).toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* ── Row 2: Chart — dominant ── */}
      <div
        className={`relative flex-1 rounded-lg border overflow-hidden transition-all duration-200 ${
          flash === 'buy'  ? 'border-[#4CAF85]/50 shadow-[0_0_18px_rgba(76,175,133,0.15)]' :
          flash === 'sell' ? 'border-[#E05252]/50 shadow-[0_0_18px_rgba(224,82,82,0.15)]'  :
                             'border-[#B8943C]/12'
        } bg-[#020810]/80 min-h-0`}
      >
        <CandleChart candles={curCandles} hoverIdx={hoverIdx} onHover={setHoverIdx} />

        {/* Top-left: live price + OHLC */}
        <div className="absolute top-2.5 left-3 pointer-events-none">
          <div className="flex items-baseline gap-2">
            <span className="text-[20px] font-semibold text-[#EDE8DF]" style={serif}>
              ${hc.c.toFixed(2)}
            </span>
            <span className={`text-[10px] ${pChange >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>
              {pChange >= 0 ? '+' : ''}{pChange.toFixed(3)}%
            </span>
            <span className={`text-[9px] ${dayChange >= 0 ? 'text-[#4CAF85]' : 'text-[#E05252]'}`} style={mono}>
              · session {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)}%
            </span>
          </div>
          <div className="flex gap-3 mt-1">
            {([['O', hc.o], ['H', hc.h], ['L', hc.l], ['C', hc.c]] as [string, number][]).map(([label, val]) => (
              <span key={label} className="text-[9px]" style={mono}>
                <span className="text-[#4A6278]">{label} </span>
                <span className="text-[#8BA4BE]">{val.toFixed(2)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Stats strip ── */}
      <div className="flex items-center gap-0 rounded-md border border-[#B8943C]/8 bg-[#020810]/70 overflow-hidden">
        {[
          { label: 'Pos',   value: `${curPos.qty} sh` },
          { label: 'Entry', value: curPos.qty > 0 ? `$${curPos.avg.toFixed(2)}` : '—' },
          { label: 'PnL',   value: curPos.qty > 0 ? `${unrealised >= 0 ? '+' : ''}$${unrealised.toFixed(0)}` : '—', color: unrealised >= 0 ? '#4CAF85' : '#E05252' },
          { label: 'Cash',  value: `$${Math.floor(cash).toLocaleString()}` },
        ].map(({ label, value, color }, idx, arr) => (
          <div
            key={label}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 ${idx < arr.length - 1 ? 'border-r border-[#B8943C]/8' : ''}`}
          >
            <span className="text-[8px] tracking-[0.1em] uppercase text-[#4A6278]" style={mono}>{label}</span>
            <span className="text-[10px] font-medium" style={{ ...mono, color: color || '#EDE8DF' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Row 4: Qty + Trade ── */}
      <div className="flex gap-1.5 items-center">
        <div className="flex gap-1">
          {QTY_PRESETS.map(q => (
            <button
              key={q}
              onClick={() => setQty(q)}
              className={`w-8 py-1.5 rounded text-[10px] border transition-all cursor-pointer ${
                qty === q
                  ? 'bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C]'
                  : 'bg-transparent border-[#B8943C]/12 text-[#4A6278] hover:text-[#8BA4BE] hover:border-[#B8943C]/28'
              }`}
              style={mono}
            >
              {q}
            </button>
          ))}
        </div>
        <button
          onClick={handleBuy}
          className="flex-1 py-1.5 rounded text-[10px] font-medium tracking-[0.12em] uppercase transition-all active:scale-[0.97] cursor-pointer border border-[#4CAF85]/30 bg-[#4CAF85]/10 text-[#4CAF85] hover:bg-[#4CAF85]/18"
          style={mono}
        >
          ▲ BUY · ${(qty * curPrice).toFixed(0)}
        </button>
        <button
          onClick={handleSell}
          className="flex-1 py-1.5 rounded text-[10px] font-medium tracking-[0.12em] uppercase transition-all active:scale-[0.97] cursor-pointer border border-[#E05252]/30 bg-[#E05252]/10 text-[#E05252] hover:bg-[#E05252]/18"
          style={mono}
        >
          ▼ SELL · ${(qty * curPrice).toFixed(0)}
        </button>
      </div>

      {/* ── Row 5: Activity log ── */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-[#B8943C]/8 bg-[#020810]/60 overflow-hidden">
        <span className="text-[8px] tracking-[0.18em] uppercase text-[#4A6278] flex-shrink-0" style={mono}>Log</span>
        <div className="w-px h-3 bg-[#B8943C]/15 flex-shrink-0" />
        {feedItems.length === 0
          ? <span className="text-[9px] text-[#1A2C42] italic" style={mono}>No trades yet — make your first move</span>
          : feedItems.slice(0, 4).map((f, fi) => (
              <span
                key={f.id}
                className={`text-[9px] whitespace-nowrap ${fi > 0 ? 'opacity-40' : ''} ${f.pos ? 'text-[#4CAF85]' : 'text-[#E05252]'}`}
                style={mono}
              >
                {f.pos ? '↑' : '↓'} {f.text}
              </span>
            ))
        }
      </div>

    </div>
  )
}