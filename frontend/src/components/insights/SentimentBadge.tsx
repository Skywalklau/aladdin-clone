import { mono } from '../../lib/trading'
import { getSentimentMeta } from '../../lib/insights'

interface SentimentBadgeProps { sentiment: string }

function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const meta = getSentimentMeta(sentiment)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] tracking-[0.12em] uppercase font-medium"
      style={{ ...mono, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}25` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  )
}

export default SentimentBadge