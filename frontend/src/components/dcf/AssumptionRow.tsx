import { useState, useEffect, useCallback, useRef } from 'react'
import { mono } from '../../lib/dcf'

export function AssumptionRow({
  label, value, min, max, step, unit, hint, onChange,
}: {
  label:    string
  value:    number
  min:      number
  max:      number
  step:     number
  unit:     '$' | '%' | ' yrs' | ' shares'
  hint?:    string
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(formatDisplay(value, unit))
  const holdTimer  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const holdRepeat = useRef<ReturnType<typeof setInterval> | null>(null)
  const valueRef   = useRef(value)

  function formatDisplay(v: number, u: string): string {
    if (u === '$')       return (v / 1e9).toFixed(3)
    if (u === ' shares') return (v / 1e9).toFixed(3)
    if (u === ' yrs')    return String(Math.round(v))
    return v.toFixed(2)
  }

  function parseInput(raw: string, u: string): number | null {
    const n = parseFloat(raw)
    if (isNaN(n)) return null
    if (u === '$' || u === ' shares') return n * 1e9
    return n
  }

  useEffect(() => { setDraft(formatDisplay(value, unit)) }, [value])
  useEffect(() => { valueRef.current = value }, [value])

  const commit = () => {
    const parsed = parseInput(draft, unit)
    if (parsed !== null) {
      const clamped = Math.min(Math.max(parsed, min), max)
      onChange(clamped)
      setDraft(formatDisplay(clamped, unit))
    } else {
      setDraft(formatDisplay(value, unit))
    }
  }

  const nudge = useCallback((dir: 1 | -1) => {
    const next = Math.min(Math.max(valueRef.current + dir * step, min), max)
    onChange(next)
  }, [step, min, max, onChange])

  const startHold = (dir: 1 | -1) => {
    nudge(dir)
    holdTimer.current = setTimeout(() => {
      holdRepeat.current = setInterval(() => nudge(dir), 60)
    }, 350)
  }

  const stopHold = () => {
    if (holdTimer.current)  clearTimeout(holdTimer.current)
    if (holdRepeat.current) clearInterval(holdRepeat.current)
    holdTimer.current  = null
    holdRepeat.current = null
  }

  useEffect(() => () => stopHold(), [])

  const unitLabel = unit === '$' ? 'B' : unit === ' shares' ? 'B shs' : unit

  const StepBtn = ({ dir, label }: { dir: 1 | -1; label: string }) => (
    <button
      onMouseDown={() => startHold(dir)}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={() => startHold(dir)}
      onTouchEnd={stopHold}
      className="w-7 h-8 flex items-center justify-center rounded-lg text-[14px] select-none transition-colors"
      style={{ ...mono, background: '#020810', border: '1px solid #1A2840', color: '#4A6070' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
      onMouseOut={e => (e.currentTarget.style.color = '#4A6070')}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-[11px] tracking-[0.10em] uppercase text-[#8BA4BE]" style={mono}>{label}</p>
        {hint && <p className="text-[10px] text-[#4A6070] mt-0.5 leading-relaxed" style={mono}>{hint}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <StepBtn dir={-1} label="−" />
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          className="w-20 bg-[#020810] border border-[#1A2840] rounded-lg px-2.5 py-1.5 text-[13px] text-[#C9A84C] text-center focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
          style={mono}
        />
        <StepBtn dir={1} label="+" />
        <span className="text-[11px] text-[#4A6070] w-9 ml-0.5" style={mono}>{unitLabel}</span>
      </div>
    </div>
  )
}