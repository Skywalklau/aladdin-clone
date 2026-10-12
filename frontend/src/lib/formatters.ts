// ── Currency ──────────────────────────────────────────────────────────────────

/** Full currency format e.g. $1,234.56 */
export const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)

/** Currency, no decimal e.g. $1,235 */
export const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

/** Currency, always 2 dp e.g. $1,234.56 */
export const fmt$d = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

/** Raw dollar with 2 dp, no thousands separator e.g. $12.34 */
export const fmtDollar = (v: number) => `$${Math.abs(v).toFixed(2)}`

// ── Billions / scale ──────────────────────────────────────────────────────────

/**
 * Format a value already expressed in billions e.g. 2.5 → "$2.5B".
 * Handles T / B / M automatically.
 */
export const fmtB = (v: number) => {
  const abs  = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}T`
  if (abs >= 1)    return `${sign}$${abs.toFixed(1)}B`
  return `${sign}$${(abs * 1000).toFixed(0)}M`
}

/**
 * Format a raw large number (market cap, revenue, etc.) with T / B / M suffix.
 * Input is the raw value e.g. 1_500_000_000 → "$1.5B".
 */
export const fmtBigCap = (v: number) => {
  const abs  = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `${sign}$${abs.toLocaleString()}`
}

/** Format a share count with B / M / T suffix (no $ sign). */
export const fmtShares = (v: number) => {
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`
  if (Math.abs(v) >= 1e9)  return `${(v / 1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6)  return `${(v / 1e6).toFixed(2)}M`
  return `${v.toFixed(0)}`
}

// ── Percentages ───────────────────────────────────────────────────────────────

/** Simple percent with 2 dp e.g. "3.50%" */
export const fmtPct = (v: number) => `${v.toFixed(2)}%`

/** Signed percent with 2 dp e.g. "+3.50%" / "-1.20%" */
export const fmtPctSigned = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

/** Percent from a 0–1 decimal with 2 dp e.g. 0.035 → "3.50%" */
export const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`

// ── Colour helpers ────────────────────────────────────────────────────────────

/** Traffic-light colour for a loss percentage (stress testing). */
export const lossClr = (pct: number): string => {
  if (pct > 0)    return '#4CAF85'
  if (pct > -10)  return '#C9A84C'
  if (pct > -25)  return '#E07B52'
  return '#E05252'
}

/** Correlation matrix cell classes (risk analysis). */
export const getCorrelationStyle = (value: number, isDiagonal: boolean) => {
  if (isDiagonal)   return { bg: 'bg-[#0A1628]',    text: 'text-[#2E4460]' }
  if (value >= 0.7) return { bg: 'bg-[#E05252]/10', text: 'text-[#E05252]' }
  if (value >= 0.4) return { bg: 'bg-[#C9A84C]/10', text: 'text-[#C9A84C]' }
  if (value >= 0)   return { bg: 'bg-[#4CAF85]/8',  text: 'text-[#4CAF85]' }
  return              { bg: 'bg-[#7A9AB8]/10',       text: 'text-[#7A9AB8]' }
}

// ── Animation helpers ─────────────────────────────────────────────────────────

/** Briefly sets a shake flag to true, then resets after the animation plays. */
export const triggerShake = (setter: (v: boolean) => void) => {
  setter(true)
  setTimeout(() => setter(false), 500)
}

// ── Date / time helpers ───────────────────────────────────────────────────────

/** Convert a Date to a Unix timestamp (seconds). */
export const toUnix = (d: Date) => Math.floor(d.getTime() / 1000)

/** Convert a Unix timestamp (seconds) to a YYYY-MM-DD string. */
export const toDateStr = (unix: number): string => {
  const d   = new Date(unix * 1000)
  const y   = d.getUTCFullYear()
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Format a date string to e.g. 'Jan 5, 2024' */
export const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })