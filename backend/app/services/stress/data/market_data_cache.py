"""
Market data caching service.

Handles:
- Sector and beta caching
- Single yfinance API call for both
- Cache management
"""

from typing import Dict, Tuple
import logging
import yfinance as yf

logger = logging.getLogger(__name__)


class MarketDataCache:
    """
    Caching layer for market data from yfinance.
    
    Reduces API calls by:
    - Caching sector and beta together
    - Single API call per symbol
    - In-memory cache with simple dict
    
    Note: For production, consider:
    - Redis or database-backed cache
    - TTL/expiration policies
    - Pre-fetching on startup
    """
    
    def __init__(self):
        """Initialize empty caches."""
        self._sector_cache: Dict[str, str] = {}
        self._beta_cache: Dict[str, float] = {}
    
    def get_sector_and_beta(self, symbol: str) -> Tuple[str, float]:
        """
        Get both sector and beta for a symbol with single yfinance call.
        
        This is the main entry point - always use this instead of
        separate get_sector() and get_beta() calls to avoid duplicate API calls.
        
        Args:
            symbol: Stock ticker
            
        Returns:
            Tuple of (sector, beta)
        """
        # Check if both are already cached
        if symbol in self._sector_cache and symbol in self._beta_cache:
            return self._sector_cache[symbol], self._beta_cache[symbol]
        
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # Extract sector
            sector = info.get('sector', 'Unknown')
            self._sector_cache[symbol] = sector
            
            # Extract and validate beta
            beta = info.get('beta', 1.0)
            if beta is None or not isinstance(beta, (int, float)):
                beta = 1.0
            # Cap extreme betas
            beta = max(-2.0, min(3.0, beta))
            self._beta_cache[symbol] = beta
            
            return sector, beta
            
        except Exception as e:
            logger.warning(f"Could not get info for {symbol}: {e}")
            self._sector_cache[symbol] = 'Unknown'
            self._beta_cache[symbol] = 1.0
            return 'Unknown', 1.0
    
    def get_sector(self, symbol: str) -> str:
        """
        Get sector for a symbol with caching.
        
        Note: This uses get_sector_and_beta internally to avoid
        redundant yfinance API calls.
        
        Args:
            symbol: Stock ticker
            
        Returns:
            Sector name from yfinance
        """
        sector, _ = self.get_sector_and_beta(symbol)
        return sector
    
    def get_beta(self, symbol: str) -> float:
        """
        Get beta for a symbol with caching.
        
        Note: This uses get_sector_and_beta internally to avoid
        redundant yfinance API calls.
        
        Args:
            symbol: Stock ticker
            
        Returns:
            Beta value (default 1.0 if unavailable)
        """
        _, beta = self.get_sector_and_beta(symbol)
        return beta
    
    def clear_cache(self):
        """Clear all cached data."""
        self._sector_cache.clear()
        self._beta_cache.clear()
    
    def get_cache_stats(self) -> Dict[str, int]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache sizes
        """
        return {
            'sector_cache_size': len(self._sector_cache),
            'beta_cache_size': len(self._beta_cache)
        }