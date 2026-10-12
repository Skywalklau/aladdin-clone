import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPortfolioInsights, getStockInsights } from '../api/insights'
import type { PortfolioInsight, StockNewsInsight } from '../types/index'
import MarketIndices from '../components/MarketIndices'
import PortfolioTab from '../components/insights/PortfolioTab'
import StockTab from '../components/insights/StockTab'
import { mono, serif, sans } from '../lib/trading'

const GOOGLE_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');`

const TABS = [
  { key: 'portfolio' as const, label: 'Portfolio Insights', icon: '◎' },
  { key: 'stock'     as const, label: 'Stock Lookup',       icon: '▣' },
]

export default function Insights() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [portfolioInsight, setPortfolioInsight] = useState<PortfolioInsight | null>(null)
  const [stockInsight,     setStockInsight]     = useState<StockNewsInsight | null>(null)
  const [activeTab,        setActiveTab]        = useState<'portfolio' | 'stock'>('portfolio')
  const [loadingPortfolio, setLoadingPortfolio] = useState(false)
  const [loadingStock,     setLoadingStock]     = useState(false)
  const [portfolioError,   setPortfolioError]   = useState('')
  const [stockError,       setStockError]       = useState('')

  const fetchPortfolioInsights = async () => {
    if (!id) return
    setLoadingPortfolio(true); setPortfolioError('')
    try {
      setPortfolioInsight(await getPortfolioInsights(parseInt(id)))
    } catch {
      setPortfolioError('Failed to load portfolio insights')
    } finally {
      setLoadingPortfolio(false)
    }
  }

  const fetchStockInsights = async (symbol: string) => {
    setLoadingStock(true); setStockError(''); setStockInsight(null)
    try {
      setStockInsight(await getStockInsights(symbol))
    } catch {
      setStockError('Failed to load stock insights')
    } finally {
      setLoadingStock(false)
    }
  }

  return (
    <>
      <style>{`
        ${GOOGLE_FONTS}
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

        {/* ── NAVBAR ── */}
        <nav className="border-b border-[#B8943C]/10 px-10 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#020810]/95 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate(`/portfolio/${id}`)}
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors"
              style={mono}>
              ← Back
            </button>
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <button onClick={() => navigate('/')} className="text-[22px] font-bold hover:opacity-80 transition-opacity" style={serif}>
              Ala<span className="text-[#C9A84C]">ddin</span>
            </button>
          </div>
          <div className="flex items-center gap-5">
            <MarketIndices />
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8BA4BE]" style={mono}>AI Insights</p>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-8 py-10">

          {/* ── HEADER ── */}
          <div className="mb-8 opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.05s_forwards]">
            <p className="text-[10px] tracking-[0.24em] text-[#B8943C] uppercase mb-2" style={mono}>
              Intelligence
            </p>
            <h1 className="text-[36px] font-semibold leading-tight" style={serif}>
              AI Insights
            </h1>
            <p className="text-[12px] text-[#8BA4BE] mt-1.5 font-light">
              News sentiment · Finnhub data · OpenAI analysis
            </p>
          </div>

          {/* ── TABS ── */}
          <div className="flex gap-1 mb-6 border border-[#B8943C]/10 rounded-xl p-1 w-fit opacity-0 translate-y-3 animate-[fadeUp_0.6s_0.1s_forwards] bg-[#020810]/60">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[11px] tracking-[0.1em] uppercase transition-all duration-200 cursor-pointer"
                style={{
                  ...mono,
                  background: activeTab === key ? 'linear-gradient(135deg, #C9A84C 0%, #A8892E 100%)' : 'transparent',
                  color:      activeTab === key ? '#020810' : '#8BA4BE',
                }}>
                <span className="text-[11px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* ── TAB CONTENT ── */}
          {activeTab === 'portfolio' && (
            <PortfolioTab
              portfolioInsight={portfolioInsight}
              loadingPortfolio={loadingPortfolio}
              portfolioError={portfolioError}
              onFetch={fetchPortfolioInsights}
            />
          )}
          {activeTab === 'stock' && (
            <StockTab
              stockInsight={stockInsight}
              loadingStock={loadingStock}
              stockError={stockError}
              onFetch={fetchStockInsights}
            />
          )}

        </div>
      </div>
    </>
  )
}