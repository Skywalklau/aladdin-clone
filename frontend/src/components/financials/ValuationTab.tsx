import type { ReactNode } from 'react'
import type { Summary } from '../../types/index'
import { mono, serif, sans } from '../../lib/trading'

// ── Internal card (scoped to this file) ──────────────────────────────────────

function ValCard({ label, value, sub, color, desc }: {
  label: string; value: string; sub?: string; color?: string; desc?: string
}) {
  return (
    <div className="rounded-xl p-5"
      style={{ background: 'rgba(10,20,38,0.6)', border: '1px solid #243350' }}>
      <p className="text-[10px] tracking-[0.14em] uppercase font-medium mb-1.5"
        style={{ ...mono, color: '#7A96B4' }}>
        {label}
      </p>
      <p className="text-[30px] font-semibold leading-tight"
        style={{ ...serif, color: color || '#F0EBE0' }}>
        {value}
      </p>
      {sub  && <p className="text-[11px] font-medium mt-1" style={{ ...mono, color: '#A8C0D6' }}>{sub}</p>}
      {desc && <p className="text-[11px] mt-2.5 leading-relaxed" style={{ ...sans, color: '#7A96B4' }}>{desc}</p>}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.16em] uppercase font-medium text-[#C9A84C] mb-3" style={mono}>
        {title}
      </p>
      <div className="grid grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

// ── ValuationTab ──────────────────────────────────────────────────────────────

interface ValuationTabProps { s: Summary; price?: number }

function ValuationTab({ s, price }: ValuationTabProps) {
  const upside = price && s.target_mean ? ((s.target_mean - price) / price * 100) : null

  return (
    <div className="space-y-6">

      <Group title="Price Multiples">
        <ValCard label="P/E (TTM)" value={s.pe_ttm ? s.pe_ttm.toFixed(1) + 'x' : '—'}
          sub={s.pe_forward ? `Forward: ${s.pe_forward.toFixed(1)}x` : undefined}
          desc="Price relative to trailing twelve-month earnings." />
        <ValCard label="EV / EBITDA" value={s.ev_to_ebitda ? s.ev_to_ebitda.toFixed(1) + 'x' : '—'}
          desc="Enterprise value relative to EBITDA — useful for cross-company comparisons." />
        <ValCard label="Price / Sales" value={s.price_to_sales ? s.price_to_sales.toFixed(2) + 'x' : '—'}
          desc="Useful for high-growth companies where earnings are depressed." />
        <ValCard label="Price / Book" value={s.price_to_book ? s.price_to_book.toFixed(2) + 'x' : '—'}
          desc="Market value relative to net asset value on the balance sheet." />
      </Group>

      <Group title="Yield & Growth">
        <ValCard label="FCF Yield" value={s.fcf_yield ? s.fcf_yield.toFixed(2) + '%' : '—'}
          color={s.fcf_yield && s.fcf_yield > 3 ? '#4CAF85' : undefined}
          desc="Free cash flow as a % of market cap. Higher = cheaper on a cash basis." />
        <ValCard label="EPS (TTM)" value={s.eps_ttm ? `$${s.eps_ttm.toFixed(2)}` : '—'}
          sub={s.eps_forward ? `Forward: $${s.eps_forward.toFixed(2)}` : undefined} />
        <ValCard label="PEG Ratio" value={s.peg_ratio ? s.peg_ratio.toFixed(2) + 'x' : '—'}
          color={s.peg_ratio && s.peg_ratio < 1 ? '#4CAF85' : s.peg_ratio && s.peg_ratio > 2 ? '#E05252' : undefined}
          desc="P/E divided by EPS growth rate. Below 1 suggests undervaluation." />
        <ValCard label="EV / Revenue" value={s.ev_to_revenue ? s.ev_to_revenue.toFixed(2) + 'x' : '—'} />
      </Group>

      <Group title="Analyst Consensus">
        <ValCard label="Price Target (Mean)" value={s.target_mean ? `$${s.target_mean.toFixed(0)}` : '—'}
          color={upside && upside > 0 ? '#4CAF85' : '#E05252'}
          sub={upside != null ? `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}% upside` : undefined} />
        <ValCard label="Price Target (High)" value={s.target_high ? `$${s.target_high.toFixed(0)}` : '—'} />
        <ValCard label="Price Target (Low)"  value={s.target_low  ? `$${s.target_low.toFixed(0)}`  : '—'} />
        <ValCard label="Analyst Coverage" value={s.num_analysts ? String(s.num_analysts) : '—'}
          sub={s.recommendation ? s.recommendation.replace(/_/g, ' ').toUpperCase() : undefined}
          color={s.recommendation === 'buy' || s.recommendation === 'strong_buy'
            ? '#4CAF85' : s.recommendation === 'sell' ? '#E05252' : undefined} />
      </Group>

      <Group title="Market Data">
        <ValCard label="Beta" value={s.beta ? s.beta.toFixed(2) : '—'}
          desc="Volatility relative to the S&P 500. > 1 = more volatile." />
        <ValCard label="Short Interest" value={s.short_pct_float ? `${(s.short_pct_float * 100).toFixed(1)}%` : '—'}
          sub={s.short_ratio ? `${s.short_ratio.toFixed(1)}d to cover` : undefined} />
        <ValCard label="52-Wk High" value={s['52w_high'] ? `$${s['52w_high']!.toFixed(2)}` : '—'}
          sub={price && s['52w_high']
            ? `${(((price - s['52w_high']!) / s['52w_high']!) * 100).toFixed(1)}% from high`
            : undefined} />
        <ValCard label="52-Wk Low" value={s['52w_low'] ? `$${s['52w_low']!.toFixed(2)}` : '—'}
          sub={price && s['52w_low']
            ? `+${(((price - s['52w_low']!) / s['52w_low']!) * 100).toFixed(1)}% from low`
            : undefined} />
      </Group>

    </div>
  )
}

export default ValuationTab