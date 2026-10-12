import api from './axios'
import type { StockNewsInsight } from '../types'

export const getStockInsights = async (symbol: string): Promise<StockNewsInsight> => {
  const response = await api.get(`/insights/stock/${symbol}`)
  return response.data
}

export const getPortfolioInsights = async (portfolioId: number) => {
  const response = await api.get(`/insights/portfolio/${portfolioId}`)
  return response.data
}