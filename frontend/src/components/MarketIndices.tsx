import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllIndices, type IndexData } from '../api/indices'

const mono = { fontFamily: "'IBM Plex Mono', monospace" }

export default function MarketIndices() {
  const navigate = useNavigate()
  const [indices, setIndices] = useState<IndexData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIndices()
    const interval = setInterval(fetchIndices, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const fetchIndices = async () => {
    try {
      const data = await getAllIndices()
      setIndices(data)
    } catch (err) {
      console.error('Failed to fetch indices:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-6 w-20 bg-[#0A1628]/40 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {indices.map(({ key, name, quote }) => {
        // Skip rendering if quote data is invalid
        if (!quote || quote.c === undefined || quote.c === null) {
          return null
        }

        const isPositive = quote.dp >= 0
        const displayName = name.split(' ')[0] // "S&P", "Dow", "Nasdaq"
        
        return (
          <button
            key={key}
            onClick={() => navigate(`/index/${key}`)}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#B8943C]/10 bg-[#020810]/60 hover:border-[#B8943C]/25 hover:bg-[#0A1628]/60 transition-all"
            style={mono}>
            
            {/* Index name */}
            <span className="text-[9px] tracking-[0.12em] uppercase text-[#8BA4BE] group-hover:text-[#C9A84C] transition-colors">
              {displayName}
            </span>

            {/* Separator */}
            <div className="w-px h-3 bg-[#B8943C]/15" />

            {/* Price */}
            <span className="text-[10px] font-medium text-[#EDE8DF]">
              {quote.c.toLocaleString('en-US', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })}
            </span>

            {/* Change */}
            <span 
              className={`text-[9px] font-medium ${
                isPositive ? 'text-[#4CAF85]' : 'text-[#E05252]'
              }`}>
              {isPositive ? '▲' : '▼'} {Math.abs(quote.dp).toFixed(2)}%
            </span>
          </button>
        )
      })}
    </div>
  )
}