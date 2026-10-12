import pandas as pd
import yfinance as yf
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from app.schemas.portfolio import PortfolioPositionWithMarketData
from app.schemas.risk import PortfolioRiskSummary
from app.utils.market_data_utils import MarketDataUtils


class RiskService:
    def __init__(self, data_utils: MarketDataUtils = None, lookback_days: int = 252, benchmark: str = "^GSPC"):
        """
        Initialize the risk service.
        
        Args:
            lookback_days: Number of trading days for historical analysis (~252 = 1 year)
            benchmark: Ticker symbol for benchmark comparison (default: S&P 500)
        """
         
        self.lookback_days = lookback_days
        self.benchmark = benchmark
        self._data_utils = data_utils or MarketDataUtils(lookback_days)

    def _download_price_data(self, symbols: List[str]) -> pd.DataFrame:
        """
        Download historical price data for given symbols.
        
        Args:
            symbols: List of ticker symbols
            
        Returns:
            DataFrame with symbols as columns and dates as index
        """
        # Delegate to shared utilities
        return self._data_utils.download_price_data(symbols)

    def _calculate_returns(self, price_df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate daily returns from price data.
        
        Args:
            price_df: DataFrame of historical prices
            
        Returns:
            DataFrame of daily percentage returns of each stock
        """
        # Delegate to shared utilities
        return self._data_utils.calculate_returns(price_df)

    def _get_portfolio_weights(self, positions: List[PortfolioPositionWithMarketData]) -> np.ndarray:
        """
        Calculate portfolio weights based on market values.
        
        Args:
            positions: List of portfolio positions
            
        Returns:
            Array of weights (summing to 1.0)
        """
        if not positions:
            return np.array([])
        
        market_values = np.array([p.market_value for p in positions], dtype=float)
        total_value = market_values.sum()
        
        if total_value <= 0:
            # Equal weight if no valid market values
            return np.ones(len(positions)) / len(positions)
        
        return market_values / total_value

    def _calculate_portfolio_returns(
        self,
        returns_df: pd.DataFrame,
        positions: List[PortfolioPositionWithMarketData]
    ) -> pd.Series:
        """
        Calculate weighted portfolio returns.
        
        Args:
            returns_df: DataFrame of asset returns
            positions: List of portfolio positions
            
        Returns:
            Series of portfolio returns (2 columns : date, portfolio return)
        """
        symbols = [p.symbol for p in positions]
        weights = self._get_portfolio_weights(positions)
        
        # Filter returns to only include symbols we have
        available_symbols = [s for s in symbols if s in returns_df.columns]
        missing_symbols = [s for s in symbols if s not in returns_df.columns]
        
        if missing_symbols:
            print(f"Warning: No return data for symbols: {missing_symbols}")
        
        if not available_symbols:
            return pd.Series(dtype=float)
        
        # Adjust weights for missing symbols
        available_indices = [i for i, s in enumerate(symbols) if s in available_symbols]
        adjusted_weights = weights[available_indices]
        
        # Renormalize weights (protect against division by zero)
        weights_sum = adjusted_weights.sum()
        if weights_sum > 0:
            adjusted_weights = adjusted_weights / weights_sum
        elif len(adjusted_weights) > 0:
            # Equal weight fallback
            adjusted_weights = np.ones(len(adjusted_weights)) / len(adjusted_weights)
        else:
            # No weights available - return empty series
            return pd.Series(dtype=float)
        
        portfolio_returns = returns_df[available_symbols].dot(adjusted_weights)
        return portfolio_returns

    def calculate_volatility(
        self,
        positions: List[PortfolioPositionWithMarketData],
        returns_df: pd.DataFrame
    ) -> float:
        """
        Calculate annualized portfolio volatility.
        
        Args:
            positions: List of portfolio positions
            returns_df: DataFrame of historical returns
            
        Returns:
            Annualized volatility (standard deviation)
        """
        # Volatility measures how much your portfolio's value fluctuates from EXPECTED return
        # Example:
        # Daily portfolio returns (decimal) over 5 days: [0.002, 0.001, -0.003, 0.004, 0.002]
        # Mean daily return = (0.002 + 0.001 - 0.003 + 0.004 + 0.002)/5 = 0.0012
        # Annualized expected return = 0.0012 * 252 ≈ 0.302 => 30.2% expected return per year
        
        if returns_df.empty or not positions:
            return 0.0

        symbols = [p.symbol for p in positions]
        available_symbols = [s for s in symbols if s in returns_df.columns]
        
        if not available_symbols:
            return 0.0

        weights = self._get_portfolio_weights(positions)
        
        # Adjust for missing symbols
        available_indices = [i for i, s in enumerate(symbols) if s in available_symbols]
        adjusted_weights = weights[available_indices]
        
        # Renormalize weights (protect against division by zero)
        weights_sum = adjusted_weights.sum()
        if weights_sum > 0:
            adjusted_weights = adjusted_weights / weights_sum
        elif len(adjusted_weights) > 0:
            # Equal weight fallback
            adjusted_weights = np.ones(len(adjusted_weights)) / len(adjusted_weights)
        else:
            # No weights available
            return 0.0

        # Calculate portfolio variance using covariance matrix
        # Positive covariance => two stocks tend to move in the same direction
        # Negative covariance => they tend to move opposite directions
        # Zero covariance => independent movements
        cov_matrix = returns_df[available_symbols].cov()

        # Var formula (matrix multiplication):
        # σ^2 ​= w^T * Σ * w
        # where w = adjusted_weights vector, T = transpose, Σ = cov matrix
        portfolio_variance = adjusted_weights @ cov_matrix.values @ adjusted_weights
        
        # Ensure variance is non-negative (handle numerical errors)
        portfolio_variance = max(0.0, portfolio_variance)
        
        # Annualize volatility (sqrt(252) for daily to annual)
        # Assuming independent variables
        # Var(X1 + X2 + X3 + ... + X252) = Var(X1) + Var(X2) + Var(X3) + ... + Var(X252) = 252 * Var(Xdaily)
        # volatility is STD, so sqrt.
        annualized_volatility = np.sqrt(portfolio_variance * 252)
        
        return float(annualized_volatility)

    def calculate_beta(
        self,
        positions: List[PortfolioPositionWithMarketData],
        returns_df: pd.DataFrame
    ) -> float:
        """
        Calculate portfolio beta relative to benchmark.
        
        Args:
            positions: List of portfolio positions
            returns_df: DataFrame of historical returns
            
        Returns:
            Portfolio beta (1.0 = market average risk)
        """
        if returns_df.empty or not positions:
            return 1.0  # Default to market beta if no data

        # Get portfolio returns
        portfolio_returns = self._calculate_portfolio_returns(returns_df, positions)
        
        if portfolio_returns.empty or len(portfolio_returns) < 10:
            print("Warning: Insufficient portfolio return data for beta calculation")
            return 1.0  # Default to market beta

        # Download benchmark data
        try:
            benchmark_data = yf.download(
                tickers=self.benchmark,
                period=f"{self.lookback_days}d",
                interval="1d",
                progress=False,
                auto_adjust=True  # ensures returns are adjusted for dividends/splits, matching portfolio returns.
            )

            if benchmark_data.empty:
                print(f"Warning: No benchmark data available for {self.benchmark}")
                return 1.0  # Default to market beta

            # Extract close prices - handle yfinance's different return structures
            benchmark_prices = None
            
            if isinstance(benchmark_data.columns, pd.MultiIndex):
                # MultiIndex case - columns are like ('^GSPC', 'Close')
                # Try to find the Close price column
                for col in benchmark_data.columns:
                    if col[1] == 'Close' or col[1] == 'Adj Close': # expect Close since we did auto_adjust=true
                        benchmark_prices = benchmark_data[col]
                        break
                
                # If that didn't work, just take first column
                if benchmark_prices is None:
                    benchmark_prices = benchmark_data.iloc[:, 0]
            else:
                # Regular columns - try Close, then Adj Close, then first column
                if 'Close' in benchmark_data.columns:
                    benchmark_prices = benchmark_data['Close']
                elif 'Adj Close' in benchmark_data.columns:
                    benchmark_prices = benchmark_data['Adj Close']
                else:
                    benchmark_prices = benchmark_data.iloc[:, 0]
                
            # Ensure we have a Series, not a DataFrame
            if isinstance(benchmark_prices, pd.DataFrame):
                benchmark_prices = benchmark_prices.squeeze()
                
            if benchmark_prices is None or benchmark_prices.empty:
                print(f"Warning: No benchmark price data extracted")
                return 1.0

            # Calculate benchmark returns
            benchmark_returns = benchmark_prices.pct_change().dropna()
            benchmark_returns = benchmark_returns.replace([np.inf, -np.inf], np.nan).dropna()

            # Align the two series
            # Only keep dates present in both series
            # Ensures the covariance calculation uses exactly matching dates
            aligned_portfolio, aligned_benchmark = portfolio_returns.align(
                benchmark_returns, join="inner"
            )

            if len(aligned_portfolio) < 10:
                print("Warning: Insufficient overlapping data for beta calculation")
                return 1.0

            # Calculate beta: Cov(portfolio, benchmark) / Var(benchmark)
            # Stack the series to create a 2xN array for np.cov
            combined = np.vstack([aligned_portfolio.values, aligned_benchmark.values])
            cov_matrix = np.cov(combined) # now cov_matrix becomes 2x2
            covariance = cov_matrix[0, 1]
            benchmark_variance = cov_matrix[1, 1]

            if benchmark_variance == 0:
                print(f"Warning: Benchmark {self.benchmark} has zero variance, defaulting to beta=1.0")
                return 1.0

            beta = covariance / benchmark_variance
            return float(beta)

        except Exception as e:
            print(f"Error calculating beta for {self.benchmark}: {e}")
            import traceback
            traceback.print_exc()
            return 1.0

    def calculate_sharpe_ratio(
        self,
        positions: List[PortfolioPositionWithMarketData],
        returns_df: pd.DataFrame,
        risk_free_rate: float = 0.04
    ) -> float:
        """
        Calculate annualized Sharpe ratio.
        
        Args:
            positions: List of portfolio positions
            returns_df: DataFrame of historical returns
            risk_free_rate: Annual risk-free rate (default: 4%)
            
        Returns:
            Sharpe ratio (excess return per unit of risk)
        """
        # Sharpe ratio measures how much return you're getting for the risk you're taking.
        # Sharpe Ratio = (Rp​−Rf)/​σp
        # Rp = portfolio expected annual return
        # Rf = risk-free rate (like US Treasury rate, default here = 4%)
        # σp = portfolio annual volatility (standard deviation of returns)
        # Sharpe = 1 => decent, Sharpe = 2 => very good, Sharpe = 0.5 => low risk-adjusted return
        # The risk-free rate is the theoretical return of an investment with zero risk
        # We only care about excess return: how much more the portfolio earns above a safe investment.
        # Hence we subtract risk free rate
        portfolio_returns = self._calculate_portfolio_returns(returns_df, positions)
        
        if portfolio_returns.empty or len(portfolio_returns) < 2:
            return 0.0

        # Calculate annualized return
        # annualized_return = expected return over 1 year (in terms of percentage)
        mean_daily_return = portfolio_returns.mean()
        annualized_return = mean_daily_return * 252

        # Calculate volatility
        volatility = self.calculate_volatility(positions, returns_df)

        if volatility == 0:
            return 0.0

        # Sharpe ratio
        sharpe = (annualized_return - risk_free_rate) / volatility
        return float(sharpe)

    def calculate_var(
        self,
        positions: List[PortfolioPositionWithMarketData],
        returns_df: pd.DataFrame,
        confidence_level: float = 0.95,
        method: str = "historical",
        time_horizon: int = 1
    ) -> float:
        """
        Calculate Value at Risk (VaR) using historical or parametric method.
        
        Args:
            positions: List of portfolio positions
            returns_df: DataFrame of historical returns
            confidence_level: Confidence level (default: 95%)
            method: "historical" or "parametric" (default: "historical")
            time_horizon: Number of days to scale VaR (default: 1 day)
            
        Returns:
            VaR as a positive number (potential loss)
        """
        # VaR (Value at Risk) is a risk metric that answers this question:
        # “How much money could I lose in the worst-case scenario over the next N days, with X% confidence?”
        # So if you compute:
        # 95% 1-day VaR = $500
        # It means:
        # ✅ “Based on historical behavior, there is a 95% chance I will NOT lose more than $500 tomorrow.”
        # So VaR is basically a worst-loss estimate, but not the absolute worst.
        # It’s the worst loss within a confidence level.
        # Ideally, Historical for T<=10, but T>10 parametric would be better because historical
        # becomes "noisy" because our window becomes bigger, meaning less samples to work with.

        # Validate inputs
        if not 0 < confidence_level < 1:
            raise ValueError(f"confidence_level must be between 0 and 1, got {confidence_level}")
        
        if time_horizon < 1:
            raise ValueError(f"time_horizon must be at least 1, got {time_horizon}")
        
        portfolio_returns = self._calculate_portfolio_returns(returns_df, positions)
        
        if portfolio_returns.empty:
            return 0.0
        
        total_value = sum(p.market_value for p in positions)
        
        if method == "historical":
            # Historical simulation method
            if time_horizon == 1:
                # Standard 1-day VaR
                var_percentile = (1 - confidence_level) * 100
                # take the return that is worse than 95% of the returns.
                var_return = np.percentile(portfolio_returns, var_percentile)
            else:
                # Multi-day VaR: use rolling T-day compound returns for accuracy
                # Compound: (1+r1)(1+r2)...(1+rT) - 1
                # More accurate than simple sum for longer horizons
                rolling_returns = (1 + portfolio_returns).rolling(window=time_horizon).apply(lambda x: x.prod() - 1, raw=True)
                rolling_returns = rolling_returns.dropna()
                
                if rolling_returns.empty or len(rolling_returns) < 10:
                    print(f"Warning: Insufficient data for {time_horizon}-day VaR, using scaling approximation")
                    var_percentile = (1 - confidence_level) * 100
                    var_return = np.percentile(portfolio_returns, var_percentile) * np.sqrt(time_horizon)
                else:
                    var_percentile = (1 - confidence_level) * 100
                    var_return = np.percentile(rolling_returns, var_percentile)
            
            # Convert to dollar amount (as positive number representing potential loss)
            # Use max(0, ...) to handle rare case where worst returns are still positive
            var_amount = max(0, -var_return * total_value)
            
            return float(var_amount)
            
        elif method == "parametric": # This assumes portfolio returns follow a normal distribution
            # Parametric (variance-covariance) method
            # Assumes returns are normally distributed
            mean_return = portfolio_returns.mean()
            std_return = portfolio_returns.std()
            
            # Z-score for the confidence level
            from scipy import stats
            z_score = stats.norm.ppf(1 - confidence_level) # will be negative (because its losses)
            
            # Scale by time horizon (square root of time rule)
            if time_horizon > 1:
                # Daily returns are assumed independent (roughly true for short horizons).
                # Hence:
                # Var(R1 + R2 + R3 + ... + RT) = T * Var(Rdaily)
                # => STD(R1 + R2 + R3 + ... + RT) = sqrt(T) * STD(Rdaily)
                # E(R1 + R2 + R3 + ... + RT) = T * E(Rdaily)
                mean_scaled = mean_return * time_horizon
                std_scaled = std_return * np.sqrt(time_horizon)
            else:
                mean_scaled = mean_return
                std_scaled = std_return
            
            # VaR(percentage) = mean + z_score * std
            # z_score is negative for left tail, so this becomes:
            # VaR(actual amount) = (mean + z_score * std) * portfolio_value
            var_return = mean_scaled + z_score * std_scaled
            
            # Convert to dollar amount
            var_amount = max(0, -var_return * total_value)
            
            return float(var_amount)
            
        else:
            raise ValueError(f"Invalid VaR method: {method}. Use 'historical' or 'parametric'")

    def calculate_var_comparison(
        self,
        positions: List[PortfolioPositionWithMarketData],
        returns_df: pd.DataFrame,
        confidence_level: float = 0.95
    ) -> dict:
        """
        Calculate VaR using both historical and parametric methods for comparison.
        
        Args:
            positions: List of portfolio positions
            returns_df: DataFrame of historical returns
            confidence_level: Confidence level (default: 95%)
            
        Returns:
            Dictionary with both VaR values
        """
        historical_var = self.calculate_var(positions, returns_df, confidence_level, method="historical")
        parametric_var = self.calculate_var(positions, returns_df, confidence_level, method="parametric")
        
        return {
            "historical_var": historical_var,
            "parametric_var": parametric_var,
            "confidence_level": confidence_level
        }

    def calculate_correlation_matrix(self, returns_df: pd.DataFrame) -> dict:
        """
        Calculate correlation matrix between all assets.
        
        Args:
            returns_df: DataFrame of historical returns
            
        Returns:
            Nested dictionary of correlations
        """
        # corr tells you how strongly each asset’s returns move together
        # Portfolio diversification analysis
        # Diagonal is always 1 (an asset is perfectly correlated with itself).
        # Other values range from -1 to 1:
        # 1 = perfectly correlated (move together)
        # 0 = no correlation
        # -1 = perfectly inversely correlated (move opposite)
        if returns_df.empty:
            return {}

        corr_matrix = returns_df.corr()
        
        # Round to 4 decimal places and convert to dict
        return corr_matrix.round(4).to_dict()

    def analyze_portfolio_risk(
        self,
        positions: List[PortfolioPositionWithMarketData],
        total_value: Optional[float] = None,
        total_pnl: Optional[float] = None,
        confidence_level: float = 0.95,
        risk_free_rate: float = 0.04
    ) -> PortfolioRiskSummary:
        """
        Perform comprehensive portfolio risk analysis.
        
        Args:
            positions: List of portfolio positions with market data
            total_value: Pre-calculated total portfolio value (if None, will calculate)
            total_pnl: Pre-calculated total P&L (if None, will calculate)
            confidence_level: Confidence level for VaR calculation (default: 95%)
            risk_free_rate: Annual risk-free rate for Sharpe ratio (default: 4%)
            
        Returns:
            PortfolioRiskSummary with all risk metrics
        """
        if not positions:
            raise ValueError("No positions provided for risk analysis")

        # Extract symbols and download price data
        symbols = list(set([p.symbol for p in positions]))
        price_df = self._download_price_data(symbols)

        if price_df.empty:
            raise ValueError(
                "No historical price data available. "
                "Check that symbols are valid and have sufficient history."
            )

        # Calculate returns
        returns_df = self._calculate_returns(price_df)

        if returns_df.empty:
            raise ValueError("Insufficient data to calculate returns")

        # Calculate all risk metrics
        volatility = self.calculate_volatility(positions, returns_df)
        beta = self.calculate_beta(positions, returns_df)
        correlations = self.calculate_correlation_matrix(returns_df)
        
        # Calculate VaR using both methods
        historical_var = self.calculate_var(positions, returns_df, confidence_level, method="historical")
        parametric_var = self.calculate_var(positions, returns_df, confidence_level, method="parametric")
        
        # Calculate Sharpe ratio
        sharpe_ratio = self.calculate_sharpe_ratio(positions, returns_df, risk_free_rate)

        # Use provided totals or calculate if not provided
        if total_value is None:
            total_value = sum(p.market_value for p in positions)
        if total_pnl is None:
            total_pnl = sum(p.pnl for p in positions)

        return PortfolioRiskSummary(
            total_value=total_value,
            total_pnl=total_pnl,
            portfolio_volatility=volatility,
            correlations=correlations,
            portfolio_beta=beta,
            historical_var=historical_var,
            parametric_var=parametric_var,
            sharpe_ratio=sharpe_ratio,
            positions=positions
        )