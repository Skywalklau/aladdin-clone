"""
Correlation spillover calculator.

Handles propagation of shocks through correlated positions.
"""

from typing import Dict
import logging
from app.schemas.portfolio import PortfolioPositionWithMarketData

logger = logging.getLogger(__name__)


class CorrelationSpilloverCalculator:
    """
    Calculate spillover effects from correlated positions.
    
    When one stock is shocked, correlated stocks may also
    experience indirect shocks through their correlation.
    """
    
    def calculate_spillover(
        self,
        position: PortfolioPositionWithMarketData,
        primary_shocks: Dict[str, float],
        correlation_matrix: Dict[str, Dict[str, float]],
        spillover_strength: float
    ) -> float:
        """
        Calculate spillover shock from correlated positions.
        
        The spillover is correlation-weighted: positions with higher
        correlation to shocked positions receive stronger spillover effects.
        
        Args:
            position: Position to calculate spillover for
            primary_shocks: Direct shocks applied to other positions
            correlation_matrix: Correlation matrix from risk service
            spillover_strength: Factor (0-1) determining spillover strength
            
        Returns:
            Spillover shock as decimal (e.g., -0.05 for -5%)
        """
        if position.symbol not in correlation_matrix:
            return 0.0
        
        spillover = 0.0
        weight_sum = 0.0
        
        for shocked_symbol, shock in primary_shocks.items():
            if shocked_symbol == position.symbol:
                continue
            
            # Get correlation
            corr = correlation_matrix.get(position.symbol, {}).get(shocked_symbol, 0.0)
            
            if abs(corr) > 0.1:  # Only consider meaningful correlations
                # Accumulate weighted spillover (correlation-weighted)
                spillover += shock * corr
                weight_sum += abs(corr)
        
        if weight_sum > 0:
            # Normalize by total weight and apply spillover strength
            # Weighting by correlation ensures positions that are more strongly
            # correlated have more influence
            return (spillover / weight_sum) * spillover_strength
        
        return 0.0
    
    def calculate_average_correlation(
        self,
        shocks: Dict[str, float],
        correlation_matrix: Dict[str, Dict[str, float]]
    ) -> float:
        """
        Calculate shock-weighted average correlation.
        
        Used for reporting how correlated the shocked positions are.
        
        Args:
            shocks: Dictionary of symbol -> shock
            correlation_matrix: Correlation matrix
            
        Returns:
            Weighted average correlation
        """
        corr_weighted_sum = 0.0
        shock_sum = 0.0
        
        for symbol in shocks:
            if symbol not in correlation_matrix:
                continue
            
            for other_symbol, shock in shocks.items():
                if other_symbol == symbol:
                    continue
                
                if other_symbol in correlation_matrix[symbol]:
                    corr = correlation_matrix[symbol][other_symbol]
                    # weight correlation by shock magnitude
                    corr_weighted_sum += abs(corr) * abs(shock)
                    shock_sum += abs(shock)
        
        return (corr_weighted_sum / shock_sum) if shock_sum > 0 else 0.0