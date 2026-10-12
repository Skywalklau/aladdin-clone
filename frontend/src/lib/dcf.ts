import type React from 'react'
import type { Financials, Assumptions, DCFResult } from '../types/index'

export { mono, sans, serif } from './trading'
export { fmt$d as fmt, fmtBigCap as fmtB, fmtShares, fmtPct } from './formatters'
export type {
  Financials, Assumptions, AIScenario, AISuggestion, DCFResult,
  // newly re-exported for CompsPanel / consumers
  Summary, CompsData, Comp,
} from '../types/index'

// ── Shared tax-rate helper ────────────────────────────────────────────────────
// Derives effective tax rate from income statement; falls back to 21 %.

function effectiveTaxRate(f: Financials): number {
  if (f.income_tax_expense != null && f.pretax_income != null && f.pretax_income > 0)
    return Math.min(Math.max((f.income_tax_expense / f.pretax_income) * 100, 0), 40)
  return 21
}

// ── Cost of Equity (CAPM) ─────────────────────────────────────────────────────
// Ke = Rf + β × ERP  (clamped to [6 %, 20 %])
// Exported separately so FCFE mode and the toggle can reference it directly.

export function computeKe(f: Financials, riskFreeRate: number, erp = 5.5): number {
  const raw = f.beta
    ? riskFreeRate + f.beta * erp
    : riskFreeRate + erp
  return Math.min(Math.max(+raw.toFixed(2), 6), 20)
}

// ── WACC ──────────────────────────────────────────────────────────────────────

export function computeWACC(
  f: Financials,
  riskFreeRate: number,
  erp = 5.5,
): { wacc: number; breakdown: string } {
  const FALLBACK_KD = 5.0

  const ke = computeKe(f, riskFreeRate, erp)

  const kd: number = (() => {
    if (f.interest_expense && f.total_debt && f.total_debt > 0)
      return Math.min(Math.max((f.interest_expense / f.total_debt) * 100, 0), 25)
    return FALLBACK_KD
  })()

  const taxRate = effectiveTaxRate(f)

  const D = f.total_debt ?? 0
  const E = (f.current_price ?? 0) * (f.shares_outstanding ?? 0)
  const V = E + D

  if (V <= 0 || D <= 0) {
    return { wacc: +ke.toFixed(2), breakdown: `Ke ${ke.toFixed(2)}% · No debt → WACC = Ke` }
  }

  const eWeight = E / V
  const dWeight = D / V
  const wacc    = ke * eWeight + kd * (1 - taxRate / 100) * dWeight
  const breakdown = [
    `Ke ${ke.toFixed(2)}% × ${(eWeight * 100).toFixed(0)}% equity`,
    `Kd ${kd.toFixed(2)}% × (1−${taxRate.toFixed(0)}% tax) × ${(dWeight * 100).toFixed(0)}% debt`,
  ].join(' + ')

  return { wacc: +Math.min(Math.max(wacc, 4), 25).toFixed(2), breakdown }
}

// ── FCFE from FCFF ────────────────────────────────────────────────────────────
// FCFE = FCFF − Interest×(1−t) + Net Borrowing
//
// Net borrowing (ΔDebt) = new debt issued − debt repaid in the period.
// Positive → firm raised net new debt, those proceeds flow to equity holders.
// Negative → firm is a net repayer, reducing equity cash flows.
// Falls back to 0 when data is unavailable (stable-leverage assumption).

export function computeFCFE(f: Financials): number {
  const fcff        = f.free_cash_flow ?? 1e9
  const taxRate     = effectiveTaxRate(f)
  const afterTaxInt = (f.interest_expense ?? 0) * (1 - taxRate / 100)
  const netBorrow   = f.net_borrowing ?? 0
  return fcff - afterTaxInt + netBorrow
}

// ── DCF ───────────────────────────────────────────────────────────────────────
//
// FCFF mode (default):
//   • Discount rate = WACC
//   • enterpriseValue = Σ PV(FCFFs) + PV(terminal)
//   • equityValue     = enterpriseValue − netDebt − minorityInterest − preferredStock
//
// FCFE mode (a.mode === 'FCFE'):
//   • Discount rate = Ke   (caller must set a.discountRate = Ke before calling)
//   • Cash flows are already equity-level → no debt bridge subtraction
//   • enterpriseValue field holds the *equity* value in this mode (naming kept
//     consistent with DCFResult so consumers don't need type changes)

