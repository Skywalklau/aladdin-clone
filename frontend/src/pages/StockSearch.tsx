import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import MarketIndices from '../components/MarketIndices'
import { mono, serif, sans } from '../lib/trading'

// ── TYPES & CONSTANTS ───────────────────────────────────────────────────────

interface SearchResult {
  symbol: string
  description: string
  displaySymbol?: string // Made optional to match Suggested list
  type: string
}

const RECENT_KEY  = 'aladdin_recent_searches'
const MAX_RECENT  = 6
const STOCK_TYPES = new Set(['Common Stock', 'EQS', 'N/A', ''])

const SUGGESTED: SearchResult[] = [
  { symbol: 'AAPL',  description: 'Apple Inc.',             type: 'Common Stock' },
  { symbol: 'NVDA',  description: 'NVIDIA Corporation',     type: 'Common Stock' },
  { symbol: 'MSFT',  description: 'Microsoft Corporation',  type: 'Common Stock' },
  { symbol: 'GOOGL', description: 'Alphabet Inc.',          type: 'Common Stock' },
  { symbol: 'AMZN',  description: 'Amazon.com Inc.',        type: 'Common Stock' },
  { symbol: 'META',  description: 'Meta Platforms Inc.',    type: 'Common Stock' },
  { symbol: 'TSLA',  description: 'Tesla Inc.',             type: 'Common Stock' },
  { symbol: 'JPM',   description: 'JPMorgan Chase & Co.',   type: 'Common Stock' },
]

// ── HELPERS ──────────────────────────────────────────────────────────────────

function loadRecent(): SearchResult[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') }
  catch { return [] }
}

function saveRecent(result: SearchResult) {
  const prev    = loadRecent().filter(r => r.symbol !== result.symbol)
  const updated = [result, ...prev].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
}

// ── COMPONENT ────────────────────────────────────────────────────────────────

