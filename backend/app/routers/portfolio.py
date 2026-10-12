from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.utils.csv_to_db import create_portfolio_from_csv
from app.db.database import get_db
from app.services.portfolio_service import PortfolioService
from app.schemas.portfolio import PortfolioSummary, PortfolioResponse
from app.models.portfolio import Position, Portfolio, User
from app.dependencies.auth import get_current_user
from app.dependencies.dependencies import get_portfolio_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("/upload")
def upload_portfolio_csv(
    file: UploadFile = File(...),
    portfolio_name: str = "Uploaded Portfolio",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV.")

    try:
        result = create_portfolio_from_csv(db, file.file.read(), portfolio_name, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "success", **result}


@router.get("/", response_model=list[PortfolioResponse])
def list_portfolios(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Portfolio).filter(Portfolio.user_id == current_user.id).all()


@router.get("/{portfolio_id}", response_model=PortfolioSummary)
def get_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
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
        enriched = portfolio_service.analyze(positions)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return enriched


@router.delete("/{portfolio_id}")
def delete_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id
    ).first()

    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    name = portfolio.name
    db.delete(portfolio)
    db.commit()

    return {
        "message": f"Portfolio '{name}' deleted successfully",
        "portfolio_id": portfolio_id,
        "portfolio_name": name
    }