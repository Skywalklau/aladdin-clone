from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import date
from enum import Enum


class StressScenarioRequest(BaseModel):
    """Request model for custom stress scenario"""
    scenario_name: str = Field(..., description="Name of the stress scenario")
    shocks: Dict[str, float] = Field(
        ..., 
        description="Symbol-to-shock mapping. E.g., {'AAPL': -0.20, 'MSFT': -0.15} for 20% and 15% drops"
    )
    market_shock: Optional[float] = Field(
        None,
        description="Optional market-wide shock applied to all positions (e.g., -0.10 for 10% market drop)"
    )
    apply_correlations: bool = Field(
        default=True,
        description="Whether to apply correlation spillover effects to non-shocked positions"
    )
    correlation_spillover: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Strength of correlation spillover (0=none, 1=full correlation impact)"
    )

    class Config: # To convert ORM model to Pydantic
        from_attributes = True


class StressedPosition(BaseModel):
    """Position after stress scenario is applied"""
    symbol: str
    sector: str
    quantity: float
    avg_price: float
    original_price: float
    stressed_price: float
    # NOTE: *_shock_pct fields store DECIMAL values (e.g., -0.35 for -35%)
    price_shock_pct: float  # The total shock applied (direct + spillover) as decimal
    direct_shock_pct: Optional[float] = None  # Direct shock before correlation, as decimal
    spillover_shock_pct: Optional[float] = None  # Additional shock from correlations, as decimal
    original_market_value: float
    stressed_market_value: float
    value_change: float  # Dollar change
    value_change_pct: float  # Percentage change (stored as percent, e.g., -35.0 for -35%)
    original_pnl: float
    stressed_pnl: float
    pnl_change: float  # Dollar change in P&L

    class Config:
        from_attributes = True


class SectorExposure(BaseModel):
    """Sector-level exposure summary"""
    sector: str
    position_count: int
    total_market_value: float
    percentage_of_portfolio: float
    average_shock: float  # Average shock applied to this sector
    total_value_change: float

    class Config:
        from_attributes = True


class ScenarioType(str, Enum):
    market = "market"
    sector = "sector"
    historical = "historical"
    custom = "custom"
    interest_rate = "interest_rate"
    reverse = "reverse"  # For reverse stress testing


class StressScenarioResult(BaseModel):
    """Result of a single stress scenario"""
    scenario_name: str
    description: str
    scenario_type: ScenarioType
    applied_date: date = Field(default_factory=date.today)
    
    # Portfolio-level metrics
    total_original_value: float
    total_stressed_value: float
    total_value_change: float
    total_value_change_pct: float
    total_original_pnl: float
    total_stressed_pnl: float
    total_pnl_change: float
    
    # Detailed breakdowns
    positions: List[StressedPosition]
    sector_exposures: List[SectorExposure]
    
    # Correlation effects (if applied)
    correlation_applied: bool = False
    average_correlation: Optional[float] = None

    class Config:
        from_attributes = True


class StressTestSummary(BaseModel):
    """Summary of multiple stress test scenarios"""
    scenarios: List[StressScenarioResult]
    
    # Worst case analysis
    worst_case_scenario: str
    worst_case_loss: float
    worst_case_loss_pct: float
    
    # Best case analysis (least bad scenario)
    best_case_scenario: str
    best_case_loss: float
    best_case_loss_pct: float
    
    # Portfolio resilience metrics
    average_loss_across_scenarios: float
    median_loss_across_scenarios: float
    scenarios_with_loss_over_20pct: int
    scenarios_with_loss_over_50pct: int

    class Config:
        from_attributes = True


class HistoricalScenarioInfo(BaseModel):
    """Information about a historical crisis scenario"""
    scenario_id: str
    name: str
    description: str
    start_date: date
    end_date: date
    sp500_decline: float
    market_shock: float
    sector_shocks: Dict[str, float]

    class Config:
        from_attributes = True


class ReverseStressResult(BaseModel):
    """Result of reverse stress test (what shock causes target loss)"""
    target_loss_pct: float
    required_market_shock: float
    scenario_description: str
    affected_positions: List[StressedPosition]

    class Config:
        from_attributes = True


class InterestRateCustomRequest(BaseModel):
    """
    Request schema for custom interest rate shock with sector rate betas.
    
    This allows advanced users to override default sector sensitivities.
    """
    rate_change_bps: int = Field(
        200,
        ge=-500,
        le=500,
        description="Rate change in basis points"
    )
    
    use_correlations: bool = Field(
        True,
        description="Apply correlation spillover effects"
    )
    
    bond_duration: float = Field(
        17.0,
        ge=5.0,
        le=30.0,
        description="Effective duration of bond proxy (17=TLT, 7=IEF)"
    )
    
    sector_rate_betas: Optional[Dict[str, float]] = Field(
        None,
        description=(
            "Custom sector rate betas. Positive = stock falls when rates rise. "
            "Negative = stock rises when rates rise (e.g., banks). "
            "Example: {'Technology': 1.2, 'Financial Services': -0.75}"
        ),
        example={
            "Technology": 1.2,
            "Financial Services": -0.75,
            "Utilities": 1.5
        }
    )
    
    correlation_spillover: float = Field(
        0.3,
        ge=0.0,
        le=1.0,
        description="Correlation spillover strength"
    )
    
    max_shock: float = Field(
        0.8,
        ge=0.5,
        le=1.0,
        description="Maximum allowed shock"
    )
    
    min_shock: float = Field(
        -0.8,
        ge=-1.0,
        le=-0.5,
        description="Minimum allowed shock"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "rate_change_bps": 200,
                "use_correlations": True,
                "bond_duration": 17.0,
                "sector_rate_betas": {
                    "Technology": 1.2,
                    "Financial Services": -0.75,
                    "Utilities": 1.5,
                    "Healthcare": 0.6
                },
                "correlation_spillover": 0.3,
                "max_shock": 0.8,
                "min_shock": -0.8
            }
        }