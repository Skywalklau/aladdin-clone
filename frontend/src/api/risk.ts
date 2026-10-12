import api from './axios'
import type { PortfolioRiskSummary } from '../types'

export const getPortfolioRisk = async (
  portfolioId: number,
  confidenceLevel: number = 0.95,
  riskFreeRate: number = 0.04
): Promise<PortfolioRiskSummary> => {
  const response = await api.get('/risk/portfolio', {
    params: {
      portfolio_id: portfolioId,
      confidence_level: confidenceLevel,
      risk_free_rate: riskFreeRate,
    }
  })
  return response.data
}