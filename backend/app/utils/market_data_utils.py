"""
Shared utilities for downloading and processing market data.

Used by both RiskService and StressService to avoid code duplication
and maintain consistent data handling across the application.
"""

import pandas as pd
import yfinance as yf
import numpy as np
from typing import List, Dict, Tuple
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class MarketDataUtils:
    """
    Utilities for downloading and processing historical market data.
    
    This class encapsulates common operations needed by both risk analysis
    and stress testing services, including:
    - Downloading historical price data from yfinance
    - Calculating daily returns
    - Caching results to avoid redundant API calls
    
    Attributes:
        lookback_days: Number of trading days for historical analysis (~252 = 1 year)
    """
    
    def __init__(self, lookback_days: int = 252):
        """
        Initialize the market data utilities.
        
        Args:
            lookback_days: Number of trading days to download (default: 252 = 1 year)
        """
        self.lookback_days = lookback_days
        self._cache: Dict[tuple, Tuple[pd.DataFrame, datetime]] = {}
    
    def download_price_data(self, symbols: List[str]) -> pd.DataFrame:
        """
        Download historical price data for given symbols with caching.
        
        Args:
            symbols: List of ticker symbols
            
        Returns:
            DataFrame with symbols as columns and dates as index
        """
        if not symbols:
            return pd.DataFrame()

        # Check cache first
        cache_key = tuple(sorted(symbols))
        if cache_key in self._cache:
            cached_data, cached_time = self._cache[cache_key]
            # Use cache if less than 1 hour old
            if datetime.now() - cached_time < timedelta(hours=1):
                return cached_data

        try:
            data = yf.download(
                tickers=symbols,
                period=f"{self.lookback_days}d",
                interval="1d",
                group_by="ticker",
                threads=True,
                progress=False,
                auto_adjust=True  # Use adjusted close prices
            )

            if data.empty:
                logger.warning(f"No data downloaded for symbols: {symbols}")
                return pd.DataFrame()

            # Extract close prices
            price_df = pd.DataFrame()
            
            if len(symbols) == 1:
                # Single ticker case
                symbol = symbols[0]
                if "Close" in data.columns:
                    price_df[symbol] = data["Close"]
                else:
                    logger.warning(f"No Close data for {symbol}")
            else:
                # Multiple tickers case
                for symbol in symbols:
                    try:
                        if isinstance(data.columns, pd.MultiIndex):
                            if (symbol, "Close") in data.columns:
                                price_df[symbol] = data[(symbol, "Close")]
                            elif symbol in data.columns.get_level_values(0):
                                price_df[symbol] = data[symbol]["Close"]
                        else:
                            price_df[symbol] = data["Close"]
                    except (KeyError, TypeError) as e:
                        logger.warning(f"Could not extract data for {symbol}: {e}")
                        continue

            # Remove columns with all NaN values
            price_df = price_df.dropna(axis=1, how="all")
            
            # Forward fill missing values (up to 5 days), then drop rows where ALL values are NaN
            price_df = price_df.ffill(limit=5).dropna(how="all")

            # Cache the result
            self._cache[cache_key] = (price_df, datetime.now())
            
            return price_df

        except Exception as e:
            logger.error(f"Error downloading price data for {symbols}: {e}")
            import traceback
            traceback.print_exc()
            return pd.DataFrame()
    
    def calculate_returns(self, price_df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate daily percentage returns from price data.
        
        Args:
            price_df: DataFrame of historical prices
            
        Returns:
            DataFrame of daily percentage returns
        """
        if price_df.empty:
            return pd.DataFrame()
        
        returns = price_df.pct_change().dropna()
        
        # Remove any infinite values - but keep rows with some valid data
        returns = returns.replace([np.inf, -np.inf], np.nan).dropna(how='all')
        
        return returns
    
    def clear_cache(self):
        """Clear the price data cache."""
        self._cache.clear()
    
    def get_cache_info(self) -> Dict:
        """
        Get information about cached data.
        
        Returns:
            Dictionary with cache statistics
        """
        return {
            "cached_entries": len(self._cache),
            "total_symbols": sum(len(key) for key in self._cache.keys())
        }
    
    def get_market_caps(self, symbols: List[str]) -> Dict[str, float]:
        """
        Get market capitalizations for symbols with caching.
        
        Market caps are cached for 7 days since they change slowly.
        Failed fetches return None (caller must handle fallback).
        
        Args:
            symbols: List of ticker symbols
            
        Returns:
            Dictionary mapping symbols to market caps (in USD)
            Symbols with failed fetches will have None value
        """
        if not symbols:
            return {}
        
        # Check cache (7 day TTL for market caps)
        cache_key = ('market_caps', tuple(sorted(symbols)))
        if cache_key in self._cache:
            cached_data, cached_time = self._cache[cache_key]
            # Use cache if less than 7 days old
            if datetime.now() - cached_time < timedelta(days=7):
                return cached_data
        
        market_caps = {}
        
        # Batch fetch using yfinance (more efficient than individual calls)
        try:
            # yfinance can download multiple tickers at once
            tickers = yf.Tickers(' '.join(symbols))
            
            for symbol in symbols:
                try:
                    ticker = tickers.tickers[symbol]
                    info = ticker.info
                    market_cap = info.get('marketCap', None)
                    
                    # Validate market cap
                    if market_cap is not None and isinstance(market_cap, (int, float)) and market_cap > 0:
                        market_caps[symbol] = float(market_cap)
                    else:
                        logger.warning(f"Invalid or missing market cap for {symbol}")
                        market_caps[symbol] = None
                        
                except Exception as e:
                    logger.warning(f"Could not get market cap for {symbol}: {e}")
                    market_caps[symbol] = None
        
        except Exception as e:
            logger.error(f"Error fetching market caps in batch: {e}")
            # Fallback to individual fetches
            for symbol in symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    market_cap = info.get('marketCap', None)
                    
                    if market_cap is not None and isinstance(market_cap, (int, float)) and market_cap > 0:
                        market_caps[symbol] = float(market_cap)
                    else:
                        market_caps[symbol] = None
                        
                except Exception as e:
                    logger.warning(f"Could not get market cap for {symbol}: {e}")
                    market_caps[symbol] = None
        
        # Cache the result
        self._cache[cache_key] = (market_caps, datetime.now())
        
        return market_caps