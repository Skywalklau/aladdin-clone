from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class PortfolioPosition(BaseModel):
    symbol: str
    quantity: float
    avg_price: float

    class Config: 
        from_attributes = True


class PortfolioResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    # It tells Pydantic:
    # "This object is an ORM model. Read values from attributes instead of expecting a dict."
    # so instead of portfolio["name"], it uses portfolio.name
    # so we can straightaway just do return db.query(Portfolio).all()
    class Config:
        from_attributes = True


class PortfolioPositionWithMarketData(PortfolioPosition):
    current_price:  float
    prev_close:     float
    market_value:   float
    pnl:            float
    allocation_pct: float
    daily_pnl:      float
    daily_pnl_pct:  float

    class Config: 
        from_attributes = True


class PortfolioSummary(BaseModel):
    total_value:     float
    total_pnl:       float
    total_daily_pnl: float
    positions:       List[PortfolioPositionWithMarketData]

    class Config: 
        from_attributes = True