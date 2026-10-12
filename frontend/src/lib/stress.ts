import type { StressResult, ReverseResult, ComprehensiveResult } from '../types/index'
import { fmt$, fmtPctSigned as fmtPct } from './formatters'

export { mono, serif, sans } from './trading'
export { fmt$, fmt$d, fmtPctSigned as fmtPct, lossClr } from './formatters'

// ── Scenario registry ─────────────────────────────────────────────────────────

export const SCENARIOS = [
  { id: 'market',        label: 'Market Crash',   icon: '▼', desc: 'Broad decline, beta-adjusted'     },
  { id: 'sector',        label: 'Sector Shock',   icon: '◈', desc: 'Single sector, spillover'         },
  { id: 'multisector',   label: 'Multi-Sector',   icon: '⊞', desc: 'Contagion across sectors'         },
  { id: 'rate',          label: 'Rate Change',    icon: '≋', desc: 'Duration-based sensitivity'       },
  { id: 'historical',    label: 'Historical',     icon: '○', desc: 'Real market crises replayed'      },
  { id: 'custom',        label: 'Custom',         icon: '◧', desc: 'Per-ticker manual shocks'         },
  { id: 'reverse',       label: 'Reverse Stress', icon: '↺', desc: 'Find the breaking point'          },
  { id: 'comprehensive', label: 'Comprehensive',  icon: '▣', desc: 'All scenarios at once'            },
] as const

export type ScenarioId = typeof SCENARIOS[number]['id']

export const ALL_SECTORS = [
  'Technology', 'Communication Services', 'Financial Services', 'Consumer Cyclical',
  'Healthcare', 'Industrials', 'Consumer Defensive', 'Energy', 'Real Estate',
  'Basic Materials', 'Utilities',
]

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResultPayload =
  | { type: 'stress';        data: StressResult }
  | { type: 'reverse';       data: ReverseResult }
  | { type: 'comprehensive'; data: ComprehensiveResult }

export interface ConfigProps {
  portfolioId: number
  onResult:    (r: ResultPayload) => void
  loading:     boolean
  setLoading:  (v: boolean) => void
  setError:    (v: string) => void
  sectors:     string[]
}

// ── Headline extractor ────────────────────────────────────────────────────────

export function getHeadline(result: ResultPayload): { pct: number; value: string } | null {
  if (result.type === 'stress')        return { pct: result.data.total_value_change_pct,      value: fmt$(result.data.total_value_change) }
  if (result.type === 'reverse')       return { pct: result.data.required_market_shock * 100, value: `${fmtPct(result.data.required_market_shock * 100)} shock` }
  if (result.type === 'comprehensive') return { pct: result.data.worst_case_loss_pct,          value: fmt$(result.data.average_loss_across_scenarios) }
  return null
}