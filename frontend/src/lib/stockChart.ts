import type { RangeLabel, CandleSize, StockCandle } from '../types/index'
import { toUnix, toDateStr } from './formatters'

// ── Constants ─────────────────────────────────────────────────────────────────

export const FIXED_RANGES = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'YTD', 'MAX'] as const

export const DAYS_MAP: Record<string, number> = {
  '1M': 30, '3M': 90, '6M': 180,
  '1Y': 365, '3Y': 1095, '5Y': 1825,
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function getRangeBounds(range: RangeLabel, ipoDate: string): { from: number; to: number } {
  const now = new Date()
  const to  = toUnix(now)
  if (range === 'YTD') return { from: toUnix(new Date(now.getFullYear(), 0, 1)), to }
  if (range === 'MAX') return { from: ipoDate ? toUnix(new Date(ipoDate)) : toUnix(new Date('1990-01-01')), to }
  return { from: toUnix(new Date(Date.now() - DAYS_MAP[range] * 86400_000)), to }
}

export function defaultCandleSize(range: RangeLabel): CandleSize {
  if (range === '1M')                         return 'D'
  if (range === '3Y' || range === '5Y')       return 'W'
  if (range === 'MAX')                        return 'M'
  return 'D'
}

export function toInterval(size: CandleSize): string {
  return size === 'D' ? '1d' : size === 'W' ? '1wk' : '1mo'
}

// ── Fetch result type ─────────────────────────────────────────────────────────

export interface CandleResult {
  candles:      StockCandle[]
  isIncomplete: boolean
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchCandles(
  symbol:  string,
  range:   RangeLabel,
  size:    CandleSize,
  ipoDate: string,
): Promise<CandleResult> {
  const { from, to } = getRangeBounds(range, ipoDate)
  const isMax = range === 'MAX'
  const res = await fetch(
    `/api/stocks/${symbol}/candles?resolution=${toInterval(size)}&from_ts=${from}&to_ts=${to}&is_max=${isMax}`
  ).then(r => r.json())

  if (!res || res.s !== 'ok' || !res.t?.length) {
    return { candles: [], isIncomplete: false }
  }

  const candles: StockCandle[] = res.t.map((time: number, i: number) => ({
    time:  toDateStr(time),
    open:  res.o[i],
    high:  res.h[i],
    low:   res.l[i],
    close: res.c[i],
  }))

  return {
    candles,
    isIncomplete: range === 'MAX' && res.meta?.is_incomplete === true,
  }
}