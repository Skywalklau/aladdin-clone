"""
Shared application dependencies.

Single instances of services that need to persist state (e.g. caches)
are defined here and imported wherever needed, rather than being
recreated on every request.
"""

from app.services.market_data_service import MarketDataService
from app.services.portfolio_service import PortfolioService
from app.services.risk_service import RiskService
from app.services.stress.stress_service import StressService
from app.utils.market_data_utils import MarketDataUtils


# ── Singletons ────────────────────────────────────────────────────────────────
# These are created once at startup and shared across all routers/requests.
# This ensures in-memory caches persist between requests rather than being
# thrown away each time.

market_data_service = MarketDataService()
market_data_utils   = MarketDataUtils()

# Pass the shared utils instance so both services share the same 1-hour cache
risk_service   = RiskService(data_utils=market_data_utils)
stress_service = StressService(data_utils=market_data_utils)


# ── Dependency functions ──────────────────────────────────────────────────────
# Use these with FastAPI's Depends() in your routers.

def get_market_data_service() -> MarketDataService:
    return market_data_service

def get_portfolio_service() -> PortfolioService:
    return PortfolioService(market_data_service)

def get_risk_service() -> RiskService:
    return risk_service

def get_stress_service() -> StressService:
    return stress_service