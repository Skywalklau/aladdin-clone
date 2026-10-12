"""
Sector analysis service for stress testing.

Handles:
- Sector grouping and filtering
- Sector exposure calculations
- Multi-sector shock parsing and validation
"""

from typing import Dict, List, Set
import logging
from app.schemas.portfolio import PortfolioPositionWithMarketData
from app.schemas.stress import StressedPosition, SectorExposure

logger = logging.getLogger(__name__)


class SectorAnalyzer:
    """
    Specialized service for sector analysis.
    
    Separates sector logic from main stress service for:
    - Better testability
    - Clearer data transformation logic
    - Reusability across different scenarios
    """
    
    def get_sector_stocks(
        self, 
        positions: List[PortfolioPositionWithMarketData],
        sector: str,
        sector_getter: callable
    ) -> List[str]:
        """
        Extract stock symbols that belong to target sector.
        
        Args:
            positions: Portfolio positions
            sector: Target sector name
            sector_getter: Function to get sector for a symbol
            
        Returns:
            List of stock symbols in the sector
        """
        return [
            p.symbol for p in positions 
            if sector_getter(p.symbol).lower() == sector.lower()
        ]
    
    def calculate_sector_exposures(
        self,
        stressed_positions: List[StressedPosition],
        total_portfolio_value: float
    ) -> List[SectorExposure]:
        """
        Calculate sector-level exposure summary with weighted average shocks.
        
        Args:
            stressed_positions: List of stressed positions
            total_portfolio_value: Total portfolio value (for percentages)
            
        Returns:
            List of SectorExposure objects, sorted by portfolio percentage
        """
        sector_data: Dict[str, Dict] = {}
        
        for pos in stressed_positions:
            if pos.sector not in sector_data:
                sector_data[pos.sector] = {
                    'count': 0,
                    'total_value': 0.0,
                    'weighted_shock_sum': 0.0,
                    'value_change': 0.0
                }
            
            # Update counts and totals
            sector_data[pos.sector]['count'] += 1
            sector_data[pos.sector]['total_value'] += pos.original_market_value
            sector_data[pos.sector]['weighted_shock_sum'] += (
                pos.price_shock_pct * pos.original_market_value
            )
            sector_data[pos.sector]['value_change'] += pos.value_change
        
        exposures = []
        for sector, data in sector_data.items():
            # Weighted average shock
            weighted_avg_shock = (
                (data['weighted_shock_sum'] / data['total_value']) 
                if data['total_value'] > 0 else 0.0
            )
            
            exposures.append(SectorExposure(
                sector=sector,
                position_count=data['count'],
                total_market_value=data['total_value'],
                percentage_of_portfolio=(
                    (data['total_value'] / total_portfolio_value * 100) 
                    if total_portfolio_value > 0 else 0
                ),
                average_shock=weighted_avg_shock,
                total_value_change=data['value_change']
            ))
        
        # Sort by portfolio percentage descending
        exposures.sort(key=lambda x: x.percentage_of_portfolio, reverse=True)
        
        return exposures
    
    def parse_sector_shocks(self, sectors_str: str) -> Dict[str, float]:
        """
        Parse comma-separated 'Sector1:shock1,Sector2:shock2' format.
        
        Args:
            sectors_str: Comma-separated sector:shock pairs
            
        Returns:
            Dictionary mapping sector names to shock values
            
        Raises:
            ValueError: If format is invalid or shock values are out of range
        """
        sector_shocks = {}
        
        for item in sectors_str.split(','):
            if ':' not in item:
                raise ValueError(
                    f"Invalid format for '{item}'. Expected 'Sector:shock'"
                )
            
            sector, shock_str = item.split(':', 1)
            sector = sector.strip()
            
            try:
                shock = float(shock_str.strip())
            except ValueError:
                raise ValueError(
                    f"Invalid shock value '{shock_str}' for sector '{sector}'"
                )
            
            # Validate shock is reasonable
            if shock < -1.0 or shock > 1.0:
                raise ValueError(
                    f"Shock {shock} for '{sector}' is outside valid range [-1.0, 1.0]"
                )
            
            sector_shocks[sector] = shock
        
        if not sector_shocks:
            raise ValueError(
                "No sectors specified. Provide at least one sector:shock pair."
            )
        
        return sector_shocks
    
    def validate_and_normalize_sectors(
        self,
        sector_shocks: Dict[str, float],
        available_sectors: Set[str]
    ) -> Dict[str, float]:
        """
        Validate sector names exist in portfolio and normalize (case-insensitive).
        
        Args:
            sector_shocks: User-provided sector:shock mapping
            available_sectors: Set of sectors actually in portfolio
            
        Returns:
            Normalized sector:shock mapping with correct sector names
            
        Raises:
            ValueError: If any sectors are not found in portfolio
        """
        normalized_sector_shocks = {}
        invalid_sectors = []
        
        for user_sector, shock in sector_shocks.items():
            # Find matching sector (case-insensitive)
            matching_sector = None
            for avail in available_sectors:
                if avail.lower() == user_sector.lower():
                    matching_sector = avail
                    break
            
            if matching_sector:
                normalized_sector_shocks[matching_sector] = shock
            else:
                invalid_sectors.append(user_sector)
        
        if invalid_sectors:
            raise ValueError(
                f"Sectors not found in portfolio: {invalid_sectors}. "
                f"Available sectors: {sorted(available_sectors)}"
            )
        
        return normalized_sector_shocks
    
    def generate_multi_sector_name(self, sector_shocks: Dict[str, float]) -> str:
        """
        Generate descriptive scenario name for multi-sector shock.
        
        Args:
            sector_shocks: Dictionary of sector:shock pairs
            
        Returns:
            Formatted scenario name
        """
        sector_names = list(sector_shocks.keys())
        
        if len(sector_names) == 1:
            return f"{sector_names[0]} Sector Shock"
        elif len(sector_names) == 2:
            return f"{sector_names[0]} & {sector_names[1]} Shock"
        else:
            return f"Multi-Sector Shock ({len(sector_names)} sectors)"
    
    def generate_sector_description(
        self,
        sector: str,
        shock_pct: float,
        weighting_method: str
    ) -> str:
        """
        Generate description for sector shock scenario.
        
        Args:
            sector: Sector name
            shock_pct: Shock percentage
            weighting_method: "cap-weighted", "equal-weighted", or "uniform"
            
        Returns:
            Formatted description string
        """
        if weighting_method in ["cap-weighted", "equal-weighted"]:
            suffix = f"with {weighting_method} sector beta (leave-one-out)"
        else:
            suffix = "(uniform shock - insufficient data for beta adjustment)"
        
        return f"{sector} sector declines {abs(shock_pct)*100:.0f}% {suffix}"
    
    def create_uniform_shocks(
        self,
        sector_stocks: List[str],
        shock_pct: float
    ) -> Dict[str, float]:
        """
        Create uniform shocks for all stocks in sector.
        
        Args:
            sector_stocks: List of stock symbols
            shock_pct: Shock percentage to apply
            
        Returns:
            Dictionary mapping symbols to uniform shock
        """
        return {stock: shock_pct for stock in sector_stocks}