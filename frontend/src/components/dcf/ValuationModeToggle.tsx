import { mono } from '../../lib/dcf'

// ─────────────────────────────────────────────────────────────────────────────
// ValuationModeToggle
//
// Lets the user switch between FCFF (Enterprise DCF) and FCFE (Equity DCF).
//
// Props
//   mode          — current mode, controlled by parent
//   wacc          — computed WACC %, shown as the FCFF discount rate
//   ke            — computed cost-of-equity %, shown as the FCFE discount rate
//   onModeChange  — callback; parent should patch assumptions:
//                     FCFF→FCFE: set fcf=computeFCFE(financials), discountRate=ke, mode='FCFE'
//                     FCFE→FCFF: set fcf=financials.free_cash_flow, discountRate=wacc, mode='FCFF'
//                   Other assumption fields (growth rates, terminal, years) are left untouched.
// ─────────────────────────────────────────────────────────────────────────────

const MODES = [
  {
    key:      'FCFF' as const,
    label:    'FCFF',
    fullName: 'Free Cash Flow to Firm',
    desc:     'Discount at WACC · subtract net-debt bridge to equity',
    note:     'Standard enterprise DCF. Best when capital structure is meaningful.',
  },
  {
    key:      'FCFE' as const,
    label:    'FCFE',
    fullName: 'Free Cash Flow to Equity',
    desc:     'Discount at Ke · FCFF − after-tax interest + net borrowing',
    note:     'Equity DCF. Best for financials or highly-leveraged companies.',
  },
]

export function ValuationModeToggle({
  mode,
  wacc,
  ke,
  onModeChange,
}: {
  mode:         'FCFF' | 'FCFE'
  wacc:         number
  ke:           number
  onModeChange: (next: 'FCFF' | 'FCFE') => void
}) {
  const active   = MODES.find(m => m.key === mode)!
  const inactive = MODES.find(m => m.key !== mode)!

  return (
    <div
      className="rounded-xl overflow-hidden border border-[#1A2840]"
      style={{ background: '#0A1628' }}
    >
      {/* ── Toggle strip ── */}
      <div
        className="flex p-1 gap-1"
        style={{ background: '#020810', borderBottom: '1px solid #1A2840' }}
      >
        {MODES.map(m => {
          const isActive = m.key === mode
          return (
            <button
              key={m.key}
              onClick={() => !isActive && onModeChange(m.key)}
              className="flex-1 py-1.5 px-3 rounded-lg text-[10px] tracking-[0.12em] uppercase font-medium transition-all"
              style={{
                ...mono,
                background: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                border:     `1px solid ${isActive ? 'rgba(201,168,76,0.30)' : 'transparent'}`,
                color:      isActive ? '#C9A84C' : '#4A6070',
                cursor:     isActive ? 'default' : 'pointer',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* ── Active mode detail ── */}
      <div className="px-4 py-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] tracking-[0.12em] uppercase font-medium mb-0.5"
            style={{ ...mono, color: '#C9A84C' }}
          >
            {active.fullName}
          </p>
          <p className="text-[10px] text-[#8BA4BE] leading-relaxed" style={mono}>
            {active.desc}
          </p>
          <p className="text-[10px] text-[#4A6070] mt-1 leading-relaxed" style={mono}>
            {active.note}
          </p>
        </div>

        {/* ── Rate chips ── */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active rate — highlighted */}
          <div
            className="text-center px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(201,168,76,0.10)',
              border:     '1px solid rgba(201,168,76,0.25)',
            }}
          >
            <p className="text-[8px] tracking-[0.14em] uppercase text-[#4A6070] mb-0.5" style={mono}>
              {mode === 'FCFF' ? 'WACC' : 'Ke'}
            </p>
            <p className="text-[16px] font-semibold text-[#C9A84C] leading-none" style={mono}>
              {(mode === 'FCFF' ? wacc : ke).toFixed(2)}%
            </p>
          </div>

          {/* Inactive rate — dimmed for reference */}
          <div
            className="text-center px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1A2840' }}
          >
            <p className="text-[8px] tracking-[0.14em] uppercase text-[#4A6070] mb-0.5" style={mono}>
              {inactive.key === 'FCFF' ? 'WACC' : 'Ke'}
            </p>
            <p className="text-[14px] font-medium text-[#4A6070] leading-none" style={mono}>
              {(inactive.key === 'FCFF' ? wacc : ke).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* ── Mode-change hint ── */}
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid #1A2840' }}
      >
        <span className="text-[9px] text-[#4A6070]" style={mono}>
          {mode === 'FCFF'
            ? '⚡ Switch to FCFE — base FCF auto-adjusts to FCFF − after-tax interest + net borrowing (ΔDebt)'
            : '⚡ Switch to FCFF — base FCF resets to reported free cash flow, discount rate → WACC'}
        </span>
      </div>
    </div>
  )
}