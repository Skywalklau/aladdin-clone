"""
AI-powered insights service using OpenAI and Finnhub news API.

Provides:
- Stock-level news analysis
- Portfolio-level sentiment aggregation
- Event detection and impact assessment
"""

import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import requests
from openai import OpenAI
import json
import yfinance as yf

from app.models.portfolio import Position
from app.schemas.insights import (
    StockNewsInsight,
    PortfolioInsight,
    NewsArticle,
    PositionInsight
)

logger = logging.getLogger(__name__)


class InsightsService:
    """
    AI-powered insights service.

    Features:
    - News fetching from Finnhub (financial-specific, pre-filtered by ticker)
    - OpenAI-powered summarization
    - Sentiment analysis
    - Portfolio-level aggregation
    """

    # Number of days to look back for news - kept small to ensure
    # we always get the most recent and relevant articles
    NEWS_LOOKBACK_DAYS = 3

    # Number of most recent articles to analyze per stock
    ARTICLES_TO_ANALYZE = 10

    def __init__(self, openai_api_key: str, finnhub_api_key: str):
        """
        Initialize insights service.

        Args:
            openai_api_key: OpenAI API key
            finnhub_api_key: Finnhub API key
        """
        self.openai_client = OpenAI(api_key=openai_api_key)
        self.finnhub_api_key = finnhub_api_key
        self.finnhub_base = "https://finnhub.io/api/v1"

        # Cache for yfinance ticker info (shared by _get_sector and _get_company_name)
        self._ticker_info_cache: Dict[str, Dict] = {}

    # ========================================================================
    # PUBLIC API - Stock Analysis
    # ========================================================================

    def analyze_stock_news(self, symbol: str) -> StockNewsInsight:
        """
        Analyze the most recent news for a single stock.

        Fetches the latest articles from Finnhub and uses OpenAI to assess
        sentiment and summarize key developments.

        Args:
            symbol: Stock ticker symbol

        Returns:
            StockNewsInsight with AI-generated analysis
        """
        logger.info(f"Analyzing news for {symbol}")

        articles = self._fetch_stock_news(symbol)

        if not articles:
            logger.warning(f"No news found for {symbol}")
            return self._create_empty_stock_insight(symbol)

        ai_analysis = self._generate_stock_analysis(symbol, articles)

        # Pass per-article sentiments, scores and relevance through to schema
        article_sentiments = ai_analysis.get("article_sentiments", {})
        news_articles = [
            self._article_to_schema(
                a,
                sentiment=article_sentiments.get(str(i + 1), {}).get("sentiment", "neutral"),
                sentiment_score=article_sentiments.get(str(i + 1), {}).get("score", 0.0),
                relevant=article_sentiments.get(str(i + 1), {}).get("relevant", True)
            )
            for i, a in enumerate(articles[:self.ARTICLES_TO_ANALYZE])
        ]

        # Only return relevant articles
        news_articles = [a for a in news_articles if a.relevant]

        return StockNewsInsight(
            symbol=symbol,
            overall_sentiment=ai_analysis["overall_sentiment"],
            sentiment_score=ai_analysis["sentiment_score"],
            ai_summary=ai_analysis["summary"],
            key_events=ai_analysis["key_events"],
            top_articles=news_articles,
            potential_impact=ai_analysis["potential_impact"],
            generated_at=datetime.now()
        )

    # ========================================================================
    # PUBLIC API - Portfolio Analysis
    # ========================================================================

    def analyze_portfolio_news(
        self,
        symbols: List[str],
        positions: List[Position]
    ) -> PortfolioInsight:
        """
        Analyze the most recent news across an entire portfolio.

        Args:
            symbols: List of stock symbols in portfolio
            positions: List of Position objects with quantities/values

        Returns:
            PortfolioInsight with aggregated analysis
        """
        logger.info(f"Analyzing portfolio news for {len(symbols)} positions")

        all_news = {}
        for symbol in symbols:
            articles = self._fetch_stock_news(symbol)
            if articles:
                all_news[symbol] = articles

        if not all_news:
            logger.warning("No news found for any portfolio positions")
            return self._create_empty_portfolio_insight(
                positions[0].portfolio_id if positions else 0
            )


        position_insights = []
        position_weights = self._calculate_position_weights(positions)

        for pos in positions:
            if pos.symbol in all_news:
                insight = self._analyze_position(
                    pos,
                    all_news[pos.symbol],
                    position_weights.get(pos.symbol, 0)
                )
                position_insights.append(insight)

        portfolio_analysis = self._generate_portfolio_analysis(
            positions,
            position_insights,
            position_weights
        )

        sector_insights = self._aggregate_sector_insights(
            position_insights,
            positions
        )

        return PortfolioInsight(
            portfolio_id=positions[0].portfolio_id,
            overall_sentiment=portfolio_analysis["overall_sentiment"],
            sentiment_score=portfolio_analysis["sentiment_score"],
            ai_summary=portfolio_analysis["summary"],
            position_insights=position_insights,
            sector_insights=sector_insights,
            top_movers_news=portfolio_analysis["top_movers"],
            alerts=portfolio_analysis["alerts"],
            generated_at=datetime.now()
        )

    # ========================================================================
    # NEWS FETCHING
    # ========================================================================

    def _fetch_stock_news(self, symbol: str) -> List[Dict]:
        """
        Fetch the most recent news articles for a stock from Finnhub.

        Uses a short lookback window to ensure we get the latest news.
        Results are sorted by date descending so the most recent articles
        are always analyzed first.

        Args:
            symbol: Stock ticker

        Returns:
            List of deduplicated article dictionaries, most recent first
        """
        try:
            to_date = datetime.now()
            from_date = to_date - timedelta(days=self.NEWS_LOOKBACK_DAYS)

            response = requests.get(
                f"{self.finnhub_base}/company-news",
                params={
                    "symbol": symbol.upper(),
                    "from": from_date.strftime('%Y-%m-%d'),
                    "to": to_date.strftime('%Y-%m-%d'),
                    "token": self.finnhub_api_key
                },
                timeout=10
            )

            if response.status_code == 200:
                articles = response.json()

                # Sort by most recent first
                articles = sorted(
                    articles,
                    key=lambda a: a.get('datetime', 0),
                    reverse=True
                )

                # Deduplicate by headline
                seen_headlines = set()
                unique_articles = []
                for a in articles:
                    headline = a.get("headline", "").strip()
                    if headline and headline not in seen_headlines:
                        seen_headlines.add(headline)
                        unique_articles.append(a)

                logger.info(f"Found {len(unique_articles)} articles for {symbol}")

                if len(unique_articles) < 3:
                    logger.warning(
                        f"Only {len(unique_articles)} articles found for {symbol}"
                    )

                return unique_articles
            else:
                logger.error(
                    f"Finnhub error for {symbol}: {response.status_code} - {response.text}"
                )
                return []

        except Exception as e:
            logger.error(f"Error fetching news for {symbol}: {e}")
            return []

    # ========================================================================
    # AI ANALYSIS - Stock Level
    # ========================================================================

    def _generate_stock_analysis(
        self,
        symbol: str,
        articles: List[Dict]
    ) -> Dict:
        """
        Use OpenAI to analyze stock news.

        Per-article sentiments, scores and relevance flags are returned by the
        model. Overall sentiment and score are computed from relevant articles
        only, ensuring irrelevant articles do not skew the result.

        Returns dict with:
        - summary: AI-generated summary
        - overall_sentiment: derived from relevant article scores
        - sentiment_score: -1.0 to 1.0 (average of relevant article scores)
        - key_events: List of important events
        - potential_impact: Impact assessment
        - article_sentiments: Per-article sentiment, score and relevance
        """
        news_context = self._format_articles_for_prompt(
            articles[:self.ARTICLES_TO_ANALYZE]
        )

        prompt = f"""Analyze each news article for {symbol} and assess its financial impact.

        RECENT NEWS:
        {news_context}

        Instructions:
        - For each article, determine if it is directly relevant to {symbol}'s business, financials, or stock performance.
        - For relevant articles, assign a sentiment and a score between -1.0 (very bearish) and 1.0 (very bullish).
        - For irrelevant articles, assign sentiment "neutral", score 0.0, and relevant false.
        - Extract key financial events from relevant articles only: earnings, mergers, guidance updates, lawsuits, dividends, major announcements.
        - Provide a short summary of 2-3 sentences covering all relevant articles only.
        - Describe potential impact on stock price based on relevant articles only.
        - Be objective, fact-based, and consider the recency of articles.

        Return JSON:
        {{
            "summary": "2-3 sentence summary of key developments",
            "key_events": ["event 1", "event 2", "event 3"],
            "potential_impact": "Assessment of how this news might affect the stock price",
            "article_sentiments": {{
                "1": {{"sentiment": "strongly bullish/bullish/neutral/bearish/strongly bearish", "score": 0.0, "relevant": true}},
                "2": {{"sentiment": "strongly bullish/bullish/neutral/bearish/strongly bearish", "score": 0.0, "relevant": false}}
            }}
        }}"""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a financial analyst providing objective stock market analysis based on news."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            # Compute overall sentiment from relevant article scores only,
            # so irrelevant articles do not dilute the result
            article_sentiments = result.get("article_sentiments", {})
            if article_sentiments:
                scores = [
                    v["score"] for v in article_sentiments.values()
                    if isinstance(v, dict) and "score" in v and v.get("relevant", True)
                ]
                avg_score = sum(scores) / len(scores) if scores else 0.0
            else:
                avg_score = 0.0

            result["sentiment_score"] = round(avg_score, 4)
            result["overall_sentiment"] = self._score_to_sentiment(avg_score)

            logger.info(f"Generated analysis for {symbol}")
            return result

        except Exception as e:
            logger.error(f"Error generating stock analysis: {e}")
            return self._fallback_stock_analysis()

    # ========================================================================
    # AI ANALYSIS - Portfolio Level
    # ========================================================================

    def _generate_portfolio_analysis(
        self,
        positions: List[Position],
        position_insights: List[PositionInsight],
        position_weights: Dict[str, float]
    ) -> Dict:
        """
        Generate portfolio-level AI analysis.

        Overall sentiment and score are computed from position sentiment scores
        weighted by position size, ensuring consistency with position-level data.

        Returns dict with portfolio-level insights.
        """
        portfolio_context = self._format_portfolio_context(
            positions,
            position_insights,
            position_weights
        )

        prompt = f"""Analyze the overall portfolio situation based on recent news across all holdings.

        PORTFOLIO POSITIONS:
        {portfolio_context}

        Provide your analysis in JSON format:
        {{
            "summary": "Overall portfolio narrative (3-4 sentences covering key themes)",
            "top_movers": ["News about positions with biggest potential impact"],
            "alerts": ["Important warnings or opportunities"]
        }}

        Focus on portfolio-level themes, correlated risks, and diversification."""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a portfolio manager analyzing news across multiple holdings."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            # Compute overall sentiment from position scores weighted by position size,
            # ensuring consistency with position-level data
            total_weight = sum(i.position_weight for i in position_insights)
            if position_insights and total_weight > 0:
                weighted_score = sum(
                    i.sentiment_score * i.position_weight
                    for i in position_insights
                )
                avg_score = weighted_score / total_weight
            else:
                avg_score = 0.0

            result["sentiment_score"] = round(avg_score, 4)
            result["overall_sentiment"] = self._score_to_sentiment(avg_score)

            logger.info("Generated portfolio analysis")
            return result

        except Exception as e:
            logger.error(f"Error generating portfolio analysis: {e}")
            return self._fallback_portfolio_analysis()

    def _analyze_position(
        self,
        position: Position,
        articles: List[Dict],
        weight: float
    ) -> PositionInsight:
        """
        Analyze news for a single position.

        Lightweight analysis for each position.
        """
        news_text = "\n".join([
            f"- {a.get('headline', '')}: {a.get('summary', '')[:300]}"
            for a in articles[:10]
        ])

        prompt = f"""Analyze news for {position.symbol} ({weight*100:.1f}% of portfolio).

        Recent headlines:
        {news_text}

        Provide brief JSON response:
        {{
            "sentiment": "strongly bullish/bullish/neutral/bearish/strongly bearish",
            "score": <number between -1.0 (very bearish) and 1.0 (very bullish)>,
            "key_news": "1-2 sentence summary",
            "potential_impact": "Brief impact assessment"
        }}"""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a stock news analyst analyzing news for a particular stock."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=300,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            return PositionInsight(
                symbol=position.symbol,
                position_weight=weight,
                sentiment=result.get("sentiment", "neutral"),
                sentiment_score=result.get("score", 0.0),
                key_news=result.get("key_news", "No significant news"),
                potential_impact=result.get("potential_impact", "Minimal expected impact")
            )

        except Exception as e:
            logger.error(f"Error analyzing position {position.symbol}: {e}")
            return PositionInsight(
                symbol=position.symbol,
                position_weight=weight,
                sentiment="neutral",
                sentiment_score=0.0,
                key_news="Analysis unavailable",
                potential_impact="Unable to assess"
            )

    # ========================================================================
    # HELPER METHODS
    # ========================================================================

    def _format_articles_for_prompt(self, articles: List[Dict]) -> str:
        """Format Finnhub articles for AI prompt with relative time context."""
        formatted = []
        now = datetime.now()
        for i, article in enumerate(articles, 1):
            timestamp = article.get('datetime')
            try:
                published_at = datetime.fromtimestamp(timestamp)
                published_at_str = published_at.strftime('%Y-%m-%dT%H:%M:%SZ')
                delta_days = (now - published_at).days
                time_info = "Today" if delta_days == 0 else f"{delta_days} day(s) ago"
            except Exception:
                published_at_str = "Unknown date"
                time_info = "Unknown date"

            formatted.append(
                f"{i}. [{published_at_str} | {time_info}] {article.get('headline', 'No title')}\n"
                f"   Source: {article.get('source', 'Unknown')}\n"
                f"   {article.get('summary', '')[:300]}"
            )
        return "\n\n".join(formatted)

    def _format_portfolio_context(
        self,
        positions: List[Position],
        insights: List[PositionInsight],
        weights: Dict[str, float]
    ) -> str:
        """Format portfolio context for AI prompt."""
        lines = []
        for pos, insight in zip(positions, insights):
            weight = weights.get(pos.symbol, 0)
            lines.append(
                f"- {pos.symbol}: {weight*100:.1f}% of portfolio | "
                f"Sentiment: {insight.sentiment} | "
                f"News: {insight.key_news}"
            )
        return "\n".join(lines)

    def _calculate_position_weights(
        self,
        positions: List[Position]
    ) -> Dict[str, float]:
        """Calculate position weights by market value."""
        total_value = sum(pos.quantity * pos.avg_price for pos in positions)

        if total_value == 0:
            return {}

        return {
            pos.symbol: (pos.quantity * pos.avg_price) / total_value
            for pos in positions
        }

    def _aggregate_sector_insights(
        self,
        position_insights: List[PositionInsight],
        positions: List[Position]
    ) -> Dict[str, Dict]:
        """
        Aggregate insights by sector.

        Returns:
            Dict mapping sector -> aggregated insights
        """
        insight_map = {
            insight.symbol: insight
            for insight in position_insights
        }

        sector_groups = defaultdict(list)
        for pos in positions:
            sector = self._get_sector(pos.symbol)
            sector_groups[sector].append({
                'position': pos,
                'insight': insight_map.get(pos.symbol)
            })

        sector_insights = {}
        for sector, items in sector_groups.items():
            if sector == 'Unknown':
                continue
            sector_insights[sector] = self._aggregate_single_sector(sector, items)

        return sector_insights

    def _get_ticker_info(self, symbol: str) -> Dict:
        """Fetch and cache yfinance info for a symbol."""
        if symbol not in self._ticker_info_cache:
            try:
                self._ticker_info_cache[symbol] = yf.Ticker(symbol).info
            except Exception as e:
                logger.warning(f"Could not get ticker info for {symbol}: {e}")
                self._ticker_info_cache[symbol] = {}
        return self._ticker_info_cache[symbol]

    def _get_sector(self, symbol: str) -> str:
        """Get sector for a symbol."""
        return self._get_ticker_info(symbol).get('sector', 'Unknown')

    def _get_company_name(self, symbol: str) -> str:
        """Get company name for a symbol, falls back to symbol if unavailable."""
        return self._get_ticker_info(symbol).get('shortName', symbol)

    def _aggregate_single_sector(
        self,
        sector: str,
        items: List[Dict]
    ) -> Dict:
        """
        Aggregate insights for a single sector.

        Args:
            sector: Sector name
            items: List of {position, insight} dicts

        Returns:
            Aggregated sector insights
        """
        positions = [item['position'] for item in items]
        insights = [item['insight'] for item in items if item['insight']]

        if not insights:
            return {
                'position_count': len(positions),
                'total_weight': 0.0,
                'positions': [p.symbol for p in positions],
                'avg_sentiment': 'neutral',
                'avg_sentiment_score': 0.0,
                'key_themes': f'No news analysis available for {sector} positions',
                'sector_risk': 'Unable to assess',
                'opportunities': [],
                'threats': []
            }

        total_weight = sum(insight.position_weight for insight in insights)

        weighted_score = sum(
            insight.sentiment_score * insight.position_weight
            for insight in insights
        )
        avg_sentiment_score = weighted_score / total_weight if total_weight > 0 else 0.0
        avg_sentiment = self._score_to_sentiment(avg_sentiment_score)

        sector_narrative = self._generate_sector_narrative(
            sector,
            positions,
            insights,
            total_weight
        )

        return {
            'position_count': len(positions),
            'total_weight': total_weight,
            'positions': [p.symbol for p in positions],
            'avg_sentiment': avg_sentiment,
            'avg_sentiment_score': round(avg_sentiment_score, 4),
            'key_themes': sector_narrative.get('key_themes', 'No themes identified'),
            'sector_risk': sector_narrative.get('sector_risk', 'Low'),
            'opportunities': sector_narrative.get('opportunities', []),
            'threats': sector_narrative.get('threats', [])
        }

    def _generate_sector_narrative(
        self,
        sector: str,
        positions: List[Position],
        insights: List[PositionInsight],
        sector_weight: float
    ) -> Dict:
        """
        Use AI to generate sector-level insights.

        Args:
            sector: Sector name
            positions: Positions in this sector
            insights: Position insights
            sector_weight: Total sector weight in portfolio

        Returns:
            Dict with key_themes, sector_risk, opportunities, threats
        """
        position_summaries = []
        for pos, insight in zip(positions, insights):
            position_summaries.append(
                f"- {pos.symbol}: {insight.sentiment} | {insight.key_news}"
            )

        context = "\n".join(position_summaries)

        prompt = f"""Analyze the {sector} sector based on these portfolio positions ({sector_weight*100:.1f}% of portfolio):

        {context}

        Provide brief sector-level analysis in JSON:
        {{
            "key_themes": "1-2 sentence summary of sector trends",
            "sector_risk": "high/medium/low with brief explanation",
            "opportunities": ["opportunity1", "opportunity2"],
            "threats": ["threat1", "threat2"]
        }}

        Focus on sector-wide themes, not individual stocks."""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a sector analyst providing concise sector analysis."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=300,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return result

        except Exception as e:
            logger.error(f"Error generating sector narrative: {e}")
            return {
                'key_themes': f'Analysis unavailable for {sector} sector',
                'sector_risk': 'medium',
                'opportunities': [],
                'threats': []
            }

    def _score_to_sentiment(self, score: float) -> str:
        """Convert numeric score to sentiment string."""
        if score > 0.6:
            return 'strongly bullish'
        elif score > 0.2:
            return 'bullish'
        elif score < -0.6:
            return 'strongly bearish'
        elif score < -0.2:
            return 'bearish'
        else:
            return 'neutral'

    def _article_to_schema(
        self,
        article: Dict,
        sentiment: str = "neutral",
        sentiment_score: float = 0.0,
        relevant: bool = True
    ) -> NewsArticle:
        """Convert Finnhub article to schema."""
        timestamp = article.get('datetime')
        try:
            published_at = datetime.fromtimestamp(timestamp).isoformat()
        except Exception:
            published_at = datetime.now().isoformat()

        return NewsArticle(
            title=article.get('headline', 'No title'),
            source=article.get('source', 'Unknown'),
            published_at=published_at,
            url=article.get('url', ''),
            sentiment=sentiment,
            sentiment_score=sentiment_score,
            relevant=relevant,
            summary=article.get('summary', '')
        )

    # ========================================================================
    # FALLBACK RESPONSES
    # ========================================================================

    def _create_empty_stock_insight(self, symbol: str) -> StockNewsInsight:
        """Create empty insight when no news found."""
        return StockNewsInsight(
            symbol=symbol,
            overall_sentiment="neutral",
            sentiment_score=0.0,
            ai_summary=f"No recent news found for {symbol}.",
            key_events=[],
            top_articles=[],
            potential_impact="No news to analyze",
            generated_at=datetime.now()
        )

    def _create_empty_portfolio_insight(self, portfolio_id: int) -> PortfolioInsight:
        """Create empty portfolio insight."""
        return PortfolioInsight(
            portfolio_id=portfolio_id,
            overall_sentiment="neutral",
            sentiment_score=0.0,
            ai_summary="No recent news found for portfolio positions.",
            position_insights=[],
            sector_insights={},
            top_movers_news=[],
            alerts=[],
            generated_at=datetime.now()
        )

    def _fallback_stock_analysis(self) -> Dict:
        """Fallback when AI analysis fails."""
        return {
            "summary": "Unable to generate AI analysis at this time.",
            "overall_sentiment": "neutral",
            "sentiment_score": 0.0,
            "key_events": [],
            "potential_impact": "Analysis unavailable",
            "article_sentiments": {}
        }

    def _fallback_portfolio_analysis(self) -> Dict:
        """Fallback for portfolio analysis."""
        return {
            "summary": "Unable to generate portfolio analysis at this time.",
            "overall_sentiment": "neutral",
            "sentiment_score": 0.0,
            "top_movers": [],
            "alerts": []
        }