export default function StockSearch() {
  const navigate = useNavigate()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [focused,  setFocused]  = useState(false)
  const [active,   setActive]   = useState(-1)
  const [recent,   setRecent]   = useState<SearchResult[]>(loadRecent)

  const inputRef = useRef<HTMLInputElement>(null)
  // Fix: Provide initial value 'null' to satisfy TypeScript
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Search Logic with Race-Condition Protection ───────────────────────────
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current)
    
    if (!query.trim()) { 
      setResults([])
      setLoading(false)
      return 
    }

    let isCurrent = true // Prevent state updates if query changes before fetch finishes
    setLoading(true)

    timerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/stocks/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        
        if (!isCurrent) return

        const hits: SearchResult[] = (data.result || [])
          .filter((r: SearchResult) =>
            STOCK_TYPES.has(r.type) &&
            !r.symbol.includes('.') && 
            r.symbol.length <= 5
          )
          .slice(0, 8)
          
        setResults(hits)
      } catch (err) {
        if (isCurrent) setResults([])
      } finally {
        if (isCurrent) setLoading(false)
      }
    }, 280)

    return () => {
      isCurrent = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  const handleSelect = useCallback((r: SearchResult) => {
    saveRecent(r)
    setRecent(loadRecent())
    navigate(`/stock/${r.symbol}`)
  }, [navigate])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const displayList = query.trim() ? results : (focused ? recent : [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!displayList.length) return
    if (e.key === 'ArrowDown') { 
      e.preventDefault()
      setActive(a => Math.min(a + 1, displayList.length - 1)) 
    }
    if (e.key === 'ArrowUp') { 
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0)) 
    }
    if (e.key === 'Enter' && active >= 0) { 
      e.preventDefault()
      handleSelect(displayList[active]) 
    }
    if (e.key === 'Escape') { 
      inputRef.current?.blur()
      setFocused(false) 
    }
  }

  const showDropdown = focused && displayList.length > 0
  const dropTitle    = query.trim() ? null : 'Recent searches'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn  { to { opacity: 1; } }
      `}</style>

      <div className="min-h-screen bg-[#020810] text-[#EDE8DF]" style={sans}>

        {/* ── NAVBAR ── */}
        <nav className="border-b border-[#B8943C]/10 px-10 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#020810]/95 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate(-1)}
              className="text-[11px] tracking-[0.12em] uppercase text-[#8BA4BE] hover:text-[#EDE8DF] transition-colors"
              style={mono}>
              ← Back
            </button>
            <div className="w-px h-4 bg-[#B8943C]/20" />
            <button onClick={() => navigate('/')} className="text-[22px] font-bold hover:opacity-80 transition-opacity" style={serif}>
              Ala<span className="text-[#C9A84C]">ddin</span>
            </button>
          </div>
          <MarketIndices />
        </nav>

        <div className="max-w-2xl mx-auto px-8 pt-20 pb-16">

          {/* ── Header ── */}
          <div className="text-center mb-12 animate-[fadeUp_0.6s_ease-out_forwards]">
            <p className="text-[10px] tracking-[0.28em] uppercase text-[#B8943C] mb-3" style={mono}>
              Stock Lookup
            </p>
            <h1 className="text-[40px] font-semibold leading-tight mb-3" style={serif}>
              Search any stock
            </h1>
            <p className="text-[12px] text-[#8BA4BE] font-light">
              Charts · Financials · DCF · AI Analysis
            </p>
          </div>

          {/* ── Search ── */}
          <div className="relative animate-[fadeUp_0.6s_0.15s_ease-out_forwards] opacity-0" style={{ animationFillMode: 'forwards' }}>

            {/* Input Wrapper */}
            <div
              className="relative transition-all duration-200"
              style={{
                border:     `1px solid ${focused ? '#C9A84C40' : '#B8943C18'}`,
                borderRadius: 14,
                boxShadow:  focused ? '0 0 32px #C9A84C0A' : 'none',
                background: '#040D1A',
              }}>

              <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: focused ? '#C9A84C80' : '#4A6070' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>

              <input
                ref={inputRef}
                type="text"
                placeholder="Ticker or company name…"
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(-1) }}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent outline-none pl-12 pr-14 py-4 text-[15px] text-[#EDE8DF] placeholder-[#2E4460]"
                style={{ ...mono, letterSpacing: '0.04em' }}
                autoComplete="off"
                spellCheck={false}
              />

              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                {loading ? (
                  <div className="w-4 h-4 border border-[#C9A84C]/20 border-t-[#C9A84C]/60 rounded-full animate-spin" />
                ) : query ? (
                  <button
                    onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
                    className="text-[#4A6070] hover:text-[#8BA4BE] transition-colors text-[16px] leading-none"
                    style={mono}>
                    ×
                  </button>
                ) : null}
              </div>
            </div>

            {/* ── Dropdown ── */}
            {showDropdown && (
              <div
                className="absolute w-full mt-2 overflow-hidden z-50"
                style={{
                  background:   '#040D1A',
                  border:       '1px solid #B8943C18',
                  borderRadius: 12,
                  boxShadow:    '0 24px 48px #00000060',
                }}>

                {dropTitle && (
                  <div className="px-5 pt-3.5 pb-2 flex items-center justify-between">
                    <span className="text-[9px] tracking-[0.2em] uppercase text-[#4A6070]" style={mono}>
                      {dropTitle}
                    </span>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); localStorage.removeItem(RECENT_KEY); setRecent([]) }}
                      className="text-[9px] tracking-[0.1em] uppercase text-[#4A6070] hover:text-[#8BA4BE] transition-colors"
                      style={mono}>
                      Clear
                    </button>
                  </div>
                )}

                {displayList.map((r, i) => (
                  <button
                    key={`${r.symbol}-${i}`}
                    onMouseDown={() => handleSelect(r)}
                    onMouseEnter={() => setActive(i)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-colors"
                    style={{
                      background:   i === active ? '#0F1E35' : 'transparent',
                      borderBottom: i < displayList.length - 1 ? '1px solid #B8943C08' : 'none',
                    }}>

                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: '#0A1628', border: '1px solid #B8943C15' }}>
                        <span className="text-[8px] font-medium text-[#C9A84C]" style={mono}>
                          {r.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#EDE8DF]" style={mono}>{r.symbol}</p>
                        <p className="text-[10px] text-[#4A6070] mt-0.5 truncate max-w-[240px]">{r.description}</p>
                      </div>
                    </div>

                    <span className="text-[9px] tracking-[0.1em] uppercase text-[#C9A84C]/40 ml-4 flex-shrink-0" style={mono}>
                      {i === active ? '→' : (r.type === 'Common Stock' ? 'Stock' : r.type || 'Stock')}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* No results state */}
            {focused && query.trim() && !loading && results.length === 0 && (
              <div
                className="absolute w-full mt-2 px-5 py-6 text-center"
                style={{ background: '#040D1A', border: '1px solid #B8943C18', borderRadius: 12 }}>
                <p className="text-[11px] text-[#4A6070]" style={mono}>No results for "{query}"</p>
                <p className="text-[10px] text-[#2E4460] mt-1" style={mono}>Try a ticker symbol like AAPL or MSFT</p>
              </div>
            )}
          </div>

          {/* ── Suggestions ── */}
          {!query && !showDropdown && (
            <div className="mt-12 animate-[fadeUp_0.6s_0.25s_ease-out_forwards] opacity-0" style={{ animationFillMode: 'forwards' }}>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A6070] mb-4 text-center" style={mono}>
                Popular stocks
              </p>
              <div className="grid grid-cols-4 gap-2">
                {SUGGESTED.map(s => (
                  <button
                    key={s.symbol}
                    onClick={() => handleSelect(s)}
                    className="group rounded-xl px-4 py-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 bg-[#040D1A] border border-[#B8943C12] hover:border-[#C9A84C30] hover:shadow-[0_0_16px_#C9A84C08]">
                    <p className="text-[12px] font-medium text-[#C9A84C]" style={mono}>{s.symbol}</p>
                    <p className="text-[9px] text-[#4A6070] mt-0.5 truncate leading-relaxed">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}