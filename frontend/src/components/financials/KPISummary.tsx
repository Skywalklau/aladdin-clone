import type { ReactNode } from 'react'
import type { Summary } from '../../types/index'
import { mono } from '../../lib/trading'
import { fmtB, fmtBigCap } from '../../lib/formatters'

// ── Internal sub-components (scoped to this file) ─────────────────────────────

function Stat({ label, value, sub, color, small }: {
  label: string; value: string; sub?: string; color?: string; small?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p className="text-[9px] tracking-[0.12em] uppercase whitespace-nowrap"
        style={{ ...mono, color: '#5A7898' }}>
        {label}
      </p>
      <p className={`${small ? 'text-[12px]' : 'text-[15px]'} font-semibold leading-tight`}
        style={{ ...mono, color: color || '#C4D4E4' }}>
        {value}
      </p>
      {sub && <p className="text-[9px]" style={{ ...mono, color: '#4A6070' }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex-1 border-r border-[#1A2840] last:border-r-0 px-4 first:pl-0">
      <p className="text-[8.5px] tracking-[0.18em] uppercase mb-3"
        style={{ ...mono, color: '#C9A84C99' }}>
        {title}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  )
}

// ── KPISummary ────────────────────────────────────────────────────────────────

interface KPISummaryProps { s: Summary }

function KPISummary({ s }: KPISummaryProps) {
  const pctSm = (v?: number) => v != null ? `${(v * 100).toFixed(1)}%` : '—'
  const num   = (v?: number, dec = 2) => v != null ? v.toFixed(dec) : '—'
  const curr  = (v?: number) => v != null ? fmtBigCap(v) : '—'
  const mult  = (v?: number) => v != null ? `${v.toFixed(1)}x` : '—'

  // Normalise dividend yield — yfinance occasionally returns e.g. 1.05 instead of 0.0105
  const rawYield  = s.dividend_yield
  const normYield = rawYield != null ? (rawYield > 1 ? rawYield / 100 : rawYield) : null
  const divYieldDisplay = normYield != null ? `${(normYield * 100).toFixed(2)}%` : 'None'

  return (
    <div className="border-b border-[#1A2840] px-8 py-5">
      <div className="max-w-[1400px] mx-auto flex gap-0">

        <Section title="Valuation">
          <Stat label="Market Cap"    value={curr(s.market_cap)} />
          <Stat label="EV"            value={curr(s.enterprise_value)} />
          <Stat label="PE TTM | Fwd"  value={`${num(s.pe_ttm, 1)} | ${num(s.pe_forward, 1)}`} small />
          <Stat label="EV / EBITDA"   value={mult(s.ev_to_ebitda)} />
          <Stat label="Price / Sales" value={mult(s.price_to_sales)} />
          <Stat label="Price / Book"  value={mult(s.price_to_book)} />
        </Section>

        <Section title="Cash Flow">
          <Stat label="FCF Yield"  value={s.fcf_yield != null ? `${s.fcf_yield.toFixed(2)}%` : '—'}
            color={s.fcf_yield && s.fcf_yield > 0 ? '#4CAF85' : undefined} />
          <Stat label="FCF (TTM)"  value={s.fcf_ttm != null ? fmtB(s.fcf_ttm / 1e9) : '—'} />
          <Stat label="EPS (TTM)"  value={s.eps_ttm != null ? `$${s.eps_ttm.toFixed(2)}` : '—'} />
          <Stat label="EPS (Fwd)"  value={s.eps_forward != null ? `$${s.eps_forward.toFixed(2)}` : '—'} />
          <Stat label="Rev Growth" value={pctSm(s.revenue_growth_yoy)}
            color={s.revenue_growth_yoy && s.revenue_growth_yoy > 0 ? '#4CAF85' : '#E05252'} />
          <Stat label="EPS Growth" value={pctSm(s.earnings_growth_yoy)}
            color={s.earnings_growth_yoy && s.earnings_growth_yoy > 0 ? '#4CAF85' : '#E05252'} />
        </Section>

        <Section title="Margins & Returns">
          <Stat label="Gross Margin" value={pctSm(s.gross_margin)} />
          <Stat label="Op Margin"    value={pctSm(s.operating_margin)} />
          <Stat label="Net Margin"   value={pctSm(s.profit_margin)} />
          <Stat label="EBITDA Mrgn"  value={s.ebitda_margin != null ? `${s.ebitda_margin.toFixed(1)}%` : '—'} />
          <Stat label="ROE"          value={pctSm(s.return_on_equity)} />
          <Stat label="ROA"          value={pctSm(s.return_on_assets)} />
          <Stat label="ROIC"         value={s.roic != null ? `${s.roic.toFixed(1)}%` : '—'}
            color={s.roic != null ? (s.roic > 15 ? '#5DD6A0' : s.roic > 8 ? '#C9A84C' : '#F06B6B') : undefined} />
        </Section>

        <Section title="Balance Sheet">
          <Stat label="Cash"     value={curr(s.cash)}       color="#5DD6A0" />
          <Stat label="Debt"     value={curr(s.total_debt)} color="#F06B6B" />
          <Stat label="Net Cash" value={s.net_cash != null ? curr(Math.abs(s.net_cash)) : '—'}
            color={s.net_cash != null ? (s.net_cash >= 0 ? '#5DD6A0' : '#F06B6B') : undefined}
            sub={s.net_cash != null ? (s.net_cash >= 0 ? 'net cash' : 'net debt') : undefined} />
          <Stat label="ND / EBITDA" value={s.net_debt_to_ebitda != null ? `${s.net_debt_to_ebitda.toFixed(1)}x` : '—'}
            color={s.net_debt_to_ebitda != null
              ? (s.net_debt_to_ebitda < 0 ? '#5DD6A0' : s.net_debt_to_ebitda < 2 ? '#C9A84C' : '#F06B6B')
              : undefined} />
          <Stat label="Int. Coverage" value={s.interest_coverage != null ? `${s.interest_coverage.toFixed(1)}x` : '—'}
            color={s.interest_coverage != null
              ? (s.interest_coverage > 10 ? '#5DD6A0' : s.interest_coverage > 3 ? '#C9A84C' : '#F06B6B')
              : undefined} />
          <Stat label="Beta"   value={num(s.beta)} />
          <Stat label="52W Hi" value={s['52w_high'] ? `$${s['52w_high']!.toFixed(0)}` : '—'} />
          <Stat label="52W Lo" value={s['52w_low']  ? `$${s['52w_low']!.toFixed(0)}`  : '—'} />
        </Section>

        <Section title="Quality & Dilution">
          <Stat label="EV / FCF"     value={s.ev_to_fcf    != null ? `${s.ev_to_fcf.toFixed(1)}x`    : '—'} />
          <Stat label="Price / FCF"  value={s.price_to_fcf != null ? `${s.price_to_fcf.toFixed(1)}x` : '—'} />
          <Stat label="SBC / FCF"    value={s.sbc_to_fcf   != null ? `${s.sbc_to_fcf.toFixed(1)}%`   : '—'}
            color={s.sbc_to_fcf != null
              ? (s.sbc_to_fcf < 10 ? '#5DD6A0' : s.sbc_to_fcf < 25 ? '#C9A84C' : '#F06B6B')
              : undefined} />
          <Stat label="Shares ΔYoY"  value={s.shares_yoy_change != null
            ? `${s.shares_yoy_change > 0 ? '+' : ''}${s.shares_yoy_change.toFixed(1)}%` : '—'}
            color={s.shares_yoy_change != null
              ? (s.shares_yoy_change < 0 ? '#5DD6A0' : s.shares_yoy_change < 1 ? '#C9A84C' : '#F06B6B')
              : undefined} />
          <Stat label="Rev / Employee" value={s.revenue_per_employee != null ? fmtBigCap(s.revenue_per_employee) : '—'} />
        </Section>

        <Section title="Analyst / Dividend">
          <Stat label="Target (Mean)" value={s.target_mean ? `$${s.target_mean.toFixed(0)}` : '—'} />
          <Stat label="# Analysts"    value={s.num_analysts ? String(s.num_analysts) : '—'} />
          <Stat label="Rating"        value={s.recommendation
            ? s.recommendation.replace(/_/g, ' ').toUpperCase() : '—'}
            color={s.recommendation === 'buy' || s.recommendation === 'strong_buy'
              ? '#4CAF85' : s.recommendation === 'sell' ? '#E05252' : undefined} />
          <Stat label="PEG Ratio"    value={num(s.peg_ratio)} />
          <Stat label="Div Yield"    value={divYieldDisplay}
            color={normYield && normYield > 0 ? '#C9A84C' : undefined} />
          <Stat label="Payout Ratio" value={s.payout_ratio ? `${(s.payout_ratio * 100).toFixed(1)}%` : '—'} />
        </Section>

      </div>
    </div>
  )
}

export default KPISummary