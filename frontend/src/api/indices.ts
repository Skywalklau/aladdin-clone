// API functions for market indices
import type { IndexQuote, IndexData } from '../types'

const INDICES = {
  SPX: { symbol: '^GSPC', name: 'S&P 500' },
  DJI: { symbol: '^DJI',  name: 'Dow Jones' },
  NDX: { symbol: '^IXIC', name: 'Nasdaq' },
} as const

export type IndexKey = keyof typeof INDICES

export async function getIndexQuote(symbol: string): Promise<IndexQuote> {
  console.log(`Fetching quote for ${symbol}...`)
  // Use the indices-specific endpoint that uses yfinance instead of Finnhub
  const res = await fetch(`/api/stocks/indices/${symbol}/quote`)
  if (!res.ok) {
    console.error(`API error for ${symbol}:`, res.status, res.statusText)
    throw new Error(`Failed to fetch index quote for ${symbol}`)
  }
  const data = await res.json()
  
  // Check for error in response
  if (data.error) {
    console.error(`Index API returned error for ${symbol}:`, data.error)
    throw new Error(data.error)
  }
  
  console.log(`Received quote for ${symbol}:`, data)
  return data
}

export async function getAllIndices(): Promise<IndexData[]> {
  const promises = Object.entries(INDICES).map(async ([key, { symbol, name }]): Promise<IndexData | null> => {
    try {
      const quote = await getIndexQuote(symbol)
      // Validate that we got valid data
      if (!quote || typeof quote.c !== 'number') {
        console.warn(`Invalid quote data for ${symbol}:`, quote)
        return null
      }
      return { key: key as IndexKey, symbol, name, quote }
    } catch (error) {
      console.error(`Failed to fetch quote for ${symbol}:`, error)
      return null
    }
  })
  
  const results = await Promise.all(promises)
  // Filter out failed fetches - type predicate ensures TypeScript knows nulls are removed
  return results.filter((item): item is IndexData => item !== null)
}

export function getIndexInfo(key: IndexKey) {
  return INDICES[key]
}