import { useState } from 'react'
import type { StockNewsInsight } from '../../types/index'
import { mono, sans } from '../../lib/trading'
import { formatDate } from '../../lib/formatters'
import { getSentimentMeta } from '../../lib/insights'
import SentimentBadge from './SentimentBadge'
import ScoreBar from './ScoreBar'
import { Card, SectionLabel } from './InsightPrimitives'

interface StockTabProps {
  stockInsight: StockNewsInsight | null
  loadingStock: boolean
  stockError:   string
  onFetch:      (symbol: string) => void
}

function StockTab({ stockInsight, loadingStock, stockError, onFetch }: StockTabProps) {
  const [stockSymbol, setStockSymbol] = useState('')

  const handleFetch = () => {
    const sym = stockSymbol.trim().toUpperCase()
    if (sym) onFetch(sym)
  }

  return (
    <div className="space-y-5">

      {/* Search bar */}
      <div className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-6 py-5 opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.05s_forwards]">
        <SectionLabel>Stock Lookup</SectionLabel>
        <div className="flex gap-3">
          <input
            type="text"
            value={stockSymbol}
            onChange={e => setStockSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleFetch()}
            placeholder="AAPL"
            maxLength={8}
            className="flex-1 bg-[#0A1628]/80 border border-[#B8943C]/15 text-[#EDE8DF] rounded-md px-4 py-3 text-[13px] outline-none focus:border-[#C9A84C]/50 focus:ring-2 focus:ring-[#C9A84C]/[0.07] transition-all placeholder:text-[#1A2C42] uppercase tracking-widest"
            style={mono}
          />
          <button
            onClick={handleFetch}
            disabled={loadingStock || !stockSymbol.trim()}
            className="px-6 py-3 rounded-md text-[11px] font-medium tracking-[0.18em] uppercase text-[#020810] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex-shrink-0"
            style={{ ...mono, background: 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' }}>
            {loadingStock ? 'Analysing…' : 'Analyse'}
          </button>
        </div>
        {stockError && (
          <p className="text-[#E05252] text-[10px] mt-3" style={mono}>⚠ {stockError}</p>
        )}
      </div>

      {/* Empty state */}
      {!stockInsight && !loadingStock && (
        <div className="border border-[#B8943C]/8 border-dashed rounded-xl py-14 text-center opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.12s_forwards]">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>
            Enter a ticker to view sentiment analysis
          </p>
        </div>
      )}

      {/* Results */}
      {stockInsight && (
        <>
          {/* Summary */}
          <Card className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.05s_forwards]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] tracking-[0.22em] text-[#B8943C] uppercase mb-2" style={mono}>
                  Analysis
                </p>
                <div className="flex items-center gap-3">
                  <h2 className="text-[28px] font-bold text-[#EDE8DF]"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {stockInsight.symbol}
                  </h2>
                  <SentimentBadge sentiment={stockInsight.overall_sentiment} />
                </div>
              </div>
              <p className="text-[9px] text-[#8BA4BE] flex-shrink-0 mt-1" style={mono}>
                {formatDate(stockInsight.generated_at)}
              </p>
            </div>
            <p className="text-[13px] text-[#EDE8DF] leading-relaxed font-light" style={sans}>
              {stockInsight.ai_summary}
            </p>
            <ScoreBar score={stockInsight.sentiment_score} />
          </Card>

          {/* Key Events */}
          {stockInsight.key_events.length > 0 && (
            <Card className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.1s_forwards]">
              <SectionLabel>Key Events</SectionLabel>
              <ul className="space-y-2.5">
                {stockInsight.key_events.map((event, i) => (
                  <li key={i} className="flex gap-3 text-[12px] text-[#EDE8DF] leading-relaxed font-light" style={sans}>
                    <span className="text-[#C9A84C] flex-shrink-0 mt-px text-[9px]" style={mono}>◆</span>
                    {event}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Potential Impact */}
          <Card className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.15s_forwards]">
            <SectionLabel>Potential Impact</SectionLabel>
            <p className="text-[12px] text-[#EDE8DF] leading-relaxed font-light" style={sans}>
              {stockInsight.potential_impact}
            </p>
          </Card>

          {/* Articles */}
          {stockInsight.top_articles.length > 0 && (
            <div className="opacity-0 translate-y-3 animate-[fadeUp_0.5s_0.2s_forwards]">
              <SectionLabel>Recent Coverage</SectionLabel>
              <div className="space-y-2">
                {stockInsight.top_articles.map((article, i) => {
                  const meta = getSentimentMeta(article.sentiment)
                  return (
                    <div
                      key={i}
                      className="border border-[#B8943C]/10 rounded-xl bg-[#020810]/60 px-5 py-4 hover:border-[#B8943C]/20 transition-colors opacity-0 translate-y-1"
                      style={{ animation: `fadeUp 0.4s ${0.22 + i * 0.04}s forwards` }}>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-medium text-[#EDE8DF] hover:text-[#C9A84C] transition-colors leading-snug flex-1"
                          style={sans}>
                          {article.title || 'Read article →'}
                        </a>
                        <SentimentBadge sentiment={article.sentiment} />
                      </div>
                      {article.summary && (
                        <p className="text-[11px] text-[#8BA4BE] mb-3 leading-relaxed font-light" style={sans}>
                          {article.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[9px] text-[#8BA4BE]" style={mono}>
                        <span>{article.source}</span>
                        <span>·</span>
                        <span>{formatDate(article.published_at)}</span>
                        <span className="ml-auto" style={{ color: meta.color }}>↗ Read</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}

export default StockTab