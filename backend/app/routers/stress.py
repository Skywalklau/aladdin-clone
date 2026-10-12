from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import List, Optional
import logging
from sqlalchemy.orm import Session
from functools import lru_cache
from app.db.database import get_db
from app.services.portfolio_service import PortfolioService
from app.services.market_data_service import MarketDataService
from app.services.stress.stress_service import StressService
from app.services.stress.data.market_data_cache import MarketDataCache
from app.services.risk_service import RiskService
from app.utils.router_helpers import load_and_enrich_positions, get_correlation_matrix
from app.models.portfolio import Portfolio, User
from app.schemas.stress import (
    StressScenarioRequest,
    StressScenarioResult,
    StressTestSummary,
    HistoricalScenarioInfo,
    ReverseStressResult,
)
from app.dependencies.auth import get_current_user


router = APIRouter(prefix="/stress", tags=["stress-testing"])
logger = logging.getLogger(__name__)


def get_market_data_service():
    return MarketDataService()


def get_portfolio_service(market_data_service: MarketDataService = Depends(get_market_data_service)):
    """Dependency for portfolio service"""
    return PortfolioService(market_data_service)


@lru_cache()
def get_stress_service() -> StressService:
    """Dependency for stress service"""
    return StressService()


def get_risk_service():
    """Dependency for risk service (for correlation matrix)"""
    return RiskService()


@lru_cache()
def get_market_data() -> MarketDataCache:
    """Dependency for market data cache"""
    return MarketDataCache()


def verify_portfolio_ownership(
    portfolio_id: int,
    db: Session,
    current_user: User
) -> None:
    """Check the portfolio exists and belongs to the current user."""
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found.")


@router.get("/historical/scenarios", response_model=List[HistoricalScenarioInfo])
def list_historical_scenarios(
    stress_service: StressService = Depends(get_stress_service)
):
    """
    List all available historical crisis scenarios.
    
    Returns detailed information about each historical scenario including:
    - Date ranges
    - Actual S&P 500 declines
    - Sector-specific impacts
    
    Available scenarios:
    - 2008 Financial Crisis
    - COVID-19 Crash (2020)
    - Dot-com Bubble (2000-2002)
    - Black Monday (1987)
    - European Debt Crisis (2011)
    
    Returns:
        List of historical scenario information
    """
    return stress_service.get_historical_scenarios_info()


@router.get("/portfolio/sectors")
def get_portfolio_sectors(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    data_service: MarketDataCache = Depends(get_market_data),
    current_user: User = Depends(get_current_user)
):
    """
    Get the sectors represented in the current portfolio.
    
    Useful for understanding:
    - Which sector shocks are applicable
    - Portfolio diversification across sectors
    - Sector concentration risk
    
    Returns:
        Dictionary mapping sector names to list of symbols
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    # Group by sector
    sectors = {}
    for position in enriched_positions:
        sector = data_service.get_sector(position.symbol)
        if sector not in sectors:
            sectors[sector] = []
        sectors[sector].append(position.symbol)
    
    return sectors


@router.get("/market_crash", response_model=StressScenarioResult)
def market_crash_stress(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    severity: str = Query(
        "moderate",
        regex="^(mild|moderate|severe|extreme)$",
        description="Crash severity: mild (-10%), moderate (-20%), severe (-35%), extreme (-50%)"
    ),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    current_user: User = Depends(get_current_user)
):
    """
    Simulate a broad market crash scenario with BETA-ADJUSTED impacts.
    
    **How It Works:**
    - Each stock's decline is adjusted by its beta (market sensitivity)
    - High-beta stocks (tech, growth) drop MORE than the market average
    - Low-beta stocks (utilities, defensive) drop LESS than the market average
    
    **Example for 20% Market Crash:**
    - NVDA (beta=1.8): drops 36% (20% × 1.8)
    - AAPL (beta=1.2): drops 24% (20% × 1.2)
    - JNJ (beta=0.6): drops 12% (20% × 0.6)
    
    **Severity Levels:**
    - **mild**: -10% market decline (typical correction)
    - **moderate**: -20% market decline (bear market threshold)
    - **severe**: -35% market decline (severe crisis)
    - **extreme**: -50% market decline (catastrophic scenario)
    
    **Note:** Correlation spillover is not applicable for market-wide crashes 
    since all positions are directly affected via beta-adjusted shocks.
    
    Args:
        severity: Crash severity level
    
    Returns:
        Stress scenario result with beta-adjusted position impacts
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    # Market crash uses beta-adjusted shocks, no correlation matrix needed
    return stress_service.market_crash_scenario(enriched_positions, severity)


