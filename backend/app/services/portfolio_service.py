from typing import List
from app.schemas.portfolio import (
    PortfolioPositionWithMarketData,
    PortfolioSummary,
)
from app.models.portfolio import Position
from app.services.market_data_service import MarketDataService


class PortfolioService:
    def __init__(self, market_data_service: MarketDataService):
        self.market_data_service = market_data_service

    def analyze(self, positions: List[Position]) -> PortfolioSummary:
        symbols     = [p.symbol for p in positions]
        prices      = self.market_data_service.get_latest_prices(symbols)
        prev_closes = self.market_data_service.get_prev_closes(symbols)

        # First pass: accumulate totals and stage data
        staged          = []
        total_value     = 0.0
        total_pnl       = 0.0
        total_daily_pnl = 0.0

        for p in positions:
            price      = prices.get(p.symbol)
            prev_close = prev_closes.get(p.symbol, price)
            if price is None:
                continue

            market_value  = price * p.quantity
            pnl           = (price - p.avg_price) * p.quantity
            daily_pnl     = (price - prev_close) * p.quantity
            daily_pnl_pct = ((price - prev_close) / prev_close) if prev_close else 0.0

            total_value     += market_value
            total_pnl       += pnl
            total_daily_pnl += daily_pnl

            staged.append((p, price, prev_close, market_value, pnl, daily_pnl, daily_pnl_pct))

        if total_value == 0:
            raise ValueError("Total portfolio market value is zero. Cannot compute allocations.")

        # Second pass: build enriched positions now that total_value is known
        enriched_positions = [
            PortfolioPositionWithMarketData(
                symbol=p.symbol,
                quantity=p.quantity,
                avg_price=p.avg_price,
                current_price=price,
                prev_close=prev_close,
                market_value=market_value,
                pnl=pnl,
                allocation_pct=(market_value / total_value) * 100,
                daily_pnl=daily_pnl,
                daily_pnl_pct=daily_pnl_pct,
            )
            for p, price, prev_close, market_value, pnl, daily_pnl, daily_pnl_pct in staged
        ]

        return PortfolioSummary(
            total_value=round(total_value, 2),
            total_pnl=round(total_pnl, 2),
            total_daily_pnl=round(total_daily_pnl, 2),
            positions=enriched_positions,
        )