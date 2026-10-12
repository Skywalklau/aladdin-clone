import type { SelectedBar, BarAnalysis } from '../../types/index'
import { mono, serif, sans } from '../../lib/trading'
import { fmtB } from '../../lib/formatters'
import BarChart from './BarChart'

interface AnalysisPanelProps {
  selected: SelectedBar | null
  analysis: BarAnalysis | null
  loading:  boolean
  onClose:  () => void
}

function AnalysisPanel({ selected, analysis, loading, onClose }: AnalysisPanelProps) {
  if (!selected) return null

  const sc = analysis?.sentiment === 'positive'
    ? '#4CAF85'
    : analysis?.sentiment === 'negative'
      ? '#E05252'
      : '#C9A84C'

  return (
    <div className="flex flex-col rounded-xl overflow-hidden h-full" style={{
      background:  '#060E1D',
      border:      `1px solid ${selected.color}20`,
      boxShadow:   `0 0 40px ${selected.color}0A`,
    }}>
      {/* Colour accent bar */}
      <div className="h-[2px] flex-shrink-0"
        style={{ background: `linear-gradient(90deg, ${selected.color}, ${selected.color}15)` }} />

      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1A2840] flex items-start justify-between flex-shrink-0">
        <div className="min-w-0 flex-1 mr-3">
          <p className="text-[8px] tracking-[0.16em] uppercase mb-1"
            style={{ ...mono, color: `${selected.color}90` }}>
            AI Analysis
          </p>
          <p className="text-[14px] font-medium truncate" style={{ ...serif, color: '#EDE8DF' }}>
            {selected.label}
          </p>
          <p className="text-[10px] mt-0.5" style={{ ...mono, color: selected.color }}>
            {selected.period} · {fmtB(selected.value)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {analysis && (
            <span className="text-[9px] px-2 py-0.5 rounded font-medium"
              style={{ ...mono, color: sc, background: `${sc}15` }}>
              {analysis.context_tag}
            </span>
          )}
          <button onClick={onClose}
            className="text-[#2E4460] hover:text-[#EDE8DF] transition-colors text-[16px] leading-none">
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: `${selected.color}20`, borderTopColor: selected.color }} />
            <p className="text-[9px] text-[#4A6070]" style={mono}>
              Analysing {selected.period}…
            </p>
          </div>
        )}

        {analysis && !loading && (
          <>
            <div className="rounded-xl px-4 py-3"
              style={{ background: `${selected.color}07`, border: `1px solid ${selected.color}15` }}>
              <p className="text-[13px] font-medium text-[#EDE8DF] leading-snug" style={serif}>
                {analysis.headline}
              </p>
            </div>

            <div>
              <p className="text-[8px] tracking-[0.15em] uppercase text-[#4A6070] mb-2" style={mono}>
                Analysis
              </p>
              <p className="text-[11px] text-[#8BA4BE] leading-[1.75]" style={sans}>
                {analysis.analysis}
              </p>
            </div>

            <div className="rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1A2840' }}>
              <p className="text-[8px] tracking-[0.15em] uppercase text-[#C9A84C]/50 mb-1.5" style={mono}>
                Watch
              </p>
              <p className="text-[11px] text-[#8BA4BE] leading-relaxed" style={mono}>
                {analysis.watch}
              </p>
            </div>

            {analysis.yoy_change != null && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{
                background: analysis.yoy_change >= 0 ? 'rgba(76,175,133,0.06)' : 'rgba(224,82,82,0.06)',
                border:     `1px solid ${analysis.yoy_change >= 0 ? '#4CAF8520' : '#E0525220'}`,
              }}>
                <p className="text-[10px] font-medium"
                  style={{ ...mono, color: analysis.yoy_change >= 0 ? '#4CAF85' : '#E05252' }}>
                  {analysis.yoy_change >= 0 ? '▲' : '▼'} {Math.abs(analysis.yoy_change).toFixed(1)}% YoY
                </p>
                <p className="text-[9px] text-[#4A6070]" style={mono}>vs prior year</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mini history chart at the bottom */}
      <div className="px-5 pt-3 pb-4 border-t border-[#1A2840] flex-shrink-0">
        <p className="text-[8px] tracking-[0.12em] uppercase text-[#1A2840] mb-2" style={mono}>
          Full history
        </p>
        <div style={{ height: 36 }}>
          <BarChart
            data={selected.history}
            color={selected.color}
            selectedPeriod={selected.period}
            onSelect={() => {}}
            format={fmtB}
          />
        </div>
      </div>
    </div>
  )
}

export default AnalysisPanel