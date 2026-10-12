import { useState } from 'react'
import type { PortfolioInsight } from '../../types/index'
import { mono, sans } from '../../lib/trading'
import { formatDate } from '../../lib/formatters'
import { getSentimentMeta } from '../../lib/insights'
import SentimentBadge from './SentimentBadge'
import ScoreBar from './ScoreBar'
import { Card, SectionLabel } from './InsightPrimitives'

interface PortfolioTabProps {
  portfolioInsight: PortfolioInsight | null
  loadingPortfolio: boolean
  portfolioError:   string
  onFetch:          () => void
}

function PortfolioTab({ portfolioInsight, loadingPortfolio, portfolioError, onFetch }: PortfolioTabProps) {
  const [expandedSector, setExpandedSector] = useState<string | null>(null)

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!portfolioInsight) {
    return (
      <div className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 flex flex-col items-center justify-center px-8 py-16 text-center opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.2s_forwards]">
        <span className="text-[22px] mb-5 text-[#C9A84C]" style={mono}>◎</span>
        <h2 className="text-[22px] font-semibold text-[#EDE8DF] mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Portfolio Intelligence
        </h2>
        <p className="text-[12px] text-[#8BA4BE] font-light leading-relaxed max-w-sm mb-1" style={sans}>
          Aggregates news sentiment across all positions via Finnhub + OpenAI.
        </p>
        <p className="text-[10px] text-[#8BA4BE] mb-8" style={mono}>Est. cost: $0.10 – $0.50 per run</p>
        <button
          onClick={onFetch}
          disabled={loadingPortfolio}
          className="px-8 py-3 rounded-md text-[11px] font-medium tracking-[0.2em] uppercase text-[#020810] hover:opacity-90 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
          {loadingPortfolio ? 'Analysing… (may take a moment)' : 'Generate Insights'}
        </button>
        {portfolioError && (
          <p className="text-[#E05252] text-[10px] mt-5" style={mono}>⚠ {portfolioError}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Overall Sentiment */}
      <Card className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.05s_forwards]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <SectionLabel>Overall Sentiment</SectionLabel>
            <SentimentBadge sentiment={portfolioInsight.overall_sentiment} />
          </div>
          <button
            onClick={onFetch}
            disabled={loadingPortfolio}
            className="text-[10px] tracking-[0.1em] uppercase text-[#8BA4BE] hover:text-[#C9A84C] transition-colors flex-shrink-0 disabled:opacity-40 cursor-pointer"
            style={mono}>
            {loadingPortfolio ? 'Refreshing…' : '↺ Refresh'}
          </button>
        </div>
        <p className="text-[13px] text-[#EDE8DF] leading-relaxed font-light" style={sans}>
          {portfolioInsight.ai_summary}
        </p>
        <ScoreBar score={portfolioInsight.sentiment_score} />
        <p className="text-[9px] text-[#8BA4BE] mt-3" style={mono}>
          Generated {formatDate(portfolioInsight.generated_at)}
        </p>
      </Card>

      {/* Alerts */}
      {portfolioInsight.alerts.length > 0 && (
        <div
          className="rounded-xl px-6 py-5 border opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.1s_forwards]"
          style={{ background: 'rgba(224,82,82,0.04)', borderColor: 'rgba(224,82,82,0.18)' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#E05252] text-[10px]" style={mono}>⚠</span>
            <SectionLabel>Alerts</SectionLabel>
          </div>
          <ul className="space-y-2.5">
            {portfolioInsight.alerts.map((alert, i) => (
              <li key={i} className="flex gap-3 text-[12px] text-[#EDE8DF] leading-relaxed font-light" style={sans}>
                <span className="text-[#E05252] flex-shrink-0 mt-px" style={mono}>—</span>
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Movers */}
      {portfolioInsight.top_movers_news.length > 0 && (
        <Card className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.15s_forwards]">
          <SectionLabel>Top Movers</SectionLabel>
          <ul className="space-y-2.5">
            {portfolioInsight.top_movers_news.map((item, i) => (
              <li key={i} className="flex gap-3 text-[12px] text-[#EDE8DF] leading-relaxed font-light" style={sans}>
                <span className="text-[#C9A84C] flex-shrink-0 mt-px text-[9px]" style={mono}>◆</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Position Insights */}
      <div className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.2s_forwards]">
        <SectionLabel>Position Insights</SectionLabel>
        <div className="space-y-2">
          {portfolioInsight.position_insights.map((pos, i) => {
            const meta = getSentimentMeta(pos.sentiment)
            return (
              <div
                key={pos.symbol}
                className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 hover:border-[#B8943C]/20 transition-colors opacity-0 translate-y-1"
                style={{ animation: `fadeUp 0.4s ${0.22 + i * 0.04}s forwards` }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md border flex items-center justify-center flex-shrink-0"
                      style={{ background: `${meta.color}10`, borderColor: `${meta.color}25` }}>
                      <span className="text-[9px] font-medium" style={{ ...mono, color: meta.color }}>
                        {pos.symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[14px] font-medium text-[#EDE8DF]" style={mono}>{pos.symbol}</span>
                      <div className="mt-0.5">
                        <SentimentBadge sentiment={pos.sentiment} />
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#8BA4BE] flex-shrink-0 mt-1" style={mono}>
                    {(pos.position_weight * 100).toFixed(1)}% weight
                  </span>
                </div>
                <p className="text-[12px] text-[#EDE8DF] leading-relaxed font-light mb-1" style={sans}>
                  {pos.key_news}
                </p>
                <p className="text-[11px] text-[#8BA4BE] font-light" style={sans}>{pos.potential_impact}</p>
                <ScoreBar score={pos.sentiment_score} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Sector Insights */}
      <div className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.3s_forwards]">
        <SectionLabel>Sector Breakdown</SectionLabel>
        <div className="space-y-2">
          {Object.entries(portfolioInsight.sector_insights).map(([sector, data], i) => {
            const isOpen = expandedSector === sector
            return (
              <div
                key={sector}
                className="border border-[#B8943C]/10 rounded-xl overflow-hidden bg-[#020810]/60 opacity-0 translate-y-1"
                style={{ animation: `fadeUp 0.4s ${0.32 + i * 0.04}s forwards` }}>
                <button
                  onClick={() => setExpandedSector(isOpen ? null : sector)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#0A1628]/40 transition-colors text-left group cursor-pointer">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[12px] font-medium text-[#EDE8DF]" style={mono}>{sector}</span>
                    <SentimentBadge sentiment={data.avg_sentiment} />
                    <span className="text-[10px] text-[#8BA4BE]" style={mono}>
                      {data.positions.join(' · ')}
                    </span>
                  </div>
                  <span className="text-[#8BA4BE]/40 group-hover:text-[#8BA4BE] transition-colors text-[11px] flex-shrink-0 ml-3" style={mono}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-[#B8943C]/8 px-5 py-5 space-y-4">
                    <p className="text-[12px] text-[#EDE8DF] leading-relaxed font-light" style={sans}>
                      {data.key_themes}
                    </p>
                    <p className="text-[11px] text-[#8BA4BE] font-light" style={sans}>
                      Risk: {data.sector_risk}
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <p className="text-[9px] tracking-[0.14em] uppercase text-[#4CAF85] mb-2.5" style={mono}>
                          Opportunities
                        </p>
                        <ul className="space-y-1.5">
                          {data.opportunities.map((o, j) => (
                            <li key={j} className="flex gap-2 text-[11px] text-[#EDE8DF] font-light leading-snug" style={sans}>
                              <span className="text-[#4CAF85] flex-shrink-0" style={mono}>+</span>
                              {o}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[9px] tracking-[0.14em] uppercase text-[#E05252] mb-2.5" style={mono}>
                          Threats
                        </p>
                        <ul className="space-y-1.5">
                          {data.threats.map((t, j) => (
                            <li key={j} className="flex gap-2 text-[11px] text-[#EDE8DF] font-light leading-snug" style={sans}>
                              <span className="text-[#E05252] flex-shrink-0" style={mono}>−</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <ScoreBar score={data.avg_sentiment_score} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

export default PortfolioTab