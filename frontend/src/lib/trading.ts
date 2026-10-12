import type { Candle, Asset } from '../types/index'

// ── Font style objects ────────────────────────────────────────────────────────
export const mono  = { fontFamily: "'IBM Plex Mono', monospace" }
export const serif = { fontFamily: "'Cormorant Garamond', serif" }
export const sans  = { fontFamily: "'Sora', sans-serif" }

// ── Chart / simulation constants ──────────────────────────────────────────────
export const STARTING_CASH = 10_000
export const CANDLE_COUNT  = 48
export const TICK_MS       = 1100
export const VOL_HEIGHT    = 0.18

// ── Candle colour palette ─────────────────────────────────────────────────────
export const BULL_COLOR = '#4CAF85'
export const BEAR_COLOR = '#E05252'
export const BULL_FILL  = 'rgba(76,175,133,0.75)'
export const BEAR_FILL  = 'rgba(224,82,82,0.75)'
export const BULL_VOL   = 'rgba(76,175,133,0.28)'
export const BEAR_VOL   = 'rgba(224,82,82,0.22)'

// ── Simulated assets ──────────────────────────────────────────────────────────
export const ASSETS: Asset[] = [
  { id: 'ARKM', name: 'ARKM Capital', base: 142.50, vol: 0.022, color: '#C9A84C' },
  { id: 'NXVT', name: 'Nexvault Corp', base: 87.20,  vol: 0.027, color: '#4CAF85' },
  { id: 'VLTX', name: 'Veltrix ETF',  base: 214.90, vol: 0.014, color: '#8B9EE0' },
]

// ── Quantity presets ──────────────────────────────────────────────────────────
export const QTY_PRESETS = [1, 5, 10, 25]

// ── Pure candle generators ────────────────────────────────────────────────────

/** Build an initial history of `count` candles for the given base price + volatility. */
export function seedCandles(base: number, vol: number, count: number): Candle[] {
  const candles: Candle[] = []
  let price = base * (0.92 + Math.random() * 0.08)

  for (let i = 0; i < count; i++) {
    const o     = price
    const move  = (Math.random() - 0.48) * vol
    price       = Math.max(o * (1 + move), 0.01)
    const c     = price
    const swing = Math.abs(o - c)
    const h     = Math.max(o, c) + swing * (0.2 + Math.random() * 0.8)
    const l     = Math.min(o, c) - swing * (0.2 + Math.random() * 0.8)
    candles.push({ o, h, l, c, v: 0.2 + Math.random() * 0.8 })
  }

  return candles
}

/** Produce the next candle continuing from `prev`. */
export function nextCandle(prev: Candle, vol: number): Candle {
  const o     = prev.c
  const move  = (Math.random() - 0.48) * vol
  const c     = Math.max(o * (1 + move), 0.01)
  const swing = Math.abs(o - c)
  const h     = Math.max(o, c) + swing * (0.15 + Math.random() * 0.7)
  const l     = Math.min(o, c) - swing * (0.15 + Math.random() * 0.7)
  return { o, h, l, c, v: 0.2 + Math.random() * 0.8 }
}