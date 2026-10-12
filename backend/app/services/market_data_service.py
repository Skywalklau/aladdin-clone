import pandas as pd
import yfinance as yf
from typing import List, Dict, Tuple
from datetime import datetime, timedelta


class MarketDataService:
    def __init__(self):
        self._cache: Dict[str, Tuple[float, float]] = {}  # symbol -> (current_price, prev_close)
        self._cache_expiry: datetime = datetime.min      # expires every 60 seconds

    def _is_cache_stale(self) -> bool:
        return datetime.now() >= self._cache_expiry

    def get_latest_prices(self, symbols: List[str]) -> Dict[str, float]:
        # Check cache first
        if self._is_cache_stale():
            self._update_cache(symbols)

        # Return prices from cache, only for requested symbols
        return {s: self._cache[s][0] for s in symbols if s in self._cache}

    def get_prev_closes(self, symbols: List[str]) -> Dict[str, float]:
        # Check cache first
        if self._is_cache_stale():
            self._update_cache(symbols)

        # Return prev closes from cache, only for requested symbols
        return {s: self._cache[s][1] for s in symbols if s in self._cache}

    def _update_cache(self, symbols: List[str]):
        if not symbols:
            self._cache = {}
            return

        try:
            # Fetch 2 days so we always have a previous close
            prices = yf.download(
                tickers=symbols,
                period="2d",
                interval="1d",
                group_by="ticker",
                threads=True,
                progress=False
            )
        except Exception as e:
            print(f"Error fetching prices: {e}")
            self._cache = {}
            return

        cache: Dict[str, Tuple[float, float]] = {}
        for symbol in symbols:
            try:
                # yf.download returns a MultiIndex if multiple tickers
                if isinstance(prices.columns, pd.MultiIndex):
                    closes = prices[symbol]["Close"].dropna()
                else:
                    # Single ticker fallback
                    closes = prices["Close"].dropna()

                current_price = float(closes.iloc[-1])
                prev_close    = float(closes.iloc[-2]) if len(closes) >= 2 else current_price

                cache[symbol] = (current_price, prev_close)
            except Exception:
                print(f"No price for {symbol}, skipping.")
                continue

        self._cache = cache
        # Cache expires in 60 seconds
        self._cache_expiry = datetime.now() + timedelta(seconds=60)
        print(f"[MarketDataService] Cache updated at {datetime.now().strftime('%H:%M:%S')}, expires in 60s")