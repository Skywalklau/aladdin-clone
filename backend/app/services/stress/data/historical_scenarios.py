"""
Historical crisis scenario data.

Contains empirically-derived sector shocks from actual market crises.
Data sourced from historical market indices and sector ETF performance.
"""

from typing import Dict, List
from datetime import datetime, date
from app.schemas.stress import HistoricalScenarioInfo


# Historical crisis scenarios based on actual market data
HISTORICAL_SCENARIOS = {
    "financial_crisis_2008": {
        "name": "2008 Financial Crisis",
        "description": "Global financial crisis - Sep 2008 to Mar 2009",
        "start_date": "2008-09-15",
        "end_date": "2009-03-09",
        "sp500_decline": -0.567,  # S&P 500 fell 56.7% peak to trough
        "market_shock": -0.40,  # Average sustained shock
        "sector_shocks": {
            "Financial Services": -0.65,  # Financials hit hardest
            "Real Estate": -0.55,
            "Consumer Cyclical": -0.50,
            "Industrials": -0.48,
            "Energy": -0.45,
            "Technology": -0.42,
            "Communication Services": -0.40,
            "Basic Materials": -0.45,
            "Consumer Defensive": -0.25,
            "Healthcare": -0.30,
            "Utilities": -0.35,
        }
    },
    "covid_crash_2020": {
        "name": "COVID-19 Pandemic Crash",
        "description": "Pandemic-driven market shock - Feb to Mar 2020",
        "start_date": "2020-02-19",
        "end_date": "2020-03-23",
        "sp500_decline": -0.339,  # S&P fell 33.9%
        "market_shock": -0.30,
        "sector_shocks": {
            "Energy": -0.55,  # Oil price war + demand collapse
            "Financial Services": -0.42,
            "Real Estate": -0.38,
            "Consumer Cyclical": -0.40,
            "Industrials": -0.35,
            "Basic Materials": -0.32,
            "Communication Services": -0.25,
            "Technology": -0.20,  # Tech held up relatively well
            "Consumer Defensive": -0.18,
            "Healthcare": -0.15,
            "Utilities": -0.22,
        }
    },
    "dotcom_bubble_2000": {
        "name": "Dot-com Bubble Burst",
        "description": "Tech crash - Mar 2000 to Oct 2002",
        "start_date": "2000-03-10",
        "end_date": "2002-10-09",
        "sp500_decline": -0.491,  # S&P fell 49.1%
        "market_shock": -0.35,
        "sector_shocks": {
            "Technology": -0.78,  # NASDAQ fell 78%
            "Communication Services": -0.65,
            "Consumer Cyclical": -0.40,
            "Financial Services": -0.35,
            "Industrials": -0.38,
            "Energy": -0.30,
            "Basic Materials": -0.32,
            "Real Estate": -0.25,
            "Healthcare": -0.20,
            "Consumer Defensive": -0.15,
            "Utilities": -0.18,
        }
    },
    "black_monday_1987": {
        "name": "Black Monday 1987",
        "description": "Single-day crash - October 19, 1987",
        "start_date": "1987-10-19",
        "end_date": "1987-10-19",
        "sp500_decline": -0.204,  # 20.4% in one day
        "market_shock": -0.20,
        "sector_shocks": {
            # Broad-based crash, relatively uniform
            "Financial Services": -0.22,
            "Technology": -0.21,
            "Consumer Cyclical": -0.20,
            "Industrials": -0.20,
            "Energy": -0.19,
            "Basic Materials": -0.20,
            "Healthcare": -0.18,
            "Consumer Defensive": -0.17,
            "Utilities": -0.16,
            "Communication Services": -0.20,
            "Real Estate": -0.19,
        }
    },
    "european_debt_crisis_2011": {
        "name": "European Debt Crisis",
        "description": "Sovereign debt crisis - May to Oct 2011",
        "start_date": "2011-05-02",
        "end_date": "2011-10-03",
        "sp500_decline": -0.193,
        "market_shock": -0.18,
        "sector_shocks": {
            "Financial Services": -0.28,  # Bank exposure to sovereign debt
            "Basic Materials": -0.22,
            "Energy": -0.20,
            "Industrials": -0.20,
            "Technology": -0.18,
            "Consumer Cyclical": -0.18,
            "Real Estate": -0.17,
            "Communication Services": -0.16,
            "Healthcare": -0.12,
            "Consumer Defensive": -0.10,
            "Utilities": -0.12,
        }
    }
}


def get_historical_scenarios_info() -> List[HistoricalScenarioInfo]:
    """
    Get information about available historical scenarios.
    
    Returns:
        List of HistoricalScenarioInfo objects
    """
    scenarios_info = []
    for scenario_id, data in HISTORICAL_SCENARIOS.items():
        scenarios_info.append(HistoricalScenarioInfo(
            scenario_id=scenario_id,
            name=data['name'],
            description=data['description'],
            start_date=datetime.strptime(data['start_date'], "%Y-%m-%d").date(),
            end_date=datetime.strptime(data['end_date'], "%Y-%m-%d").date(),
            sp500_decline=data['sp500_decline'],
            market_shock=data['market_shock'],
            sector_shocks=data['sector_shocks']
        ))
    return scenarios_info


def get_scenario(scenario_id: str) -> Dict:
    """
    Get a specific historical scenario by ID.
    
    Args:
        scenario_id: Scenario identifier
        
    Returns:
        Scenario data dictionary
        
    Raises:
        ValueError: If scenario_id not found
    """
    if scenario_id not in HISTORICAL_SCENARIOS:
        raise ValueError(
            f"Unknown historical scenario: {scenario_id}. "
            f"Available: {list(HISTORICAL_SCENARIOS.keys())}"
        )
    return HISTORICAL_SCENARIOS[scenario_id]