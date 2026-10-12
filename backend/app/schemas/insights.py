"""
Pydantic schemas for AI insights endpoints.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

SENTIMENT_DESCRIPTION = "Sentiment: strongly bullish, bullish, neutral, bearish, or strongly bearish"


class NewsArticle(BaseModel):
    """Individual news article."""
    title: str
    source: str
    published_at: str
    url: str
    sentiment: str = Field(
        default="neutral",
        description=SENTIMENT_DESCRIPTION
    )
    sentiment_score: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Sentiment score from -1.0 (very bearish) to 1.0 (very bullish)"
    )
    relevant: bool = Field(
        default=True,
        description="Whether this article is directly relevant to the stock"
    )
    summary: Optional[str] = None


class StockNewsInsight(BaseModel):
    """AI-powered news analysis for a single stock."""
    symbol: str
    overall_sentiment: str = Field(
        description=SENTIMENT_DESCRIPTION
    )
    sentiment_score: float = Field(
        ge=-1.0,
        le=1.0,
        description="Sentiment score from -1.0 (very bearish) to 1.0 (very bullish)"
    )
    ai_summary: str = Field(
        description="AI-generated summary of recent news and developments"
    )
    key_events: List[str] = Field(
        description="Major events or catalysts identified"
    )
    top_articles: List[NewsArticle] = Field(
        description="Most relevant news articles"
    )
    potential_impact: str = Field(
        description="AI assessment of potential stock price impact"
    )
    generated_at: datetime


class PositionInsight(BaseModel):
    """News insight for a single portfolio position."""
    symbol: str
    position_weight: float = Field(
        ge=0.0,
        le=1.0,
        description="Position weight as fraction of portfolio (0.0 to 1.0)"
    )
    sentiment: str = Field(
        description=SENTIMENT_DESCRIPTION
    )
    sentiment_score: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Sentiment score from -1.0 (very bearish) to 1.0 (very bullish)"
    )
    key_news: str = Field(
        description="Brief summary of key news for this position"
    )
    potential_impact: str = Field(
        description="Expected impact on this position"
    )


class PortfolioInsight(BaseModel):
    """AI-powered portfolio-level insights."""
    portfolio_id: int
    overall_sentiment: str = Field(
        description=SENTIMENT_DESCRIPTION
    )
    sentiment_score: float = Field(
        ge=-1.0,
        le=1.0,
        description="Weighted average sentiment across portfolio"
    )
    ai_summary: str = Field(
        description="Portfolio-level narrative summarizing key themes"
    )
    position_insights: List[PositionInsight] = Field(
        description="Individual insights for each position"
    )
    sector_insights: Dict[str, Dict] = Field(
        default_factory=dict,
        description="Sector-level aggregated insights"
    )
    top_movers_news: List[str] = Field(
        description="News affecting largest positions or biggest movers"
    )
    alerts: List[str] = Field(
        description="Important alerts, warnings, or opportunities"
    )
    generated_at: datetime