@router.get("/sector_shock", response_model=StressScenarioResult)
def sector_shock_stress(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    sector: str = Query(..., description="Sector name (e.g., 'Technology', 'Financial Services')"),
    shock_pct: float = Query(
        -0.30,
        ge=-1.0,
        le=0.5,
        description="Shock percentage as decimal (e.g., -0.30 for -30%)"
    ),
    use_sector_beta: bool = Query(
        True,
        description=(
            "Use historical sector beta for realistic stock-level variation. "
            "When enabled, high-volatility stocks amplify the shock, low-volatility dampen it."
        )
    ),
    correlation_spillover: float = Query(
        0.4,
        ge=0.0,
        le=1.0,
        description=(
            "Spillover strength (0-1). Controls how much correlated positions are affected. "
            "Recommended: 0.7-0.8 for high-correlation sectors (Tech, Communication), "
            "0.4-0.6 for moderate (Financials, Industrials), "
            "0.2-0.3 for low-correlation (Utilities, Defensives)"
        )
    ),
    use_correlations: bool = Query(
        True,
        description="Apply correlation spillover to other sectors"
    ),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    risk_service: RiskService = Depends(get_risk_service),
    data_service: MarketDataCache = Depends(get_market_data),
    current_user: User = Depends(get_current_user)
):
    """
    Simulate a sector-specific shock with realistic stock-level variation.
    
    **Key Innovation:**
    Unlike traditional sector shocks that apply uniform percentage to all stocks,
    this uses historical sector beta to create realistic intra-sector variation.
    
    **How it works:**
    1. Calculates each stock's sensitivity to sector movements (sector beta)
    2. High-beta stocks amplify the shock, low-beta stocks dampen it
    3. Preserves the average sector shock while varying individual stocks
    
    **Example: Technology sector -30% shock with beta adjustment:**
    - NVDA (sector beta = 1.5): -45% (high volatility, amplified)
    - AAPL (sector beta = 0.8): -24% (stable, dampened)
    - MSFT (sector beta = 1.1): -33% (slightly amplified)
    - Sector average: -30% ✓
    
    **Without beta adjustment (uniform):**
    - All tech stocks: -30% (unrealistic - ignores volatility differences)
    
    **Spillover to Other Sectors:**
    After direct shocks to the target sector, correlation spillover applies to
    non-sector positions based on their correlation with shocked stocks.
    
    **Spillover Strength Guide:**
    - **0.7-0.8**: High-correlation sectors (Technology, Communication Services)
    - **0.4-0.6**: Moderate correlation (Financials, Industrials, Energy)
    - **0.2-0.3**: Low correlation (Utilities, Consumer Defensive, Healthcare)
    
    **Common sectors:**
    - Technology, Financial Services, Healthcare
    - Consumer Cyclical / Consumer Defensive
    - Energy, Industrials, Real Estate, Utilities
    
    Use `/stress/portfolio/sectors` to see which sectors are in your portfolio.
    
    Args:
        sector: Target sector name
        shock_pct: Sector-level shock magnitude (negative for decline)
        use_sector_beta: Enable historical beta-based variation (recommended)
        correlation_spillover: Spillover strength (0-1)
        use_correlations: Model spillover effects to other sectors
    
    Returns:
        Stress result showing direct and spillover impacts with realistic variation
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    # Validate sector exists in portfolio (case-insensitive)
    available_sectors = {data_service.get_sector(p.symbol) for p in enriched_positions}
    
    # Find matching sector (case-insensitive)
    sector_normalized = sector.strip()
    matching_sector = None
    for avail in available_sectors:
        if avail.lower() == sector_normalized.lower():
            matching_sector = avail
            break
    
    if not matching_sector:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Sector '{sector}' not found in portfolio. "
                f"Available sectors: {sorted(available_sectors)}. "
                f"Use /stress/portfolio/sectors to see sectors with symbols."
            )
        )
    
    # Get correlation matrix if needed
    correlation_matrix = get_correlation_matrix(
        use_correlations, 
        enriched_positions, 
        risk_service
    )
    
    return stress_service.sector_shock_scenario(
        enriched_positions,
        matching_sector,
        shock_pct,  # Router calls it shock_pct, service expects sector_shock_pct
        correlation_matrix,
        correlation_spillover,
        use_sector_beta  # ← NOW PASSES THIS!
    )


# I did 2 routes for sector shocks so that front end is easier to implement later on
@router.get("/multi_sector_shock", response_model=StressScenarioResult)
def multi_sector_shock_stress(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    sectors: str = Query(
        ...,
        description=(
            "Comma-separated sectors with shocks. Format: 'Sector1:shock1,Sector2:shock2'. "
            "Example: 'Technology:-0.30,Financial Services:-0.40,Energy:-0.25'"
        ),
        example="Technology:-0.30,Financial Services:-0.40"
    ),
    use_sector_beta: bool = Query(
        True,
        description=(
            "Use historical sector beta for realistic stock-level variation. "
            "When enabled, high-volatility stocks amplify shocks, low-volatility dampen them."
        )
    ),
    correlation_spillover: float = Query(
        0.4,
        ge=0.0,
        le=1.0,
        description=(
            "Spillover strength (0-1). Controls how much correlated positions are affected. "
            "Recommended: 0.7-0.8 for high-correlation scenarios, "
            "0.4-0.6 for moderate, 0.2-0.3 for low-correlation"
        )
    ),
    use_correlations: bool = Query(
        True,
        description="Apply correlation spillover to non-shocked sectors"
    ),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    risk_service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(get_current_user)
):
    """
    Stress multiple sectors simultaneously with realistic stock-level variation.
    
    **Key Innovation:**
    Each sector shock is applied with beta-adjusted stock-level variation,
    just like the single sector shock endpoint. This creates realistic
    multi-sector crisis scenarios.
    
    **Example: Tech + Financial Crisis with beta adjustment:**
    
    Technology -30%:
    - NVDA (beta=1.5): -45% (high volatility)
    - AAPL (beta=0.8): -24% (stable)
    - MSFT (beta=1.1): -33%
    
    Financial Services -40%:
    - JPM (beta=1.2): -48%
    - BAC (beta=1.4): -56%
    - WFC (beta=0.9): -36%
    
    **Use Cases:**
    - Model realistic multi-sector crises (e.g., Tech + Financials crash together)
    - Test contagion effects across sectors
    - Simulate sector rotation impacts with realistic intra-sector variation
    
    **Format:**
    - Comma-separated list of sector:shock pairs
    - Shock as decimal (e.g., -0.30 for -30%)
    - Sectors are case-insensitive and validated
    
    **Examples:**
    
    Tech + Financial Crisis:
    `sectors=Technology:-0.30,Financial Services:-0.40`
    
    Energy + Materials Commodity Crash:
    `sectors=Energy:-0.45,Basic Materials:-0.35`
    
    Broad Defensive Rotation:
    `sectors=Technology:-0.25,Consumer Cyclical:-0.30,Utilities:0.10,Healthcare:0.05`
    
    **How it works:**
    1. Direct beta-adjusted shocks to all positions in specified sectors
    2. Different shock magnitudes for each sector (realistic!)
    3. Beta adjustment within each sector (high-vol stocks amplify, low-vol dampen)
    4. Correlation spillover to non-shocked sectors
    5. Single unified result showing total portfolio impact
    
    Use `/stress/portfolio/sectors` to see which sectors are in your portfolio.
    
    Args:  
        sectors: Comma-separated sectors with shocks
        use_sector_beta: Enable historical beta-based variation (recommended)
        correlation_spillover: Spillover strength (0-1)  
        use_correlations: Model spillover effects  
    
    Returns:
        Combined stress result across all shocked sectors with beta adjustments
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # 1. Load positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    # 2. Get correlation matrix if needed
    correlation_matrix = get_correlation_matrix(
        use_correlations,
        enriched_positions,
        risk_service
    )
    
    # 3. Call service with beta adjustment parameter
    try:
        return stress_service.multi_sector_shock_scenario(
            enriched_positions,
            sectors,
            correlation_matrix,
            correlation_spillover,
            use_sector_beta
        )
    except ValueError as e:
        # Convert service error to HTTP error
        raise HTTPException(status_code=400, detail=str(e))


