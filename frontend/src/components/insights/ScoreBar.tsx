import { mono } from '../../lib/trading'

interface ScoreBarProps { score: number }

function ScoreBar({ score }: ScoreBarProps) {
  const pct   = ((score + 1) / 2) * 100
  const color = score >= 0.3 ? '#4CAF85' : score >= -0.3 ? '#C9A84C' : '#E05252'
  return (
    <div className="w-full mt-3">
      <div className="flex justify-between mb-1.5">
        <span className="text-[9px] tracking-[0.12em] uppercase text-[#8BA4BE]" style={mono}>
          Sentiment Score
        </span>
        <span className="text-[10px] font-medium" style={{ ...mono, color }}>
          {score >= 0 ? '+' : ''}{score.toFixed(2)}
        </span>
      </div>
      <div className="w-full h-1 bg-[#0A1628] rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#B8943C]/20" />
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}60, ${color})` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[8px] text-[#8BA4BE]" style={mono}>−1 bearish</span>
        <span className="text-[8px] text-[#8BA4BE]" style={mono}>+1 bullish</span>
      </div>
    </div>
  )
}

export default ScoreBar