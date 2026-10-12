from pydantic import BaseModel
from typing import List, Dict
from app.schemas.portfolio import PortfolioPositionWithMarketData

class PortfolioRiskSummary(BaseModel):
    total_value: float
    total_pnl: float
    portfolio_volatility: float  # annualized volatility
    correlations: Dict[str, Dict[str, float]]  # symbol -> symbol -> correlation
    portfolio_beta: float  # vs benchmark
    historical_var: float  # historical VaR (potential loss)
    parametric_var: float  # parametric VaR (normal distribution)
    sharpe_ratio: float
    positions: List[PortfolioPositionWithMarketData]

    class Config:
        from_attributes = True
