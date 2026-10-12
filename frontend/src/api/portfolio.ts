import api from './axios'
import type { Portfolio, PortfolioSummary } from '../types'

export const listPortfolios = async (): Promise<Portfolio[]> => {
  const response = await api.get('/portfolio/')
  return response.data
}

export const getPortfolio = async (portfolioId: number): Promise<PortfolioSummary> => {
  const response = await api.get(`/portfolio/${portfolioId}`)
  return response.data
}

export const uploadPortfolio = async (file: File, name: string): Promise<Portfolio> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post(`/portfolio/upload?portfolio_name=${encodeURIComponent(name)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return response.data
}

export const deletePortfolio = async (portfolioId: number): Promise<void> => {
  await api.delete(`/portfolio/${portfolioId}`)
}