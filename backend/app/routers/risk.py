from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.portfolio import Position, Portfolio, User
from app.services.portfolio_service import PortfolioService
from app.services.risk_service import RiskService
from app.schemas.risk import PortfolioRiskSummary
from app.dependencies.auth import get_current_user
from app.dependencies.dependencies import get_portfolio_service

router = APIRouter(prefix="/risk", tags=["risk"])


def get_risk_service():
    return RiskService()


@router.get("/portfolio", response_model=PortfolioRiskSummary)
def get_portfolio_risk(
    portfolio_id: int = Query(..., description="ID of the portfolio to analyze"),
    confidence_level: float = Query(0.95, ge=0.01, le=0.99, description="VaR confidence level (0.95 = 95%)"),
    risk_free_rate: float = Query(0.04, ge=0.0, le=1.0, description="Annual risk-free rate for Sharpe ratio"),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    risk_service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(get_current_user)
):
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()

    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found.")

    positions = db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
    if not positions:
        raise HTTPException(status_code=404, detail="No positions found for this portfolio.")

    try:
        portfolio_summary = portfolio_service.analyze(positions)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not portfolio_summary.positions:
        raise HTTPException(status_code=404, detail="No valid positions with market data.")

    return risk_service.analyze_portfolio_risk(
        portfolio_summary.positions,
        total_value=portfolio_summary.total_value,
        total_pnl=portfolio_summary.total_pnl,
        confidence_level=confidence_level,
        risk_free_rate=risk_free_rate,
    )