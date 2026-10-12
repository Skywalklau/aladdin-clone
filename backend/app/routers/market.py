from fastapi import APIRouter
import yfinance as yf

router = APIRouter(prefix="/market", tags=["market"])

TICKERS = ["AAPL", "MSFT", "BLK", "^GSPC", "^VIX", "^TNX"]
LABELS  = ["AAPL", "MSFT", "BLK", "SPX", "VIX", "TNX"]

@router.get("/tickers")
def get_tickers():
    results = []
    for symbol, label in zip(TICKERS, LABELS):
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period="2d")
        if len(hist) < 2:
            continue
        prev  = hist["Close"].iloc[-2]
        curr  = hist["Close"].iloc[-1]
        chg   = (curr - prev) / prev * 100
        results.append({
            "sym": label,
            "val": f"{curr:,.3f}" if label == "TNX" else f"{curr:,.2f}",
            "chg": f"{chg:+.2f}%",
            "pos": bool(chg >= 0),
        })
    return results