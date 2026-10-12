import csv
import logging
from io import StringIO
from sqlalchemy.orm import Session
from app.models.portfolio import Portfolio, Position

logger = logging.getLogger(__name__)


def create_portfolio_from_csv(db: Session, file_content: bytes, portfolio_name: str = "Uploaded Portfolio", user_id: int = None) -> dict:
    content = file_content.decode("utf-8")
    reader = csv.DictReader(StringIO(content))

    positions_data = []
    for i, row in enumerate(reader, start=2):  # start=2 accounts for the header row
        try:
            positions_data.append({
                "symbol": row["symbol"],
                "quantity": float(row["quantity"]),
                "avg_price": float(row["avg_price"]),
            })
        except KeyError as e:
            logger.warning(f"Row {i} is missing expected column: {e}. Skipping.")
        except ValueError as e:
            logger.warning(f"Row {i} has an invalid value: {e}. Skipping.")

    if not positions_data:
        raise ValueError("No valid rows found in CSV.")

    portfolio = Portfolio(name=portfolio_name, user_id=user_id)
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)

    for pos in positions_data:
        db.add(Position(
            symbol=pos["symbol"],
            quantity=pos["quantity"],
            avg_price=pos["avg_price"],
            portfolio_id=portfolio.id,
        ))
    db.commit()

    return {"portfolio_id": portfolio.id, "positions_added": len(positions_data)}