# NOTE: sector_rate_betas: Optional[Dict[str, float]] is not defined yet
# Next potential steps: think of a user-friendly way to define these (more professional)
# stick to YAGNI for now.
@router.get("/interest_rate", response_model=StressScenarioResult)
def interest_rate_shock_stress(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    rate_change_bps: int = Query(
        200,
        ge=-500,
        le=500,
        description="Rate change in basis points (100 bps = 1%). Positive = rate increase."
    ),
    bond_duration: float = Query(
        17.0,
        ge=5.0,
        le=30.0,
        description=(
            "Effective duration of bond proxy. "
            "Common values: 17=TLT (20Y Treasury), 7=IEF (7-10Y), 20=EDV (Extended Duration). "
            "Higher duration = more rate sensitivity."
        )
    ),
    max_shock: float = Query(
        0.8,
        ge=0.5,
        le=1.0,
        description="Maximum allowed shock for any stock (default 0.8 = 80%)"
    ),
    min_shock: float = Query(
        -0.8,
        ge=-1.0,
        le=-0.5,
        description="Minimum allowed shock for any stock (default -0.8 = -80%)"
    ),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    current_user: User = Depends(get_current_user)
):
    """
    Simulate interest rate shock using duration-based professional methodology.
    
    **Professional Model (Duration-Based):**
    - Converts rate changes to bond shock using modified duration
    - Applies sector-specific rate sensitivities (NOT equity beta)
    - Models differential impacts based on empirical finance research

    **Important Note on Correlation:**
    Correlation spillover does NOT apply to interest rate shocks because every
    position receives a direct shock based on its sector's rate sensitivity.
    
    **Customization Options:**
    
    1. **bond_duration**: Choose your duration proxy
       - 7 (IEF): Short-term rates, 7-10Y Treasuries
       - 17 (TLT): Long-term rates, 20Y Treasuries (default)
       - 20+ (EDV): Extended duration, 20-30Y Treasuries
       
       Higher duration = more sensitivity
       Example: +200bps with duration=7 → -14% bond shock
                +200bps with duration=17 → -34% bond shock
    
    2. **correlation_spillover**: Control spillover effects
       - 0.1-0.2: Minimal spillover (rate shocks are idiosyncratic)
       - 0.3: Default for rate shocks
       - 0.5+: Higher spillover (use for systemic rate crises)
    
    3. **max_shock / min_shock**: Safety bounds
       - Prevents unrealistic extreme values
       - Default ±80% reasonable for most scenarios
       - Increase for extreme stress tests
    
    **How It Works:**
    1. Convert basis points to bond shock: bond_shock = -duration × (bps/10000)
       Example: +200bps, duration=17 → -34% bond drop
    
    2. Apply sector-specific rate betas:
       - **Banks/Financials** (rate_beta = -0.65): **BENEFIT from higher rates**
       - **Technology/Growth** (rate_beta = +1.0): **Hurt most by rate increases**
       - **Utilities/REITs** (rate_beta = +1.3): **Extremely rate-sensitive**
       - **Consumer Defensive** (rate_beta = +0.4): **Low sensitivity**
    
    **Example Scenarios:**
    
    Fed Rate Increase (+200bps, duration=17):
    - Banks: +22% (benefit from higher NIM)
    - Tech: -34% (high duration assets hurt)
    - Utilities: -44% (bond proxies crushed)
    
    Short-Term Rate Spike (+200bps, duration=7):
    - Banks: +9% (smaller benefit)
    - Tech: -14% (less sensitivity)
    - Utilities: -18% (moderate impact)
    
    **Basis Points Reference:**
    - 25 bps = 0.25% (typical Fed move)
    - 50 bps = 0.50% (aggressive move)
    - 100 bps = 1.00% (crisis response)
    - 200 bps = 2.00% (example: 2022 tightening cycle)
    
    Args:
        rate_change_bps: Rate change in basis points (+ = increase, - = decrease)
        use_correlations: Model correlation spillover effects
        bond_duration: Duration proxy (7=short-term, 17=long-term, 20+=extended)
        correlation_spillover: Spillover strength (0-1)
        max_shock: Maximum allowed stock shock
        min_shock: Minimum allowed stock shock
    
    Returns:
        Duration-based stress result with sector-specific rate impacts
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    return stress_service.interest_rate_shock_scenario(
        enriched_positions,
        rate_change_bps,
        bond_duration=bond_duration,
        sector_rate_betas=None,  # Could add this too if needed
        max_shock=max_shock,
        min_shock=min_shock,
    )


@router.get("/historical/{scenario_id}", response_model=StressScenarioResult)
def historical_scenario_stress(
    scenario_id: str = Path(...),
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    current_user: User = Depends(get_current_user)
):
    """
    Apply a historical crisis scenario based on actual market data.
    
    **Available Scenarios:**
    
    - **financial_crisis_2008**: Global Financial Crisis (Sep 2008 - Mar 2009)
        - S&P 500: -56.7% peak-to-trough
        - Financials hit hardest (-65%), defensive sectors held up better
    
    - **covid_crash_2020**: COVID-19 Pandemic (Feb - Mar 2020)
        - S&P 500: -33.9% in 33 days
        - Energy crashed (-55%), Tech relatively resilient (-20%)
    
    - **dotcom_bubble_2000**: Dot-com Bubble Burst (Mar 2000 - Oct 2002)
        - S&P 500: -49.1%, NASDAQ: -78%
        - Technology devastated, defensives held value
    
    - **black_monday_1987**: Single-day crash (Oct 19, 1987)
        - S&P 500: -20.4% in one day
        - Broad-based, relatively uniform impact
    
    - **european_debt_crisis_2011**: European Sovereign Debt (May - Oct 2011)
        - S&P 500: -19.3%
        - Financials exposed to sovereign debt hit hardest
    
    Use `/stress/historical/scenarios` for detailed scenario information.
    
    Args:
        scenario_id: Historical scenario identifier
        use_correlations: Model correlation effects
    
    Returns:
        Historical scenario result with actual crisis-period impacts
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    return stress_service.historical_scenario(
        enriched_positions,
        scenario_id,
    )


