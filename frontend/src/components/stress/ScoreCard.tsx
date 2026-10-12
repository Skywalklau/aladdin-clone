import { mono, serif, fmtPct, lossClr, getHeadline } from '../../lib/stress'
import type { ResultPayload, SCENARIOS } from '../../lib/stress'

interface ScoreCardProps {
  scenario: typeof SCENARIOS[number]
  result:   ResultPayload | undefined
  loading:  boolean
  isActive: boolean
  onClick:  () => void
}

export default function ScoreCard({ scenario, result, loading, isActive, onClick }: ScoreCardProps) {
  const headline = result ? getHeadline(result) : null
  const color    = headline ? lossClr(headline.pct) : undefined

  const cardBg = isActive
    ? 'linear-gradient(145deg, rgba(201,168,76,0.08), rgba(2,8,16,0.85))'
    : headline
      ? `linear-gradient(145deg, ${color}08, rgba(2,8,16,0.7))`
      : 'rgba(2,8,16,0.5)'

  return (
    <button onClick={onClick}
      className="relative flex flex-col text-left transition-all duration-200 overflow-hidden rounded-xl p-4 group"
      style={{
        background: cardBg,
        border:     `1px solid ${isActive ? '#C9A84C' : headline ? `${color}30` : 'rgba(184,148,60,0.1)'}`,
        boxShadow:  isActive ? `0 0 0 1px rgba(201,168,76,0.12) inset` : 'none',
        minHeight:  '100px',
      }}>

      {/* Status indicator */}
      <div className="absolute top-3 right-3 flex-shrink-0">
        {loading ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] block" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
        ) : result ? (
          <span className="w-1.5 h-1.5 rounded-full block" style={{ background: color }} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-[#4A6278] block" />
        )}
      </div>

      {/* Icon + label */}
      <div className="flex items-center gap-1.5 mb-auto">
        <span className="text-[11px] flex-shrink-0" style={{ ...mono, color: isActive ? '#C9A84C' : headline ? color : '#8BA4BE' }}>
          {scenario.icon}
        </span>
        <span className="text-[9px] tracking-[0.1em] uppercase font-medium truncate leading-tight"
          style={{ ...mono, color: isActive ? '#EDE8DF' : result ? '#EDE8DF' : '#C0CDD9' }}>
          {scenario.label}
        </span>
      </div>

      {/* Metric or placeholder */}
      <div className="mt-3">
        {loading ? (
          <>
            <div className="h-5 w-16 rounded bg-[#0A1628] animate-pulse mb-1" />
            <div className="h-2.5 w-10 rounded bg-[#0A1628] animate-pulse opacity-50" />
          </>
        ) : headline ? (
          <>
            <p className="text-[20px] font-bold leading-none" style={{ ...serif, color }}>{fmtPct(headline.pct)}</p>
            <p className="text-[9px] text-[#8BA4BE] mt-1 truncate" style={mono}>{headline.value}</p>
          </>
        ) : (
          <p className="text-[11px]" style={{ ...mono, color: '#4A6278' }}>—</p>
        )}
      </div>

      {/* Active underline */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg,#C9A84C,#A8892E)' }} />
      )}
    </button>
  )
}