import type { HistPoint, IncomeRow, CashRow, BalRow } from '../types/index'

/** Map an income-statement row array to HistPoint[], dividing by `scale`. */
export function incomePoints(rows: IncomeRow[], key: keyof IncomeRow, scale = 1e9): HistPoint[] {
  return rows
    .filter(r => r[key] != null)
    .map(r => ({ period: r.period, value: (r[key] as number) / scale }))
}

/** Map a cash-flow row array to HistPoint[], dividing by `scale`. */
export function cashPoints(rows: CashRow[], key: keyof CashRow, scale = 1e9): HistPoint[] {
  return rows
    .filter(r => r[key] != null)
    .map(r => ({ period: r.period, value: (r[key] as number) / scale }))
}

/** Map a balance-sheet row array to HistPoint[], dividing by `scale`. */
export function balPoints(rows: BalRow[], key: keyof BalRow, scale = 1e9): HistPoint[] {
  return rows
    .filter(r => r[key] != null)
    .map(r => ({ period: r.period, value: (r[key] as number) / scale }))
}

/** Return a percentage-change badge string and direction for the latest two data points. */
export function latestBadge(pts: HistPoint[]): { badge: string | null; up: boolean } {
  if (pts.length < 2) return { badge: null, up: true }
  const cur  = pts[pts.length - 1].value
  const prev = pts[pts.length - 2].value
  if (!prev) return { badge: null, up: true }
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  return { badge: `${Math.abs(pct).toFixed(1)}%`, up: pct >= 0 }
}