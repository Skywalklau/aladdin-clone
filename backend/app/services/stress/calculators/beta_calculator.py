"""
Beta calculation service for stress testing.

Handles:
- Market beta extraction from yfinance
- Leave-one-out sector beta calculations
- Cap-weighted and equal-weighted sector indices
- Robust covariance-based beta computation
"""

from typing import Dict, List, Optional, Tuple
import logging
import pandas as pd
from app.schemas.portfolio import PortfolioPositionWithMarketData
from app.utils.market_data_utils import MarketDataUtils

logger = logging.getLogger(__name__)


class BetaCalculationService:
    """
    Specialized service for beta calculations.
    
    Separates beta logic from main stress service for:
    - Better testability
    - Code reusability
    - Clearer responsibilities
    """
    
    def __init__(self, data_utils: Optional[MarketDataUtils] = None):
        """
        Initialize beta calculator.
        
        Args:
            data_utils: Optional MarketDataUtils instance (will create if None)
        """
        self._data_utils = data_utils or MarketDataUtils()
    
    def compute_beta(
        self, 
        stock_returns: pd.Series, 
        sector_returns: pd.Series
    ) -> float:
        """
        Compute beta with proper NaN handling and validation.
        
        Uses covariance-based calculation:
        beta = Cov(stock, sector) / Var(sector)
        
        Args:
            stock_returns: Stock return series
            sector_returns: Sector index return series
            
        Returns:
            Beta value (clamped to 0.2-3.0 range)
        """
        # Align and drop NaNs
        aligned = pd.concat([
            stock_returns.rename('stock'),
            sector_returns.rename('sector')
        ], axis=1).dropna()
        
        # Need minimum data points
        if len(aligned) < 30:
            logger.warning("Insufficient data points for beta calculation")
            return 1.0
        
        # Calculate covariance matrix (consistent ddof=1)
        cov_matrix = aligned.cov()
        covariance = cov_matrix.loc['stock', 'sector']
        variance = cov_matrix.loc['sector', 'sector']
        
        # Validate results
        if pd.isna(covariance) or pd.isna(variance) or variance <= 0:
            logger.warning("Invalid covariance or variance in beta calculation")
            return 1.0
        
        # Calculate and clamp beta
        beta = covariance / variance
        return max(0.2, min(3.0, beta))
    
    def build_sector_index(
        self,
        stocks: List[str],
        returns_df: pd.DataFrame,
        market_caps: Dict[str, float],
        use_cap_weighting: bool
    ) -> pd.Series:
        """
        Build cap-weighted or equal-weighted sector index.
        
        Args:
            stocks: Stocks to include in index
            returns_df: Historical returns
            market_caps: Market capitalizations
            use_cap_weighting: Whether to use cap-weighting
            
        Returns:
            Series of sector index returns
        """
        if use_cap_weighting:
            weighted_stocks = [s for s in stocks if s in market_caps]
            
            if weighted_stocks:
                total_cap = sum(market_caps[s] for s in weighted_stocks)
                weights = {s: market_caps[s] / total_cap for s in weighted_stocks}
                return sum(returns_df[s] * weights[s] for s in weighted_stocks)
        
        # Equal-weighted fallback
        return returns_df[stocks].mean(axis=1)
    
    def calculate_single_stock_beta(
        self,
        stock: str,
        sector_stocks: List[str],
        returns_df: pd.DataFrame,
        market_caps: Dict[str, float],
        use_cap_weighting: bool
    ) -> float:
        """
        Calculate leave-one-out beta for a single stock.
        
        The stock is excluded from the sector index to avoid
        self-correlation bias in the beta calculation.
        
        Args:
            stock: Stock symbol
            sector_stocks: All stocks in sector
            returns_df: Historical returns
            market_caps: Market capitalizations
            use_cap_weighting: Whether to use cap-weighting
            
        Returns:
            Beta value for the stock
        """
        # Leave-one-out: exclude this stock
        other_stocks = [
            s for s in sector_stocks 
            if s != stock and s in returns_df.columns
        ]
        
        if not other_stocks:
            return 1.0
        
        # Build sector index (excluding this stock)
        sector_index = self.build_sector_index(
            other_stocks,
            returns_df,
            market_caps,
            use_cap_weighting
        )
        
        # Calculate beta
        return self.compute_beta(returns_df[stock], sector_index)
    
    def calculate_sector_betas(
        self,
        positions: List[PortfolioPositionWithMarketData],
        sector_stocks: List[str]
    ) -> Optional[Tuple[Dict[str, float], str]]:
        """
        Calculate leave-one-out sector betas for all stocks in sector.
        
        This is the main entry point for sector beta calculations.
        
        NOTE: sector shock right now is using portfolio beta (How each stock moves 
        relative to your other portfolio holdings in the sector)
        Consider using market beta as well (How each stock moves relative to the 
        actual market sector)
        
        Args:
            positions: All portfolio positions
            sector_stocks: Stocks in target sector
            
        Returns:
            Tuple of (beta_dict, weighting_method) or None if calculation fails
            - beta_dict maps symbol -> beta value
            - weighting_method is "cap-weighted" or "equal-weighted"
        """
        try:
            # Download historical data
            all_symbols = [p.symbol for p in positions]
            price_df = self._data_utils.download_price_data(all_symbols)
            
            if price_df.empty:
                logger.warning("No price data available for sector beta calculation")
                return None
            
            # Calculate returns
            returns_df = self._data_utils.calculate_returns(price_df)
            
            if returns_df.empty:
                logger.warning("No returns data available for sector beta calculation")
                return None
            
            # Filter to stocks with data
            available_stocks = [s for s in sector_stocks if s in returns_df.columns]
            
            if len(available_stocks) < 2:
                logger.warning(f"Only {len(available_stocks)} stocks with data, need >= 2")
                return None
            
            # Get market caps
            market_caps = self._get_valid_market_caps(available_stocks)
            
            # Decide weighting method (70% threshold)
            use_cap_weighting = len(market_caps) >= len(available_stocks) * 0.7
            weighting_method = "cap-weighted" if use_cap_weighting else "equal-weighted"
            
            logger.info(
                f"Using {weighting_method} sector index "
                f"({len(market_caps)}/{len(available_stocks)} caps available)"
            )
            
            # Calculate beta for each stock
            betas = {}
            for stock in available_stocks:
                beta = self.calculate_single_stock_beta(
                    stock,
                    available_stocks,
                    returns_df,
                    market_caps,
                    use_cap_weighting
                )
                betas[stock] = beta
            
            # Fill in missing stocks with beta=1.0
            for stock in sector_stocks:
                if stock not in betas:
                    betas[stock] = 1.0
            
            return betas, weighting_method
            
        except Exception as e:
            logger.warning(f"Error calculating sector betas: {e}")
            return None
    
    def apply_beta_to_shocks(
        self,
        sector_shock_pct: float,
        betas: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Apply beta adjustment to sector shock.
        
        Args:
            sector_shock_pct: Base sector shock percentage
            betas: Dictionary mapping symbols to beta values
            
        Returns:
            Dictionary mapping symbols to beta-adjusted shocks
        """
        shocks = {}
        for stock, beta in betas.items():
            shock = sector_shock_pct * beta
            # Clamp to prevent extreme values
            shock = max(-0.95, min(0.95, shock))
            shocks[stock] = shock
        
        return shocks
    
    def _get_valid_market_caps(self, symbols: List[str]) -> Dict[str, float]:
        """
        Get market caps, filtering out None/invalid values.
        
        Args:
            symbols: List of stock symbols
            
        Returns:
            Dictionary of symbol -> market_cap (only valid values)
        """
        caps_raw = self._data_utils.get_market_caps(symbols)
        return {
            s: cap for s, cap in caps_raw.items() 
            if cap is not None and cap > 0
        }