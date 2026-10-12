import csv
from typing import List
from app.schemas.portfolio import PortfolioPosition


def load_positions(path: str) -> List[PortfolioPosition]:
    positions = []

    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            positions.append(
                PortfolioPosition(
                    symbol=row["symbol"],
                    quantity=float(row["quantity"]),
                    avg_price=float(row["avg_price"]),
                )
            )

    return positions
