import api from './axios';
import type { StressResult, ReverseResult, ComprehensiveResult, HistoricalScenarioMeta } from '../types';

export const getMarketCrash = (portfolioId: number, severity: 'mild' | 'moderate' | 'severe') =>
  api.get<StressResult>('/stress/market_crash', { params: { portfolio_id: portfolioId, severity } });

export const getSectorShock = (portfolioId: number, params: {
  sector: string; shock_pct: number; use_sector_beta?: boolean;
  correlation_spillover?: number; use_correlations?: boolean;
}) => api.get<StressResult>('/stress/sector_shock', { params: { portfolio_id: portfolioId, ...params } });

export const getMultiSectorShock = (portfolioId: number, params: {
  sectors: string; use_sector_beta?: boolean;
  correlation_spillover?: number; use_correlations?: boolean;
}) => api.get<StressResult>('/stress/multi_sector_shock', { params: { portfolio_id: portfolioId, ...params } });

export const getInterestRate = (portfolioId: number, params: {
  rate_change_bps: number; bond_duration?: number; max_shock?: number; min_shock?: number;
}) => api.get<StressResult>('/stress/interest_rate', { params: { portfolio_id: portfolioId, ...params } });

export const getHistoricalScenario = (portfolioId: number, scenarioId: string) =>
  api.get<StressResult>(`/stress/historical/${scenarioId}`, { params: { portfolio_id: portfolioId } });

export const getHistoricalScenarios = () =>
  api.get<HistoricalScenarioMeta[]>('/stress/historical/scenarios');

export const runCustomScenario = (portfolioId: number, body: {
  scenario_name: string; shocks: Record<string, number>; market_shock?: number;
  apply_correlations?: boolean; correlation_spillover?: number;
}) => api.post<StressResult>('/stress/custom', body, { params: { portfolio_id: portfolioId } });

export const getReverseStress = (portfolioId: number, targetLossPct: number) =>
  api.get<ReverseResult>('/stress/reverse', { params: { portfolio_id: portfolioId, target_loss_pct: targetLossPct } });

export const getComprehensive = (portfolioId: number, useCorrelations = true) =>
  api.get<ComprehensiveResult>('/stress/comprehensive', { params: { portfolio_id: portfolioId, use_correlations: useCorrelations } });

export const getPortfolioSectors = (portfolioId: number) =>
  api.get<Record<string, string[]>>('/stress/portfolio/sectors', { params: { portfolio_id: portfolioId } });