export function runDCF(a: Assumptions): DCFResult {
  if (a.discountRate <= a.terminalGrowth) {
    return { pvs: [], terminalPV: 0, intrinsic: 0, enterpriseValue: 0, invalid: true }
  }

  const pvs: number[] = []
  let fcf = a.fcf
  const stage1Years = Math.round(a.growthRateYears)

  for (let y = 1; y <= a.years; y++) {
    const rate = y <= stage1Years ? a.growthRate : a.growthRate2
    fcf = fcf * (1 + rate / 100)
    pvs.push(fcf / Math.pow(1 + a.discountRate / 100, y))
  }

  const terminalFCF     = fcf * (1 + a.terminalGrowth / 100)
  const terminalVal     = terminalFCF / ((a.discountRate / 100) - (a.terminalGrowth / 100))
  const terminalPV      = terminalVal / Math.pow(1 + a.discountRate / 100, a.years)
  const sumPVs          = pvs.reduce((s, v) => s + v, 0)
  const enterpriseValue = sumPVs + terminalPV

  // FCFE: flows are equity-level — no bridge items needed.
  // FCFF: subtract net debt, minority interest, preferred equity.
  const equityValue = a.mode === 'FCFE'
    ? enterpriseValue
    : enterpriseValue - a.netDebt - a.minorityInterest - a.preferredStock

  const intrinsic = a.sharesOut > 0 ? equityValue / a.sharesOut : 0

  return { pvs, terminalPV, intrinsic, enterpriseValue, invalid: false }
}

// ── Implied growth (bisection) ────────────────────────────────────────────────

export function solveImpliedGrowth(a: Assumptions, targetPrice: number): number | null {
  const MAX_ITER = 60
  let lo = -20, hi = 100
  const atLo = runDCF({ ...a, growthRate: lo }).intrinsic
  const atHi = runDCF({ ...a, growthRate: hi }).intrinsic
  if ((atLo - targetPrice) * (atHi - targetPrice) > 0) return null
  for (let i = 0; i < MAX_ITER; i++) {
    const mid = (lo + hi) / 2
    const val = runDCF({ ...a, growthRate: mid }).intrinsic
    if (Math.abs(val - targetPrice) < 0.001) return mid
    if (val < targetPrice) lo = mid
    else                   hi = mid
  }
  return (lo + hi) / 2
}

// ── Sensitivity grid ──────────────────────────────────────────────────────────
// Works identically for both modes — the caller's assumptions already carry
// the correct discount rate (WACC or Ke) and mode flag.

export function buildSensitivityGrid(a: Assumptions) {
  const baseGrowth  = Math.round(a.growthRate)
  const baseWACC    = Math.round(a.discountRate * 2) / 2
  const growthRates = [-2, -1, 0, 1, 2].map(d => baseGrowth + d * 5)
  const waccs       = [-2, -1, 0, 1, 2].map(d => +(baseWACC + d * 1.5).toFixed(2))
  const grid        = growthRates.map(g =>
    waccs.map(w => {
      if (w <= a.terminalGrowth) return NaN
      return runDCF({ ...a, growthRate: g, discountRate: w }).intrinsic
    }),
  )
  return { growthRates, waccs, grid }
}

// ── Cell colour for sensitivity table ────────────────────────────────────────

export function cellStyle(intrinsic: number, marketPrice: number | null): React.CSSProperties {
  if (!marketPrice || isNaN(intrinsic)) return { color: '#4A6070' }
  const pct = (intrinsic - marketPrice) / marketPrice
  if (pct >  0.30) return { background: 'rgba(76,175,133,0.18)', color: '#4CAF85' }
  if (pct >  0.10) return { background: 'rgba(76,175,133,0.08)', color: '#7ECFAD' }
  if (pct > -0.10) return { background: 'rgba(184,148,60,0.08)',  color: '#C9A84C' }
  if (pct > -0.30) return { background: 'rgba(224,82,82,0.08)',   color: '#E08070' }
  return                  { background: 'rgba(224,82,82,0.16)',   color: '#E05252' }
}

// ── Default assumptions factory ───────────────────────────────────────────────
//
// Now accepts an optional `mode` parameter.
// Returns `ke` alongside `wacc` so callers can display / pass to the toggle.
//
// On mode switch the parent should call this again (or patch only the fields
// that change: fcf, discountRate, mode) rather than blowing away custom inputs.

export function makeDefaultAssumptions(
  f:            Financials,
  riskFreeRate  = 4.3,
  erp           = 5.5,
  mode:         'FCFF' | 'FCFE' = 'FCFF',
): {
  assumptions: Assumptions
  wacc:        number
  ke:          number
  breakdown:   string
} {
  const { wacc, breakdown } = computeWACC(f, riskFreeRate, erp)
  const ke                  = computeKe(f, riskFreeRate, erp)

  // Base cash flow and discount rate differ by mode.
  const baseFCF      = mode === 'FCFE' ? computeFCFE(f) : (f.free_cash_flow ?? 1e9)
  const discountRate = mode === 'FCFE' ? ke : wacc

  return {
    assumptions: {
      fcf:              baseFCF,
      sharesOut:        f.shares_outstanding ?? 1e9,
      discountRate,
      riskFreeRate,
      erp,
      growthRate:       10,
      growthRateYears:  5,
      growthRate2:      5,
      terminalGrowth:   3,
      years:            10,
      netDebt:          (f.total_debt ?? 0) - (f.cash_and_equivalents ?? 0),
      minorityInterest: f.minority_interest ?? 0,
      preferredStock:   f.preferred_stock   ?? 0,
      mode,
    },
    wacc,
    ke,
    breakdown,
  }
}