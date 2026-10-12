// ============================================================================
// AUTH
// ============================================================================

export interface User {
  id: number;
  email: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ============================================================================
// PORTFOLIO
// ============================================================================

export interface Portfolio {
  id: number;
  name: string;
  created_at: string;
}

export interface Position {
  symbol: string
  quantity: number
  avg_price: number
  current_price: number
  prev_close: number
  market_value: number
  pnl: number
  allocation_pct: number
  daily_pnl: number
  daily_pnl_pct: number
}

export interface PortfolioSummary {
  total_value: number
  total_pnl: number
  total_daily_pnl: number
  positions: Position[]
}

// ============================================================================
// RISK
// ============================================================================

export interface PortfolioRiskSummary {
  total_value: number
  total_pnl: number
  portfolio_volatility: number
  correlations: Record<string, Record<string, number>>
  portfolio_beta: number
  historical_var: number
  parametric_var: number
  sharpe_ratio: number
  positions: Position[]
}

// ============================================================================
// INSIGHTS
// ============================================================================

export interface NewsArticle {
  title: string
  source: string
  published_at: string
  url: string
  sentiment: string
  sentiment_score: number
  relevant: boolean
  summary?: string
}

export interface StockNewsInsight {
  symbol: string
  overall_sentiment: string
  sentiment_score: number
  ai_summary: string
  key_events: string[]
  top_articles: NewsArticle[]
  potential_impact: string
  generated_at: string
}

export interface PositionInsight {
  symbol: string
  position_weight: number
  sentiment: string
  sentiment_score: number
  key_news: string
  potential_impact: string
}

export interface SectorInsight {
  position_count: number
  total_weight: number
  positions: string[]
  avg_sentiment: string
  avg_sentiment_score: number
  key_themes: string
  sector_risk: string
  opportunities: string[]
  threats: string[]
}

export interface PortfolioInsight {
  portfolio_id: number
  overall_sentiment: string
  sentiment_score: number
  ai_summary: string
  position_insights: PositionInsight[]
  sector_insights: Record<string, SectorInsight>
  top_movers_news: string[]
  alerts: string[]
  generated_at: string
}

// ============================================================================
// STRESS TESTING
// ============================================================================

export interface StressPosition {
  symbol: string;
  sector: string;
  quantity: number;
  avg_price: number;
  original_price: number;
  stressed_price: number;
  price_shock_pct: number;
  direct_shock_pct: number | null;
  spillover_shock_pct: number | null;
  original_market_value: number;
  stressed_market_value: number;
  value_change: number;
  value_change_pct: number;
  original_pnl: number;
  stressed_pnl: number;
  pnl_change: number;
}

export interface SectorExposure {
  sector: string;
  position_count: number;
  total_market_value: number;
  percentage_of_portfolio: number;
  average_shock: number;
  total_value_change: number;
}

export interface StressResult {
  scenario_name: string;
  description: string;
  scenario_type: string;
  applied_date: string;
  total_original_value: number;
  total_stressed_value: number;
  total_value_change: number;
  total_value_change_pct: number;
  total_original_pnl: number;
  total_stressed_pnl: number;
  total_pnl_change: number;
  positions: StressPosition[];
  sector_exposures: SectorExposure[];
  correlation_applied: boolean;
  average_correlation: number | null;
}

export interface ReverseResult {
  target_loss_pct: number;
  required_market_shock: number;
  scenario_description: string;
  affected_positions: StressPosition[];
}

export interface ComprehensiveResult {
  scenarios: StressResult[];
  worst_case_scenario: string;
  worst_case_loss: number;
  worst_case_loss_pct: number;
  best_case_scenario: string;
  best_case_loss: number;
  best_case_loss_pct: number;
  average_loss_across_scenarios: number;
  median_loss_across_scenarios: number;
  scenarios_with_loss_over_20pct: number;
  scenarios_with_loss_over_50pct: number;
}

export interface HistoricalScenarioMeta {
  scenario_id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  sp500_decline: number;
  market_shock: number;
  sector_shocks: Record<string, number>;
}

// ============================================================================
// INDICES
// ============================================================================

export interface IndexQuote {
  c: number   // current price
  d: number   // change
  dp: number  // change percent
  h: number   // day high
  l: number   // day low
  o: number   // open
  pc: number  // previous close
}

export interface IndexData {
  key: string
  symbol: string
  name: string
  quote: IndexQuote
}

// ============================================================================
// TRADING GAME
// ============================================================================

export interface Candle {
  o: number  // open
  h: number  // high
  l: number  // low
  c: number  // close
  v: number  // volume (normalised 0–1)
}

export interface Asset {
  id:    string
  name:  string
  base:  number
  vol:   number
  color: string
}

// Note: TradingPosition is prefixed to avoid collision with the portfolio Position above
export interface TradingPosition {
  qty: number
  avg: number
}

export interface FeedItem {
  id:   number
  text: string
  pos:  boolean
}

// ============================================================================
// FINANCIALS
// ============================================================================

export interface HistPoint {
  period: string
  value:  number
}

export interface Summary {
  market_cap?: number; enterprise_value?: number
  pe_ttm?: number; pe_forward?: number; peg_ratio?: number
  price_to_sales?: number; price_to_book?: number
  ev_to_ebitda?: number; ev_to_revenue?: number; fcf_yield?: number
  profit_margin?: number; operating_margin?: number; gross_margin?: number
  ebitda_margin?: number; return_on_equity?: number; return_on_assets?: number
  revenue_growth_yoy?: number; earnings_growth_yoy?: number
  revenue_ttm?: number; ebitda_ttm?: number; fcf_ttm?: number
  eps_ttm?: number; eps_forward?: number
  cash?: number; total_debt?: number; net_cash?: number
  dividend_yield?: number; dividend_rate?: number; payout_ratio?: number; ex_dividend_date?: string
  beta?: number; '52w_high'?: number; '52w_low'?: number
  '50d_avg'?: number; '200d_avg'?: number
  shares_outstanding?: number; float_shares?: number; short_ratio?: number; short_pct_float?: number
  target_mean?: number; target_low?: number; target_high?: number; num_analysts?: number; recommendation?: string
  sector?: string; industry?: string; employees?: number; book_value?: number
  // Derived quality metrics
  net_debt_to_ebitda?: number; interest_coverage?: number
  ev_to_fcf?: number; price_to_fcf?: number; roic?: number
  sbc_to_fcf?: number; revenue_per_employee?: number; shares_yoy_change?: number
}

export interface IncomeRow {
  period: string
  revenue?: number; gross_profit?: number; operating_income?: number
  ebitda?: number; net_income?: number; rd_expense?: number; sga_expense?: number
  depreciation?: number; interest_expense?: number; eps_diluted?: number; eps_basic?: number
  gross_margin?: number; operating_margin?: number; net_margin?: number; ebitda_margin?: number; rd_margin?: number
}

export interface CashRow {
  period: string
  operating_cf?: number; fcf?: number; capex?: number; sbc?: number
  buybacks?: number; dividends_paid?: number; fcf_adj?: number; fcf_conversion?: number
}

export interface BalRow {
  period: string
  cash?: number; short_term_inv?: number; total_assets?: number
  current_assets?: number; current_liabilities?: number
  total_equity?: number; retained_earnings?: number
  total_debt?: number; long_term_debt?: number; current_ratio?: number
  net_cash?: number; goodwill?: number; intangibles?: number
  capital_lease?: number
}

export interface DivRow {
  period:          string
  dividends_paid?: number
  dps?:            number   // dividend per share (actual payment per share)
  payout_ratio?:   number
  div_yield?:      number
}

export interface CompData {
  symbol: string; company_name: string; current_price: number; currency: string; exchange: string
  summary: Summary
  income_annual: IncomeRow[]; income_quarterly: IncomeRow[]
  cashflow_annual: CashRow[]; cashflow_quarterly: CashRow[]
  balance_annual: BalRow[]; balance_quarterly: BalRow[]
  dividend_annual: DivRow[]; dividend_quarterly: DivRow[]
}

export interface BarAnalysis {
  headline:    string
  analysis:    string
  sentiment:   'positive' | 'neutral' | 'negative'
  yoy_change:  number | null
  context_tag: string
  watch:       string
}

export interface SelectedBar {
  metric:  string
  period:  string
  value:   number
  history: HistPoint[]
  label:   string
  color:   string
}

export interface ChartEntry {
  key:          string
  label:        string
  color:        string
  pts:          HistPoint[]
  format?:      (v: number) => string
  negColor?:    string
  special?:     'cashdebt'
  balData?:     BalRow[]
  onBarSelect?: (d: BalRow) => void
}

// ============================================================================
// STOCK DETAIL
// ============================================================================

export interface Quote {
  c: number; d: number; dp: number
  h: number; l: number; o: number; pc: number
}

export interface Profile {
  name: string; exchange: string; ipo: string
  marketCapitalization: number; logo: string
  finnhubIndustry: string; weburl: string
}

export interface StockCandle {
  time: string; open: number; high: number; low: number; close: number
}

export type RangeLabel  = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'YTD' | 'MAX'
export type CandleSize  = 'D' | 'W' | 'M'

// ============================================================================
// DCF
// ============================================================================

export interface Financials {
  free_cash_flow:            number | null
  fcf_3yr_avg:               number | null
  fcf_history:               { year: number; fcf: number }[]
  shares_outstanding:        number | null
  beta:                      number | null
  current_price:             number | null
  company_name:              string | null
  total_debt:                number | null
  cash_and_equivalents:      number | null
  interest_expense:          number | null
  income_tax_expense:        number | null
  pretax_income:             number | null
  depreciation_amortisation: number | null
  minority_interest:         number | null
  preferred_stock:           number | null
  risk_free_rate:            number | null
  net_borrowing:             number | null  // ΔDebt: new debt issued − repayments (TTM)
}

export interface Assumptions {
  fcf:              number
  growthRate:       number
  growthRateYears:  number
  growthRate2:      number
  terminalGrowth:   number
  discountRate:     number
  riskFreeRate:     number
  erp:              number
  years:            number
  sharesOut:        number
  netDebt:          number
  minorityInterest: number
  preferredStock:   number
  mode?:            'FCFF' | 'FCFE'
}

export interface Comp {
  symbol:     string
  name:       string
  market_cap: number | null
  ev_ebitda:  number | null
  pe:         number | null
  ev_fcf:     number | null
  ps:         number | null
}

export interface CompsData {
  subject: Comp
  peers:   Comp[]
}

export interface AIScenario {
  label:                 'Conservative' | 'Base' | 'Bull'
  stage1_growth:         number
  stage1_years:          number
  stage2_growth:         number
  terminal_growth:       number
  wacc:                  number
  base_fcf:              number
  thesis:                string
  assumptions_rationale: string
  upside_drivers:        string[]
  downside_risks:        string[]
}

export interface AISuggestion {
  scenarios:     AIScenario[]
  macro_context: string
  risks:         string
}

export type DCFResult = {
  pvs:             number[]
  terminalPV:      number
  intrinsic:       number
  enterpriseValue: number
  invalid:         boolean
}