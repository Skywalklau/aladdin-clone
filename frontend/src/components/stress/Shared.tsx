import { mono, fmtPct } from '../../lib/stress'

// Used in result views and configs
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] tracking-[0.22em] text-[#8BA4BE] uppercase mb-2.5" style={mono}>
      {children}
    </p>
  )
}

// Used in PositionsTable and ReverseResultView
export function ShockBadge({ pct }: { pct: number }) {
  const v = Math.abs(pct * 100)
  let color = '#C9A84C', bg = 'rgba(201,168,76,0.08)', border = 'rgba(201,168,76,0.15)'
  if (pct > 0)      { color = '#4CAF85'; bg = 'rgba(76,175,133,0.08)';  border = 'rgba(76,175,133,0.15)'  }
  else if (v >= 25) { color = '#E05252'; bg = 'rgba(224,82,82,0.08)';   border = 'rgba(224,82,82,0.15)'   }
  else if (v >= 10) { color = '#E07B52'; bg = 'rgba(224,123,82,0.08)';  border = 'rgba(224,123,82,0.15)'  }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ ...mono, color, background: bg, border: `1px solid ${border}` }}
    >
      {fmtPct(pct * 100)}
    </span>
  )
}