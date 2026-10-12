"""
Helper functions for stress testing router to reduce code duplication.

These functions handle common patterns across stress testing endpoints:
- Loading and enriching portfolio positions
- Getting correlation matrix when needed
- Error handling
"""
from typing import List, Optional, Dict
from fastapi import HTTPException
from sqlalchemy.orm import Session
import logging
from app.models.portfolio import Position
from app.schemas.portfolio import PortfolioPositionWithMarketData
from app.services.portfolio_service import PortfolioService
from app.services.risk_service import RiskService

logger = logging.getLogger(__name__)


def load_and_enrich_positions(
    db: Session,
    portfolio_id: int,
    portfolio_service: PortfolioService,
) -> List[PortfolioPositionWithMarketData]:
    """
    Load positions from DB and enrich with market data.
    
    This function consolidates the repeated pattern of:
    1. Load positions from DB by portfolio_id
    2. Analyze with portfolio service
    3. Extract enriched positions
    4. Validate we have data
    
    Args:
        db: Database session
        portfolio_id: ID of the portfolio to load
        portfolio_service: Portfolio service instance
        
    Returns:
        List of enriched positions with market data
        
    Raises:
        HTTPException: If no positions found or no valid market data
    """
    # Load positions from DB
    positions = db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
    if not positions:
        raise HTTPException(status_code=404, detail="No positions found for this portfolio.")

    # Enrich with market data
    try:
        portfolio_summary = portfolio_service.analyze(positions)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    enriched_positions = portfolio_summary.positions

    if not enriched_positions:
        raise HTTPException(status_code=404, detail="No valid positions with market data.")

    return enriched_positions


def get_correlation_matrix(
    use_correlations: bool,
    enriched_positions: List[PortfolioPositionWithMarketData],
    risk_service: RiskService
) -> Optional[Dict[str, Dict[str, float]]]:
    """
    Get correlation matrix if correlations are enabled.
    
    This function consolidates the repeated pattern of:
    1. Check if correlations should be used
    2. Try to calculate correlation matrix
    3. Log warning and continue if it fails
    
    Args:
        use_correlations: Whether to calculate correlations
        enriched_positions: List of enriched positions
        risk_service: Risk service instance
        
    Returns:
        Correlation matrix dict or None
    """
    if not use_correlations:
        return None
    
    try:
        symbols = [p.symbol for p in enriched_positions]
        price_df = risk_service._download_price_data(symbols)
        returns_df = risk_service._calculate_returns(price_df)
        return risk_service.calculate_correlation_matrix(returns_df)
    except Exception as e:
        logger.warning(f"Could not calculate correlations: {e}")
        return None