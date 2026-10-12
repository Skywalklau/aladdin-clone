from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from functools import lru_cache
import os

from app.db.database import get_db
from app.models.portfolio import Position, Portfolio, User
from app.services.insights_service import InsightsService
from app.schemas.insights import StockNewsInsight, PortfolioInsight
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/insights", tags=["insights"])


# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================

@lru_cache()
def get_insights_service() -> InsightsService:
    """
    Get cached insights service instance.

    Requires environment variables:
    - OPENAI_API_KEY
    - FINNHUB_API_KEY
    """
    openai_key = os.getenv("OPENAI_API_KEY")
    finnhub_key = os.getenv("FINNHUB_API_KEY")

    if not openai_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    if not finnhub_key:
        raise ValueError("FINNHUB_API_KEY environment variable not set")

    return InsightsService(
        openai_api_key=openai_key,
        finnhub_api_key=finnhub_key
    )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/stock/{symbol}", response_model=StockNewsInsight)
def get_stock_news_summary(
    symbol: str,
    insights_service: InsightsService = Depends(get_insights_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get AI-powered news analysis and sentiment for a specific stock.

    Fetches the 10 most recent articles from Finnhub and uses OpenAI to
    assess sentiment and summarize key developments. Only articles directly
    relevant to the stock's business or financials are included in the
    sentiment score and returned in the response.

    **Returns:**
    - AI-generated summary of recent developments
    - Overall sentiment (strongly bullish / bullish / neutral / bearish / strongly bearish)
    - Sentiment score (-1.0 to 1.0)
    - Key events and catalysts
    - Relevant news articles with individual sentiment scores
    - Potential stock price impact assessment

    **Example:** `GET /insights/stock/AAPL`

    **Note:** Each request makes one OpenAI call (~$0.01-0.05).
    Consider caching on the client side to avoid unnecessary costs.
    """
    symbol = symbol.upper()

    try:
        return insights_service.analyze_stock_news(symbol)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing stock news: {str(e)}"
        )


@router.get("/portfolio/{portfolio_id}", response_model=PortfolioInsight)
def get_portfolio_insights(
    portfolio_id: int,
    db: Session = Depends(get_db),
    insights_service: InsightsService = Depends(get_insights_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get AI-powered news insights across an entire portfolio.

    Fetches the 10 most recent articles per position from Finnhub and uses
    OpenAI to assess sentiment at the position, sector, and portfolio level.
    Overall portfolio sentiment is computed by weighting each position's
    sentiment score against its share of the total portfolio value.

    **Returns:**
    - Portfolio-level sentiment and narrative
    - Individual position insights with sentiment scores
    - Sector-level aggregated analysis
    - News affecting major holdings
    - Alerts and opportunities

    **Example:** `GET /insights/portfolio/1`

    **Note:** This endpoint makes multiple OpenAI calls (one per position
    plus one portfolio summary). For a 10-position portfolio expect
    ~$0.10-0.50 per request. Consider server-side caching to reduce costs.
    """
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()

    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found.")

    positions = db.query(Position).filter(
        Position.portfolio_id == portfolio_id
    ).all()

    if not positions:
        raise HTTPException(
            status_code=404,
            detail="No positions found for this portfolio."
        )

    symbols = [pos.symbol for pos in positions]

    try:
        return insights_service.analyze_portfolio_news(
            symbols=symbols,
            positions=positions
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing portfolio news: {str(e)}"
        )