@router.post("/custom", response_model=StressScenarioResult)
def custom_stress_scenario(
    request: StressScenarioRequest,
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    risk_service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(get_current_user)
):
    """
    Apply a fully customizable stress scenario.
    
    **Example Request:**
```json
    {
        "scenario_name": "Tech Crash with Market Decline",
        "shocks": {
            "AAPL": -0.30,
            "MSFT": -0.25,
            "GOOGL": -0.35
        },
        "market_shock": -0.10,
        "apply_correlations": true,
        "correlation_spillover": 0.5
    }
```
    
    **Advanced Options:**
    - **apply_correlations**: Enable spillover to non-shocked positions
    - **correlation_spillover**: Control spillover strength (0-1)
        - 0.0 = No spillover (isolated shocks)
        - 0.5 = Moderate spillover (recommended)
        - 1.0 = Full correlation impact
    
    **Use Cases:**
    - Test specific stock combinations
    - Model custom market scenarios
    - Simulate portfolio-specific risks
    - Educational stress testing
    
    Args:
        request: Custom scenario specification
    
    Returns:
        Customized stress result with user-defined shocks
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    # Get correlation matrix if needed
    correlation_matrix = get_correlation_matrix(
        request.apply_correlations,
        enriched_positions,
        risk_service
    )
    
    return stress_service.custom_scenario(
        enriched_positions,
        request,
        correlation_matrix
    )


@router.get("/reverse", response_model=ReverseStressResult)
def reverse_stress_test(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    target_loss_pct: float = Query(
        0.20,
        gt=0.0,
        lt=1.0,
        description="Target portfolio loss as POSITIVE decimal (e.g., 0.20 for 20% loss)"
    ),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    current_user: User = Depends(get_current_user)
):
    """
    Reverse stress testing: Find the market shock that causes a target loss.
    
    **What is Reverse Stress Testing?**
    
    Traditional stress testing asks: "What happens if markets drop 20%?"
    Reverse stress testing asks: "What market drop would cause me to lose 20%?"
    
    This is a regulatory requirement for banks (Basel III) and provides valuable insight
    into portfolio vulnerability.
    
    **Beta Adjustment:**
    The test accounts for each stock's beta (market sensitivity), so high-beta 
    portfolios will require a smaller market shock to reach the target loss.
    
    **Use Cases:**
    - Understand portfolio resilience
    - Set risk limits and stop-losses
    - Communicate downside risk to stakeholders
    - Regulatory compliance (for institutions)
    
    **Example:**
    - Input: target_loss_pct = 0.20 (20% loss)
    - Output: "A 18.5% market decline would cause a 20% portfolio loss"
    - This tells you your portfolio is more volatile than the market (high beta)
    
    Args:
        target_loss_pct: Target portfolio loss as POSITIVE decimal (e.g., 0.20 = 20% loss)
    
    Returns:
        Required market shock and detailed position impacts
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    return stress_service.reverse_stress_test(enriched_positions, target_loss_pct)


