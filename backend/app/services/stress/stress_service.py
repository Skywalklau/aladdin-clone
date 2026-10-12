"""
Stress Testing Service.

Main orchestrator that delegates to specialized components:
- BetaCalculationService: Beta calculations
- SectorAnalyzer: Sector grouping and analysis
- MarketDataCache: Market data caching
- CorrelationSpilloverCalculator: Spillover effects
- historical_scenarios: Historical crisis data
"""

from typing import List, Dict, Optional
from datetime import date
import numpy as np
import logging

from app.schemas.portfolio import PortfolioPositionWithMarketData
from app.schemas.stress import (
    StressScenarioRequest,
    StressScenarioResult,
    StressedPosition,
    StressTestSummary,
    HistoricalScenarioInfo,
    ReverseStressResult
)

# Import specialized components
from app.services.stress.calculators.beta_calculator import BetaCalculationService
from app.services.stress.calculators.sector_analyzer import SectorAnalyzer
from app.services.stress.calculators.spillover_calculator import CorrelationSpilloverCalculator
from app.services.stress.data.market_data_cache import MarketDataCache
from app.services.stress.data import historical_scenarios
from app.utils.market_data_utils import MarketDataUtils

logger = logging.getLogger(__name__)


class StressService:
    """
    Stress testing service.
    
    Features:
    - Correlation-aware shock propagation
    - Historical crisis scenarios
    - Sector spillover effects
    - Beta-adjusted interest rate sensitivity
    - Reverse stress testing
    
    Architecture:
    - Delegates complex calculations to specialized services
    - Focused on scenario orchestration
    - Clean separation of concerns
    """
    
    def __init__(self, data_utils: MarketDataUtils = None):
        """Initialize service with specialized components."""
        # Core components
        self._cache = MarketDataCache()
        self._data_utils = data_utils or MarketDataUtils()
        
        # Specialized calculators
        self._beta_calc = BetaCalculationService(self._data_utils)
        self._sector_analyzer = SectorAnalyzer()
        self._spillover_calc = CorrelationSpilloverCalculator()
    
    # ========================================================================
    # CORE SCENARIO APPLICATION
    # ========================================================================
    
    def apply_stress_scenario(
        self,
        positions: List[PortfolioPositionWithMarketData],
        scenario_name: str,
        description: str,
        scenario_type: str,
        shocks: Dict[str, float],
        correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None,
        apply_correlations: bool = True,
        correlation_spillover: Optional[float] = None
    ) -> StressScenarioResult:
        """
        Apply a stress scenario with full professional modeling.
        
        This is the core method that applies shocks to positions and
        calculates all resulting metrics.
        
        Args:
            positions: Portfolio positions
            scenario_name: Name of scenario
            description: Scenario description
            scenario_type: Type ('market', 'sector', 'historical', etc.)
            shocks: Direct symbol shocks
            correlation_matrix: Correlation matrix for spillover
            apply_correlations: Whether to model correlation effects
            correlation_spillover: Spillover strength (0-1)
            
        Returns:
            Complete stress scenario result
        """
        stressed_positions = []
        total_original_value = 0.0
        total_stressed_value = 0.0
        total_original_pnl = 0.0
        total_stressed_pnl = 0.0
        
        for position in positions:
            symbol = position.symbol
            sector = self._cache.get_sector(symbol)
            
            # Defensive check: current_price should never be <= 0, but protect against bad data
            if position.current_price <= 0:
                logger.warning(
                    f"{symbol} has invalid current_price {position.current_price}, skipping"
                )
                continue
            
            # Apply shocks multiplicatively (compounding)
            stressed_price = position.current_price
            
            # Track individual shock components for reporting
            symbol_shock_applied = 0.0
            spillover_shock_applied = 0.0
            
            # Apply symbol-specific shock
            if symbol in shocks:
                stressed_price *= (1 + shocks[symbol])
                symbol_shock_applied = shocks[symbol]
            
            # Calculate correlation spillover if enabled
            # Only apply spillover if position wasn't directly shocked
            if apply_correlations and correlation_matrix and symbol not in shocks:
                spillover = self._spillover_calc.calculate_spillover(
                    position, shocks, correlation_matrix, correlation_spillover
                )
                if spillover != 0:
                    stressed_price *= (1 + spillover)
                    spillover_shock_applied = spillover
            
            # Price floor (apply before calculating metrics)
            stressed_price = max(0.01, stressed_price)
            
            # Calculate total effective shock
            total_shock = (stressed_price / position.current_price) - 1
            
            # Calculate direct shock for reporting
            direct_shock = symbol_shock_applied if symbol_shock_applied != 0 else None
            
            # Calculate all position metrics
            original_price = position.current_price
            original_market_value = position.market_value
            stressed_market_value = stressed_price * position.quantity
            value_change = stressed_market_value - original_market_value
            value_change_pct = (
                (value_change / original_market_value * 100) 
                if original_market_value > 0 else 0.0
            )
            
            original_pnl = position.pnl
            stressed_pnl = (stressed_price - position.avg_price) * position.quantity
            pnl_change = stressed_pnl - original_pnl
            
            stressed_pos = StressedPosition(
                symbol=symbol,
                sector=sector,
                quantity=position.quantity,
                avg_price=position.avg_price,
                original_price=original_price,
                stressed_price=stressed_price,
                price_shock_pct=total_shock,
                direct_shock_pct=direct_shock,
                spillover_shock_pct=(
                    spillover_shock_applied if spillover_shock_applied != 0 else None
                ),
                original_market_value=original_market_value,
                stressed_market_value=stressed_market_value,
                value_change=value_change,
                value_change_pct=value_change_pct,
                original_pnl=original_pnl,
                stressed_pnl=stressed_pnl,
                pnl_change=pnl_change
            )
            
            stressed_positions.append(stressed_pos)
            
            total_original_value += original_market_value
            total_stressed_value += stressed_market_value
            total_original_pnl += original_pnl
            total_stressed_pnl += stressed_pnl
        
        # Calculate portfolio-level metrics
        total_value_change = total_stressed_value - total_original_value
        total_value_change_pct = (
            (total_value_change / total_original_value * 100) 
            if total_original_value > 0 else 0.0
        )
        total_pnl_change = total_stressed_pnl - total_original_pnl
        
        # Calculate sector exposures (delegated to analyzer)
        sector_exposures = self._sector_analyzer.calculate_sector_exposures(
            stressed_positions, total_original_value
        )
        
        # Calculate average correlation if correlations were used
        avg_corr = None
        if apply_correlations and correlation_matrix:
            avg_corr = self._spillover_calc.calculate_average_correlation(
                shocks, correlation_matrix
            )
        
        return StressScenarioResult(
            scenario_name=scenario_name,
            description=description,
            scenario_type=scenario_type,
            applied_date=date.today(),
            total_original_value=total_original_value,
            total_stressed_value=total_stressed_value,
            total_value_change=total_value_change,
            total_value_change_pct=total_value_change_pct,
            total_original_pnl=total_original_pnl,
            total_stressed_pnl=total_stressed_pnl,
            total_pnl_change=total_pnl_change,
            positions=stressed_positions,
            sector_exposures=sector_exposures,
            correlation_applied=apply_correlations and correlation_matrix is not None,
            average_correlation=avg_corr
        )
    
    # ========================================================================
    # SCENARIO IMPLEMENTATIONS
    # ========================================================================
    
    def market_crash_scenario(
        self,
        positions: List[PortfolioPositionWithMarketData],
        severity: str = "moderate"
    ) -> StressScenarioResult:
        """
        Professional market crash scenario with beta adjustment.
        
        This func is One-dimensional -> We only consider beta adjusted crashes without sector stress.
        NOTE: we do this in historical scenarios || custom scenarios
        This func is just for a general case, when a market crashes by x%, we just see how all stocks
        move based on their beta-adjusted values, without any other confounding variables.
        """
        
        severity_config = {
            'mild': (-0.10, "10% market decline (typical correction)"),
            'moderate': (-0.20, "20% market decline (bear market threshold)"),
            'severe': (-0.35, "35% market decline (severe crisis)"),
            'extreme': (-0.50, "50% market decline (extreme crisis)")
        }
        # this func is One-dimensional -> We only consider beta adjusted crashes without sector stress.
        # NOTE: we do this in historical scenarios || custom scenarios
        # This func is just for a general case, when a market crashes by x%, we just see how all stocks
        # move based on their beta-adjusted values, without any other confounding variables.
        base_shock, desc = severity_config.get(severity, severity_config['moderate'])
        
        # Build beta-adjusted shocks for each position
        shocks = {}
        for position in positions:
            beta = self._cache.get_beta(position.symbol)
            # High-beta stocks drop more, low-beta drop less
            shocks[position.symbol] = base_shock * beta
        
        return self.apply_stress_scenario(
            positions=positions,
            scenario_name=f"Market Crash - {severity.capitalize()}",
            description=desc + " with beta-adjusted impacts",
            scenario_type="market",
            shocks=shocks,
            apply_correlations=False,
        )
    
    # NOTE: sector shock right now is using portfolio beta (How each stock moves relative to your other portfolio holdings in the sector)
    # Consider using market beta as well (How each stock moves relative to the actual market sector)
    def sector_shock_scenario(
        self,
        positions: List[PortfolioPositionWithMarketData],
        sector: str,
        sector_shock_pct: float = -0.30,
        correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None,
        correlation_spillover: float = 0.4,
        use_sector_beta: bool = True
    ) -> StressScenarioResult:
        """
        Professional sector shock with cap-weighted, leave-one-out sector beta.
        
        Args:
            positions: Portfolio positions
            sector: Target sector
            sector_shock_pct: Sector-level shock percentage
            correlation_matrix: Optional correlation matrix
            correlation_spillover: Spillover strength (0-1)
            use_sector_beta: Use historical sector betas
            
        Returns:
            StressScenarioResult
        """
        # Get stocks in sector (delegated to analyzer)
        sector_stocks = self._sector_analyzer.get_sector_stocks(
            positions, sector, self._cache.get_sector
        )
        
        if not sector_stocks:
            raise ValueError(f"No positions found in sector: {sector}")
        
        # Calculate shocks (beta-adjusted or uniform)
        if use_sector_beta and len(sector_stocks) >= 2:
            result = self._beta_calc.calculate_sector_betas(positions, sector_stocks)
            
            if result:
                betas, weighting_method = result
                shocks = self._beta_calc.apply_beta_to_shocks(sector_shock_pct, betas)
            else:
                shocks = self._sector_analyzer.create_uniform_shocks(
                    sector_stocks, sector_shock_pct
                )
                weighting_method = "uniform"
        else:
            shocks = self._sector_analyzer.create_uniform_shocks(
                sector_stocks, sector_shock_pct
            )
            weighting_method = "uniform"
        
        # Generate scenario metadata (delegated to analyzer)
        scenario_name = f"{sector} Sector Shock"
        description = self._sector_analyzer.generate_sector_description(
            sector, sector_shock_pct, weighting_method
        )
        
        # Apply scenario
        return self.apply_stress_scenario(
            positions=positions,
            scenario_name=scenario_name,
            description=description,
            scenario_type="sector",
            shocks=shocks,
            correlation_matrix=correlation_matrix,
            apply_correlations=True,
            correlation_spillover=correlation_spillover
        )
    
    def multi_sector_shock_scenario(
        self,
        positions: List[PortfolioPositionWithMarketData],
        sectors_str: str,
        correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None,
        correlation_spillover: float = 0.4,
        use_sector_beta: bool = True
    ) -> StressScenarioResult:
        """
        Apply multi-sector shock scenario with beta-adjusted variation.
        
        Args:
            positions: Portfolio positions
            sectors_str: Comma-separated "Sector:shock" pairs
            correlation_matrix: Optional correlation matrix
            correlation_spillover: Spillover strength (0-1)
            use_sector_beta: Use historical sector betas
            
        Returns:
            StressScenarioResult
        """
        # Parse and validate sectors (delegated to analyzer)
        sector_shocks = self._sector_analyzer.parse_sector_shocks(sectors_str)
        available_sectors = {self._cache.get_sector(p.symbol) for p in positions}
        normalized_sector_shocks = self._sector_analyzer.validate_and_normalize_sectors(
            sector_shocks, available_sectors
        )
        
        # Calculate shocks for each sector
        all_shocks = {}
        weighting_methods = set()
        
        for sector, shock_pct in normalized_sector_shocks.items():
            sector_stocks = self._sector_analyzer.get_sector_stocks(
                positions, sector, self._cache.get_sector
            )
            
            if use_sector_beta and len(sector_stocks) >= 2:
                result = self._beta_calc.calculate_sector_betas(positions, sector_stocks)
                
                if result:
                    betas, weighting_method = result
                    sector_shocks_dict = self._beta_calc.apply_beta_to_shocks(
                        shock_pct, betas
                    )
                    weighting_methods.add(weighting_method)
                else:
                    sector_shocks_dict = self._sector_analyzer.create_uniform_shocks(
                        sector_stocks, shock_pct
                    )
                    weighting_methods.add("uniform")
            else:
                sector_shocks_dict = self._sector_analyzer.create_uniform_shocks(
                    sector_stocks, shock_pct
                )
                weighting_methods.add("uniform")
            
            all_shocks.update(sector_shocks_dict)
        
        if not all_shocks:
            raise ValueError("No positions found in the specified sectors.")
        
        # Generate scenario metadata (delegated to analyzer)
        scenario_name = self._sector_analyzer.generate_multi_sector_name(
            normalized_sector_shocks
        )
        
        # Determine overall weighting method
        if len(weighting_methods) == 1:
            overall_weighting = next(iter(weighting_methods))  # first element in the set
        else:
            overall_weighting = "mixed"
        
        # Generate description
        shock_descriptions = [
            f"{sector} {abs(shock)*100:.0f}%"
            for sector, shock in normalized_sector_shocks.items()
        ]
        
        if overall_weighting != "uniform":
            suffix = f"with {overall_weighting} sector beta (leave-one-out)"
        else:
            suffix = "(uniform shock)"
        
        description = f"Combined sector shocks: {', '.join(shock_descriptions)} {suffix}"
        
        # Apply scenario
        return self.apply_stress_scenario(
            positions=positions,
            scenario_name=scenario_name,
            description=description,
            scenario_type="sector",
            shocks=all_shocks,
            correlation_matrix=correlation_matrix,
            apply_correlations=True,
            correlation_spillover=correlation_spillover
        )
    
    def interest_rate_shock_scenario(
        self,
        positions: List[PortfolioPositionWithMarketData],
        rate_change_bps: int = 200,
        bond_duration: float = 17.0,
        sector_rate_betas: Optional[Dict[str, float]] = None,
        max_shock: float = 0.8,
        min_shock: float = -0.8,
    ) -> StressScenarioResult:
        """
        Interest rate shock using duration-based sensitivity.
        
        Professional model based on factor regression approach:
        - Converts rate change to bond ETF shock using duration
        - Applies sector-specific rate sensitivities (not equity beta)
        - Models differential impacts: banks benefit, growth stocks hurt
        
        Technical approach:
        1. Convert bps → bond shock using modified duration (~17 for TLT)
        Formula: bond_shock = -duration × rate_change
        Example: +200bps → -17 × 0.02 = -34% bond drop
        
        2. Apply sector-specific rate betas
        Formula: stock_shock = rate_beta × bond_shock
        
        Rate beta interpretation:
        - Positive: Stock falls when rates rise (most sectors)
        - Negative: Stock rises when rates rise (banks/financials)
        
        Example rate betas (empirically derived):
        - Banks/Financials: -0.65 (benefit from higher rates)
        - Tech/Comm Services: +1.0 (high duration sensitivity)
        - Utilities: +1.3 (extremely rate-sensitive)
        - REITs: +1.15 (leverage + dividend focus)
        - Consumer Defensive: +0.4 (low sensitivity)
        - Healthcare: +0.5 (moderate sensitivity)
        - Energy/Materials: +0.3 (commodity-driven, low rate correlation)
        - Industrials: +0.6 (moderate sensitivity)
        - Consumer Cyclical: +0.5 (moderate sensitivity)
        
        3. Clamp to prevent extreme values (default ±80%)

        NOTE: Correlation spillover is NOT applicable here because ALL positions
        receive direct shocks based on their sector rate betas. There are no
        "un-shocked" positions to spill over to.
        
        Args:
            positions: Portfolio positions
            rate_change_bps: Rate change in basis points (+ = increase, - = decrease)
            bond_duration: Effective duration of bond proxy (default 17 for TLT)
            sector_rate_betas: Optional dict to override default sector betas
                            Example: {"Technology": 1.2, "Financial Services": -0.7}
            max_shock: Maximum allowed shock for any stock (default 0.8 = 80%)
            min_shock: Minimum allowed shock for any stock (default -0.8 = -80%)
        
        Returns:
            StressScenarioResult with sector-specific rate impacts
        """
        # What is an interest rate in bps?
        # Interest rate: The cost of borrowing money or the yield on bonds.
        # Basis points (bps): A way to measure small changes in rates.
        # 1 bps = 0.01% = 0.0001 in decimal
        # 100 bps = 1%
        # Formula: rate change in decimal = bps / 10000​
        # Convert bps to decimal
        # NOTE: we assume Δy=Δ(interest rate)
        # But in real life (more accurate answer):
        # depends which maturity (2Y, 10Y, 30Y), yield curve might not shift equally
        # i.e depends on yield curve, but for simplicity we stick with this.
        rate_change_pct = rate_change_bps / 10000.0
        
        # Step 1: Bond price sensitivity to interest rates (Bond Shock), i.e calculate bond shock
        # Bonds have a property called modified duration, which measures how much the bond price changes 
        # for a given change in interest rates.

        # Formula: ΔP/P ≈ -D × Δy
        # Where:
        # ΔP/P = % change in bond price 
        # D = modified duration of the bond (sensitivity in years)
        # Modified Duration is basically:
        # How sensitive a bond's price is to changes in yield (interest rate).
        # If duration is 17 years, it means:
        # If yield increases by 1%, the bond price drops by about 17%.

        # Δy = change in yield (Yield to Maturity, YTM) in decimal form
        # yield = the annual return you earn from holding a bond (expressed as a %, but decimal oso ok).

        # Why the minus sign?
        # If rates go up, bond prices go down => negative correlation
        # If rates go down, bond prices go up
        # For TLT (20Y Treasury): D ≈ 17
        # TLT = ETF representing long-term US Treasury bonds (iShares 20+ Year Treasury Bond ETF).
        bond_shock = -bond_duration * rate_change_pct
        bond_shock = max(-0.5, min(0.5, bond_shock))  # Clamp realistic bond shock
        
        # Stocks don't move exactly like bonds. Some are more sensitive to rates than others. 
        # This is captured by rate beta
        # Positive beta => stock falls when rates rise
        # Example: Tech => distant cash flows => hurt by rising rates
        # Negative beta => stock rises when rates rise
        # Example: Banks => earn more from lending => benefit
        # Default sector rate betas (empirically derived from academic/industry research)
        # Key insight: Rate beta ≠ Equity beta
        # Rate beta measures correlation with bond returns, not market returns
        default_betas = {
            'financial services': -0.65,  # Banks benefit from higher rates (NIM expansion)
            'technology': 1.0,             # High duration, distant cash flows
            'communication services': 1.0, # Similar to tech
            'utilities': 1.3,              # Bond-like, high dividend yield
            'real estate': 1.15,           # REITs: leverage + dividends
            'consumer defensive': 0.4,     # Stable, low rate sensitivity
            'healthcare': 0.5,             # Moderate sensitivity
            'energy': 0.3,                 # Commodity-driven, low rate correlation
            'basic materials': 0.3,        # Commodity-driven
            'industrials': 0.6,            # Moderate sensitivity
            'consumer cyclical': 0.5,      # Moderate sensitivity
        }
        
        # Allow user to override defaults
        if sector_rate_betas:
            # Normalize user-provided keys to lowercase for matching
            normalized_custom = {k.lower(): v for k, v in sector_rate_betas.items()}
            default_betas.update(normalized_custom)
        
        # Step 2: Compute stock shocks
        shocks = {}
        for position in positions:
            sector = self._cache.get_sector(position.symbol).lower()
            
            # Match sector to rate beta
            rate_beta = None
            
            # Exact match
            if sector in default_betas:
                rate_beta = default_betas[sector]
            else:
                # Partial match
                for key, beta in default_betas.items():
                    if key in sector or sector in key:
                        rate_beta = beta
                        break
            
            # Default fallback
            if rate_beta is None:
                rate_beta = 0.6  # Market average
            
            # Calculate and clamp stock shock
            stock_shock = rate_beta * bond_shock
            
            # Clamp to realistic range
            # To avoid unrealistic scenarios (e.g., stock losing 300%), the shocks are clamped
            stock_shock = max(min_shock, min(max_shock, stock_shock))
            
            shocks[position.symbol] = stock_shock
        
        # Generate description
        direction = "rise" if rate_change_bps > 0 else "fall"
        bond_pct = abs(bond_shock * 100)
        
        return self.apply_stress_scenario(
            positions=positions,
            scenario_name=f"Interest Rate Shock ({'+' if rate_change_bps > 0 else ''}{rate_change_bps}bps)",
            description=(
                f"Interest rates {direction} by {abs(rate_change_bps)}bps "
                f"(~{bond_pct:.1f}% bond shock, duration={bond_duration}) with "
                f"sector-specific rate sensitivities. Financials benefit, growth stocks hurt most."
            ),
            scenario_type="interest_rate",
            shocks=shocks,
            apply_correlations=False,
        )
    
    def historical_scenario(
        self,
        positions: List[PortfolioPositionWithMarketData],
        scenario_id: str
    ) -> StressScenarioResult:
        """
        Apply historical crisis scenario.
        
        Args:
            positions: Portfolio positions
            scenario_id: ID from historical_scenarios module
            
        Returns:
            StressScenarioResult
        """
        # Get scenario data (delegated to data module)
        scenario = historical_scenarios.get_scenario(scenario_id)
        
        # Build sector-specific shocks with beta adjustment
        shocks = {}
        for position in positions:
            sector = self._cache.get_sector(position.symbol)
            beta = self._cache.get_beta(position.symbol)
            shock = scenario['sector_shocks'].get(sector, scenario['market_shock'])
            shocks[position.symbol] = shock * beta  # beta adjusted shock
        
        return self.apply_stress_scenario(
            positions=positions,
            scenario_name=scenario['name'],
            description=scenario['description'],
            scenario_type="historical",
            shocks=shocks,
            apply_correlations=False,  # No spillover needed
        )
    
    def custom_scenario(
        self,
        positions: List[PortfolioPositionWithMarketData],
        request: StressScenarioRequest,
        correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None
    ) -> StressScenarioResult:
        """Apply custom user-defined scenario."""
        return self.apply_stress_scenario(
            positions=positions,
            scenario_name=request.scenario_name,
            description=f"Custom scenario: {request.scenario_name}",
            scenario_type="custom",
            shocks=request.shocks,
            correlation_matrix=correlation_matrix,
            apply_correlations=request.apply_correlations,
            correlation_spillover=request.correlation_spillover
        )
    
    def reverse_stress_test(
        self,
        positions: List[PortfolioPositionWithMarketData],
        target_loss_pct: float = 0.20
    ) -> ReverseStressResult:
        """
        Reverse stress test: What market shock causes target loss?
        
        This is a regulatory requirement for banks (Basel III) and provides
        insight into portfolio vulnerability by working backwards from a loss
        threshold to find the required market shock.
        
        Args:
            positions: Portfolio positions
            target_loss_pct: Target portfolio loss as POSITIVE decimal (e.g., 0.20 for 20% loss)
            
        Returns:
            ReverseStressResult with required shock
        """
        # Validate input
        if target_loss_pct <= 0 or target_loss_pct >= 1:
            raise ValueError(
                "target_loss_pct must be between 0 and 1 (e.g., 0.20 for 20% loss)"
            )
        
        # Binary search for required market shock
        # more_negative = shocks that cause MORE loss (larger magnitude, e.g., -0.8)
        # less_negative = shocks that cause LESS loss (smaller magnitude, e.g., -0.1)
        more_negative = -1.0
        less_negative = 0.0
        tolerance = 0.001
        
        while less_negative - more_negative > tolerance:
            mid_shock = (more_negative + less_negative) / 2
            
            # Build beta-adjusted shocks for this test shock level
            shocks = {}
            for position in positions:
                beta = self._cache.get_beta(position.symbol)
                shocks[position.symbol] = mid_shock * beta
            
            # Apply shock
            result = self.apply_stress_scenario(
                positions=positions,
                scenario_name="Reverse Stress Test",
                description="Finding required shock",
                scenario_type="reverse",
                shocks=shocks,
                apply_correlations=False
            )
            
            # Get actual loss as positive number for comparison
            actual_loss = max(0.0, -result.total_value_change_pct / 100)
            target_loss = target_loss_pct
            
            if actual_loss < target_loss:
                # Not enough loss, need stronger (more negative) shock
                less_negative = mid_shock
            else:
                # Too much loss, shock is too strong (less negative)
                more_negative = mid_shock
        
        required_shock = (more_negative + less_negative) / 2
        
        # Generate final result
        final_shocks = {}
        for position in positions:
            beta = self._cache.get_beta(position.symbol)
            final_shocks[position.symbol] = required_shock * beta
        
        final_result = self.apply_stress_scenario(
            positions=positions,
            scenario_name=f"Reverse Stress: {target_loss_pct*100:.0f}% Loss",
            description=(
                f"Market shock required to cause {target_loss_pct*100:.0f}% "
                f"portfolio loss (beta-adjusted)"
            ),
            scenario_type="reverse",
            shocks=final_shocks,
            apply_correlations=False
        )
        
        return ReverseStressResult(
            target_loss_pct=target_loss_pct,
            required_market_shock=required_shock,
            scenario_description=(
                f"A {abs(required_shock)*100:.1f}% market decline would cause "
                f"a {target_loss_pct*100:.0f}% portfolio loss (with beta adjustments)"
            ),
            affected_positions=final_result.positions
        )
    
    def run_comprehensive_stress_test(
        self,
        positions: List[PortfolioPositionWithMarketData],
        correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None
    ) -> StressTestSummary:
        """
        Run comprehensive stress test suite.
        
        Includes:
        - Market crashes (3 severities)
        - Historical scenarios (all 5)
        - Interest rate shocks (up and down)
        - Sector shocks (for each sector in portfolio)
        
        Args:
            positions: Portfolio positions
            correlation_matrix: Correlation matrix from RiskService
            
        Returns:
            StressTestSummary with all results
        """
        scenarios = []
        
        # Market crashes
        for severity in ['mild', 'moderate', 'severe']:
            scenarios.append(self.market_crash_scenario(positions, severity))
        
        # Historical scenarios
        for scenario_id in historical_scenarios.HISTORICAL_SCENARIOS.keys():
            scenarios.append(self.historical_scenario(positions, scenario_id))
        
        # Interest rate shocks
        scenarios.append(self.interest_rate_shock_scenario(positions, 200))
        scenarios.append(self.interest_rate_shock_scenario(positions, -100))
        
        # Sector shocks for each sector in portfolio
        sectors = set(self._cache.get_sector(p.symbol) for p in positions)
        for sector in sectors:
            if sector != 'Unknown':
                scenarios.append(
                    self.sector_shock_scenario(
                        positions, sector, -0.30, correlation_matrix
                    )
                )
        
        # Analysis
        worst_case = min(scenarios, key=lambda s: s.total_value_change)
        best_case = max(scenarios, key=lambda s: s.total_value_change)
        
        losses = [s.total_value_change for s in scenarios]
        loss_pcts = [s.total_value_change_pct for s in scenarios]
        
        return StressTestSummary(
            scenarios=scenarios,
            worst_case_scenario=worst_case.scenario_name,
            worst_case_loss=worst_case.total_value_change,
            worst_case_loss_pct=worst_case.total_value_change_pct,
            best_case_scenario=best_case.scenario_name,
            best_case_loss=best_case.total_value_change,
            best_case_loss_pct=best_case.total_value_change_pct,
            average_loss_across_scenarios=float(np.mean(losses)),
            median_loss_across_scenarios=float(np.median(losses)),
            scenarios_with_loss_over_20pct=sum(1 for lp in loss_pcts if lp <= -20),
            scenarios_with_loss_over_50pct=sum(1 for lp in loss_pcts if lp <= -50)
        )
    
    def get_historical_scenarios_info(self) -> List[HistoricalScenarioInfo]:
        """Get information about available historical scenarios."""
        return historical_scenarios.get_historical_scenarios_info()