@router.get("/comprehensive", response_model=StressTestSummary)
def comprehensive_stress_test(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    use_correlations: bool = Query(
        True,
        description="Apply correlation modeling for sector and interest rate scenarios"
    ),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    stress_service: StressService = Depends(get_stress_service),
    risk_service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(get_current_user)
):
    """
    Run comprehensive stress test suite with all scenarios.
    
    **Includes:**
    - Market crashes: Mild (-10%), Moderate (-20%), Severe (-35%) - BETA-ADJUSTED
    - Historical scenarios: All 5 major crises with sector-specific impacts
    - Interest rate shocks: +200bps, -100bps with beta/sector adjustments
    - Sector shocks: All sectors present in portfolio (-30% each) with spillover
    
    **Total scenarios**: Typically 12-20 depending on portfolio sector diversity
    
    **Analysis Provided:**
    - Worst-case scenario identification
    - Best-case (least bad) scenario
    - Distribution statistics (average, median losses)
    - Extreme loss counts (>20%, >50%)
    - Sector exposure breakdown for each scenario
    - Correlation impact analysis (where applicable)
    
    **Recommended Use:**
    - Quarterly portfolio review
    - Before major position changes
    - Risk reporting to stakeholders
    - Compliance requirements
    
    **Performance Note:** Market crash scenarios use beta-adjusted shocks and don't 
    require correlation matrix computation, making them fast. Other scenarios may 
    take 15-30 seconds depending on portfolio size if correlations are enabled.
    
    Args:
        use_correlations: Enable correlation modeling for applicable scenarios
    
    Returns:
        Complete stress test summary with all scenarios and analytics
    """
    verify_portfolio_ownership(portfolio_id, db, current_user)

    # Load and enrich positions
    enriched_positions = load_and_enrich_positions(db, portfolio_id, portfolio_service)
    
    # Get correlation matrix if needed (only for sector/interest rate/historical scenarios)
    correlation_matrix = get_correlation_matrix(
        use_correlations,
        enriched_positions,
        risk_service
    )
    
    return stress_service.run_comprehensive_stress_test(
        enriched_positions,
        correlation_matrix
    )