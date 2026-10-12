import json
import math
import requests
from fastapi import APIRouter
import yfinance as yf
import numpy as np
import pandas_market_calendars as mcal
from datetime import datetime, timedelta, timezone
from openai import OpenAI
from app.core.config import settings
from concurrent.futures import ThreadPoolExecutor

router = APIRouter(prefix="/stocks", tags=["stocks"])
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

def finnhub(path: str, params: dict):
    return requests.get(
        f"https://finnhub.io/api/v1{path}",
        params={**params, "token": settings.FINNHUB_API_KEY}
    ).json()


# ── Shared FX helper ──────────────────────────────────────────────────────────

def get_fx_rate(info: dict) -> float:
    """
    Returns a multiplier to convert the ticker's financialCurrency to USD.
    Returns 1.0 for USD-denominated tickers or if the rate cannot be fetched.
    """
    financial_currency = info.get("financialCurrency", "USD")
    if financial_currency == "USD":
        return 1.0
    try:
        fx_ticker = yf.Ticker(f"{financial_currency}USD=X")
        rate = fx_ticker.fast_info.get("lastPrice")
        if rate and not math.isnan(float(rate)) and float(rate) > 0:
            return float(rate)
    except Exception:
        pass
    # Fallback to exchangeRate field if available
    try:
        fallback = info.get("exchangeRate")
        if fallback and not math.isnan(float(fallback)) and float(fallback) > 0:
            return float(fallback)
    except (TypeError, ValueError):
        pass
    return 1.0


def make_to_usd(fx_rate: float):
    """Returns a to_usd converter bound to the given fx_rate."""
    def to_usd(value) -> float | None:
        if value is None:
            return None
        try:
            f = float(value)
            return None if math.isnan(f) else f * fx_rate
        except (TypeError, ValueError):
            return None
    return to_usd


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{symbol}/quote")
def get_quote(symbol: str):
    return finnhub("/quote", {"symbol": symbol})


@router.get("/{symbol}/profile")
def get_profile(symbol: str):
    return finnhub("/stock/profile2", {"symbol": symbol})


@router.get("/search")
def search_symbols(q: str):
    return finnhub("/search", {"q": q})

def _get_exchange(ticker: yf.Ticker) -> str:
    exchange = ticker.info.get("exchange", "NYSE")
    exchange_map = {
        "NMS": "NASDAQ",
        "NYQ": "NYSE",
        "NGM": "NASDAQ",
        "PCX": "NYSE",
        "LSE": "LSE",
        "TSX": "TSX",
    }
    return exchange_map.get(exchange, "NYSE")

def _missing_trading_days(from_ts: int, actual_start_ts: int, exchange: str) -> int:
    # Safely convert timestamps (including negative ones) to dates
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    
    from_date   = (epoch + timedelta(seconds=from_ts)).date()
    actual_date = (epoch + timedelta(seconds=actual_start_ts)).date()

    if actual_date <= from_date:
        return 0

    cal      = mcal.get_calendar(exchange)
    schedule = cal.schedule(start_date=from_date, end_date=actual_date)
    return max(0, len(schedule) - 1)

RESOLUTION_MAP = {"D": "1d", "W": "1wk", "M": "1mo"}

@router.get("/{symbol}/candles")
def get_candles(symbol: str, resolution: str, from_ts: int, to_ts: int, is_max: bool = False):
    interval = RESOLUTION_MAP.get(resolution, resolution)
    ticker = yf.Ticker(symbol)

    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    start_dt = epoch + timedelta(seconds=from_ts)
    end_dt   =  epoch + timedelta(seconds=to_ts)

    if is_max:
        df = ticker.history(period="max", interval=interval, auto_adjust=True)
    else:
        df = ticker.history(start=start_dt, end=end_dt, interval=interval, auto_adjust=True)
    
    if df.empty:
        return {"s": "no_data"}

    actual_start_ts = int(df.index[0].timestamp())
    exchange        = _get_exchange(ticker)

    return {
        "s": "ok",
        "t": [int(ts.timestamp()) for ts in df.index],
        "o": df["Open"].tolist(),
        "h": df["High"].tolist(),
        "l": df["Low"].tolist(),
        "c": df["Close"].tolist(),
        "meta": {
            "requested_from": from_ts,
            "actual_from":    actual_start_ts,
            "is_incomplete":  _missing_trading_days(from_ts, actual_start_ts, exchange) > 1
        }
    }


@router.get("/{symbol}/financials")
def get_financials(symbol: str):
    ticker = yf.Ticker(symbol)
    info   = ticker.info
    cf     = ticker.cashflow
    bs     = ticker.balance_sheet
    inc    = ticker.income_stmt

    financial_currency = info.get("financialCurrency", "USD")
    fx_rate  = get_fx_rate(info)
    to_usd   = make_to_usd(fx_rate)

    # ── FCF + history ─────────────────────────────────────────────────────────
    fcf         = None
    fcf_history = []
    fcf_3yr_avg = None

    if cf is not None and not cf.empty:
        if "Free Cash Flow" in cf.index:
            row = cf.loc["Free Cash Flow"]
            now = datetime.now(timezone.utc)
            for date, val in row.items():
                converted = to_usd(val)
                if converted is not None:
                    fcf_history.append({"year": date.year, "fcf": converted, "_date": date})
            fcf_history.sort(key=lambda x: x["_date"])
            complete = [
                h for h in fcf_history
                if (now - h["_date"].replace(tzinfo=timezone.utc)).days > 45
            ]
            best = complete[-1] if complete else (fcf_history[-1] if fcf_history else None)
            if best:
                fcf = best["fcf"]
            recent = [h["fcf"] for h in complete[-3:]] if complete else []
            fcf_3yr_avg = sum(recent) / len(recent) if len(recent) >= 2 else None
            fcf_history = [{"year": h["year"], "fcf": h["fcf"]} for h in fcf_history]

    # ── Capex ─────────────────────────────────────────────────────────────────
    capex_direct  = None
    capex_history = []
    if cf is not None and not cf.empty:
        for row_name in ["Purchase Of PPE", "Capital Expenditure", "Capital Expenditures"]:
            if row_name in cf.index:
                row = cf.loc[row_name]
                current = to_usd(row.iloc[0])
                if current is not None:
                    capex_direct = abs(current)
                for date, val in row.items():
                    converted = to_usd(val)
                    if converted is not None:
                        capex_history.append({"year": date.year, "capex": abs(converted)})
                capex_history.sort(key=lambda x: x["year"])
                break

    # ── OCF + history ─────────────────────────────────────────────────────────
    operating_cash_flow = None
    ocf_history         = []
    if cf is not None and not cf.empty:
        for row_name in ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"]:
            if row_name in cf.index:
                row = cf.loc[row_name]
                converted = to_usd(row.iloc[0])
                if converted is not None:
                    operating_cash_flow = converted
                ocf_by_date = []
                for date, val in row.items():
                    c = to_usd(val)
                    if c is not None:
                        ocf_by_date.append((date, c))
                ocf_by_date.sort(key=lambda x: x[0])
                ocf_history = [v for _, v in ocf_by_date]
                break

    # ── Revenue history ───────────────────────────────────────────────────────
    revenue_history = []
    if inc is not None and not inc.empty:
        for row_name in ["Total Revenue", "Revenue"]:
            if row_name in inc.index:
                row = inc.loc[row_name]
                for date, val in row.items():
                    converted = to_usd(val)
                    if converted is not None:
                        revenue_history.append({"year": date.year, "revenue": converted})
                revenue_history.sort(key=lambda x: x["year"])
                break

    # ── Analyst forward estimates ─────────────────────────────────────────────
    analyst_estimates = {}
    try:
        growth = ticker.growth_estimates
        if growth is not None and not growth.empty and "LTG" in growth.index:
            val = growth.loc["LTG", "stockTrend"]
            if val is not None and not math.isnan(float(val)):
                analyst_estimates["eps_growth_ltg_pct"] = round(float(val) * 100, 1)
        if growth is not None and not growth.empty and "+1y" in growth.index:
            val = growth.loc["+1y", "stockTrend"]
            if val is not None and not math.isnan(float(val)):
                analyst_estimates["eps_growth_1yr_pct"] = round(float(val) * 100, 1)
    except Exception:
        pass

    try:
        rev_est = ticker.revenue_estimate
        if rev_est is not None and not rev_est.empty:
            for period in ["+1y", "0y"]:
                if period in rev_est.index:
                    row   = rev_est.loc[period]
                    g_val = row.get("growth") if "growth" in row.index else None
                    if g_val is not None and not math.isnan(float(g_val)):
                        analyst_estimates[f"revenue_growth_{period}_pct"] = round(float(g_val) * 100, 1)
                        break
    except Exception:
        pass

    try:
        analyst_estimates["target_low"]   = info.get("targetLowPrice")
        analyst_estimates["target_mean"]  = info.get("targetMeanPrice")
        analyst_estimates["target_high"]  = info.get("targetHighPrice")
        analyst_estimates["num_analysts"] = info.get("numberOfAnalystOpinions")
    except Exception:
        pass

    def bs_row(*candidates) -> float | None:
        if bs is None or bs.empty:
            return None
        for name in candidates:
            if name in bs.index:
                return to_usd(bs.loc[name].iloc[0])
        return None

    def inc_row(*candidates) -> float | None:
        if inc is None or inc.empty:
            return None
        for name in candidates:
            if name in inc.index:
                return to_usd(inc.loc[name].iloc[0])
        return None

    long_term_debt       = bs_row("Long Term Debt", "Long Term Debt And Capital Lease Obligation")
    current_debt         = bs_row("Current Debt", "Current Debt And Capital Lease Obligation", "Short Long Term Debt")
    total_debt           = bs_row("Total Debt") or ((long_term_debt or 0) + (current_debt or 0)) or None
    cash_and_equivalents = bs_row("Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")
    minority_interest    = bs_row("Minority Interest", "Noncontrolling Interest")
    preferred_stock      = bs_row("Preferred Stock", "Preferred Securities Outside Stock Equity")
    interest_expense     = inc_row("Interest Expense", "Interest Expense Non Operating")
    income_tax_expense   = inc_row("Tax Provision", "Income Tax Expense")
    pretax_income        = inc_row("Pretax Income", "Income Before Tax")

    if interest_expense is not None:
        interest_expense = abs(interest_expense)

    # ── Net borrowing (ΔDebt) ─────────────────────────────────────────────────
    net_borrowing = None
    if cf is not None and not cf.empty:
        issuance   = None
        repayment  = None
        for name in ["Issuance Of Debt", "Proceeds From Issuance Of Debt", "Long Term Debt Issuance"]:
            if name in cf.index:
                issuance = to_usd(cf.loc[name].iloc[0])
                break
        for name in ["Repayment Of Debt", "Repayment Of Long Term Debt", "Long Term Debt Payments"]:
            if name in cf.index:
                repayment = to_usd(cf.loc[name].iloc[0])
                break
        if issuance is not None or repayment is not None:
            net_borrowing = (issuance or 0) - abs(repayment or 0)

    risk_free_rate = 4.3
    try:
        tnx  = yf.Ticker("^TNX")
        rate = tnx.fast_info["lastPrice"]
        if rate and not math.isnan(rate):
            risk_free_rate = round(rate, 2)
    except Exception:
        pass

    return {
        "financial_currency":        financial_currency,
        "fx_rate_to_usd":            fx_rate,
        "free_cash_flow":            fcf,
        "fcf_3yr_avg":               fcf_3yr_avg,
        "fcf_history":               fcf_history,
        "operating_cash_flow":       operating_cash_flow,
        "ocf_history":               ocf_history,
        "shares_outstanding":        info.get("sharesOutstanding"),
        "beta":                      info.get("beta"),
        "current_price":             info.get("currentPrice"),
        "company_name":              info.get("longName"),
        "total_debt":                total_debt,
        "cash_and_equivalents":      cash_and_equivalents,
        "interest_expense":          interest_expense,
        "income_tax_expense":        income_tax_expense,
        "pretax_income":             pretax_income,
        "minority_interest":         minority_interest,
        "preferred_stock":           preferred_stock,
        "risk_free_rate":            risk_free_rate,
        "net_borrowing":             net_borrowing,
        "capex_direct":              capex_direct,
        "capex_history":             capex_history,
        "revenue_history":           revenue_history,
        "analyst_estimates":         analyst_estimates,
    }


@router.get("/{symbol}/summary")
def get_summary(symbol: str):
    """
    Returns TTM (Trailing Twelve Months) data for the subject company,
    converted to USD. Required to unlock EV/EBITDA, P/E, and P/S implied
    prices in CompsPanel.
    """
    ticker = yf.Ticker(symbol)
    info   = ticker.info
    to_usd = make_to_usd(get_fx_rate(info))
    
    return {
        "ebitda_ttm":  to_usd(info.get("ebitda")),
        "eps_ttm":     to_usd(info.get("trailingEps")),
        "revenue_ttm": to_usd(info.get("totalRevenue")),
        "fcf_ttm":     to_usd(info.get("freeCashflow")),
    }


# ── Peer cache (in-memory, lives for the lifetime of the process) ─────────────
import time
import threading

_peers_cache: dict[str, tuple[list[str], float]] = {}
_peers_cache_lock = threading.Lock()
_CACHE_TTL = 60 * 60 * 24  # 24 hours


def _get_peers_via_llm(symbol: str, company_name: str, n: int = 10) -> list[str]:
    """
    Uses GPT-4o to suggest peer tickers for a given company.
    Results are cached in-memory for 24 hours — peers rarely change, and the
    LLM call is the only meaningful latency source in get_comps.
    Any hallucinated/invalid tickers are silently dropped downstream because
    fetch_ticker_data returns market_cap=None for symbols yfinance can't resolve.
    """
    cache_key = symbol.upper()

    with _peers_cache_lock:
        cached = _peers_cache.get(cache_key)
        if cached and (time.time() - cached[1]) < _CACHE_TTL:
            return cached[0]

    prompt = f"""
Identify publicly traded peer companies for {company_name} ({symbol}).

A peer company should:
- generate revenue from a similar primary product or service
- sell similar software, platforms, or services
- operate a comparable business model

Avoid:
- companies that only use similar technologies
- companies that are merely ecosystem partners
- mega-cap platform companies unless they are direct peers

Return up to {n} peers.

Respond ONLY with a JSON array of uppercase ticker symbols.
"""
    
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=200,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    tickers = json.loads(raw)
    peers = [t.upper() for t in tickers if isinstance(t, str) and t.upper() != symbol.upper()]

    with _peers_cache_lock:
        _peers_cache[cache_key] = (peers, time.time())

    return peers


@router.get("/{symbol}/comps")
def get_comps(symbol: str, peers: str | None = None):
    """
    Fetches peer symbols via LLM (GPT-4o) and retrieves multiples via yfinance.
    If `peers` query param is provided (comma-separated), skips the LLM entirely
    and uses those symbols directly — this is the user override path.
    Hallucinated or delisted tickers are silently dropped (market_cap will be None).
    """
    if peers:
        peers_list = [p.strip().upper() for p in peers.split(',') if p.strip()]
    else:
        ticker = yf.Ticker(symbol)
        company_name = ticker.info.get("longName") or ticker.info.get("shortName") or symbol
        try:
            peers_list = _get_peers_via_llm(symbol, company_name)
        except Exception:
            peers_list = []

    peers_list = list(dict.fromkeys(peers_list))[:20]
    all_symbols = [symbol] + peers_list

    def fetch_ticker_data(s: str):
        try:
            t  = yf.Ticker(s)
            i  = t.info
            ev = i.get("enterpriseValue")

            # ── TTM FCF from last 4 quarters ──
            fcf_ttm = None
            try:
                qcf = t.quarterly_cashflow
                if qcf is not None and not qcf.empty and "Free Cash Flow" in qcf.index:
                    recent = qcf.loc["Free Cash Flow"].iloc[:4]
                    if recent.notna().sum() >= 3:
                        fcf_ttm = float(recent.sum())
            except Exception:
                pass
            if fcf_ttm is None:
                raw = i.get("freeCashflow")
                fcf_ttm = float(raw) if raw is not None else None

            calc_ev_fcf = None
            if ev is not None and fcf_ttm is not None and fcf_ttm > 0:
                calc_ev_fcf = round(ev / fcf_ttm, 2)

            # ── TTM EBITDA from last 4 quarters ──
            ebitda_ttm = None
            try:
                qinc = t.quarterly_income_stmt
                if qinc is not None and not qinc.empty:
                    for row_name in ["EBITDA", "Normalized EBITDA"]:
                        if row_name in qinc.index:
                            recent = qinc.loc[row_name].iloc[:4]
                            if recent.notna().sum() >= 3:
                                ebitda_ttm = float(recent.sum())
                            break
            except Exception:
                pass
            if ebitda_ttm is None:
                raw = i.get("ebitda")
                ebitda_ttm = float(raw) if raw is not None else None

            calc_ev_ebitda = None
            if ev is not None and ebitda_ttm is not None and ebitda_ttm > 0:
                calc_ev_ebitda = round(ev / ebitda_ttm, 2)

            return {
                "symbol":     s,
                "name":       i.get("shortName") or i.get("longName") or s,
                "market_cap": i.get("marketCap"),
                "ev_ebitda":  calc_ev_ebitda,
                "pe":         round(i.get("trailingPE"), 2) if i.get("trailingPE") else None,
                "ev_fcf":     calc_ev_fcf,
                "ps":         round(i.get("priceToSalesTrailing12Months"), 2) if i.get("priceToSalesTrailing12Months") else None,
            }
        except Exception:
            return {"symbol": s, "name": s, "market_cap": None}

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(fetch_ticker_data, all_symbols))

    subject_data = results[0]
    peers_data   = [r for r in results[1:] if r.get("market_cap") is not None]

    return {
        "subject": subject_data,
        "peers":   peers_data,
    }


@router.get("/indices/{symbol}/quote")
def get_index_quote(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        info   = ticker.info
        hist   = ticker.history(period="2d")

        if hist.empty:
            return {"error": f"No data available for {symbol}"}

        current_price = info.get("regularMarketPrice") or info.get("currentPrice")
        if not current_price and not hist.empty:
            current_price = hist["Close"].iloc[-1]

        prev_close = info.get("previousClose")
        if not prev_close and len(hist) >= 2:
            prev_close = hist["Close"].iloc[-2]

        change         = current_price - prev_close if current_price and prev_close else 0
        change_percent = (change / prev_close * 100) if prev_close else 0

        day_high = info.get("dayHigh") or (hist["High"].iloc[-1] if not hist.empty else current_price)
        day_low  = info.get("dayLow")  or (hist["Low"].iloc[-1]  if not hist.empty else current_price)
        day_open = info.get("open")    or (hist["Open"].iloc[-1] if not hist.empty else current_price)

        return {
            "c":  current_price,
            "d":  change,
            "dp": change_percent,
            "h":  day_high,
            "l":  day_low,
            "o":  day_open,
            "pc": prev_close,
        }
    except Exception as e:
        return {"error": str(e)}


@router.post("/{symbol}/dcf-suggest")
def dcf_suggest(symbol: str, payload: dict):
    financials          = payload.get("financials", {})
    current_assumptions = payload.get("current_assumptions", {})

    # ── Unpack ────────────────────────────────────────────────────────────────
    company_name        = financials.get("company_name") or symbol
    current_price       = financials.get("current_price")
    reported_fcf        = financials.get("free_cash_flow") or 0
    operating_cash_flow = financials.get("operating_cash_flow") or 0
    fcf_history         = financials.get("fcf_history", [])
    capex_history       = financials.get("capex_history", [])
    revenue_history     = financials.get("revenue_history", [])
    analyst_estimates   = financials.get("analyst_estimates", {})
    total_debt          = financials.get("total_debt") or 0
    interest_expense    = financials.get("interest_expense") or 0
    income_tax_expense  = financials.get("income_tax_expense") or 0
    pretax_income       = financials.get("pretax_income") or 0
    beta                = financials.get("beta") or 1.0
    total_years         = current_assumptions.get("years", 10)

    # ── Derived anchors ───────────────────────────────────────────────────────
    capex_values = [h["capex"] for h in capex_history]
    ocf_values   = financials.get("ocf_history", [])

    def _median(values):
        s = sorted(v for v in values if v is not None)
        if not s:
            return None
        n   = len(s)
        mid = n // 2
        return (s[mid - 1] + s[mid]) / 2 if n % 2 == 0 else s[mid]

    capex_median     = _median(capex_values) if capex_values else None
    ocf_median       = _median(ocf_values)   if ocf_values   else None
    normalised_fcf   = (ocf_median - capex_median) if ocf_median and capex_median else None
    fcf_to_ocf_ratio = round(reported_fcf / operating_cash_flow, 3) if operating_cash_flow else None

    # ── WACC ──────────────────────────────────────────────────────────────────
    rf  = current_assumptions.get("riskFreeRate", financials.get("risk_free_rate", 4.3))
    erp = current_assumptions.get("erp", 5.5)
    ke  = round(rf + beta * erp, 2)

    kd_pretax   = round(interest_expense / total_debt * 100, 2) if total_debt > 0 else None
    tax_rate    = round(income_tax_expense / pretax_income * 100, 1) if pretax_income > 0 else None
    kd_aftertax = round(kd_pretax * (1 - (tax_rate or 0) / 100), 2) if kd_pretax is not None else None

    equity_val = (current_price or 0) * (financials.get("shares_outstanding") or 0)
    total_cap  = equity_val + total_debt

    if total_cap > 0 and kd_aftertax is not None:
        e_weight  = equity_val / total_cap
        d_weight  = total_debt / total_cap
        base_wacc = round(ke * e_weight + kd_aftertax * d_weight, 2)
        wacc_note = (
            f"Ke={ke}% × {e_weight*100:.1f}% equity + "
            f"Kd(after-tax)={kd_aftertax}% × {d_weight*100:.1f}% debt = {base_wacc}%"
        )
    else:
        base_wacc = ke
        wacc_note = f"All-equity: Rf {rf}% + β {beta} × ERP {erp}% = {base_wacc}%"

    # ── Historical FCF CAGRs ──────────────────────────────────────────────────
    cagr_3yr = cagr_5yr = median_yoy = None
    if len(fcf_history) >= 2:
        yoy_rates = []
        for i in range(1, len(fcf_history)):
            prev = fcf_history[i - 1]["fcf"]
            curr = fcf_history[i]["fcf"]
            if prev and prev > 0:
                yoy_rates.append((curr - prev) / abs(prev) * 100)
        if yoy_rates:
            median_yoy = round(sorted(yoy_rates)[len(yoy_rates) // 2], 1)
        latest = fcf_history[-1]["fcf"]
        if len(fcf_history) >= 4 and fcf_history[-4]["fcf"] > 0 and latest > 0:
            cagr_3yr = round(((latest / fcf_history[-4]["fcf"]) ** (1/3) - 1) * 100, 1)
        if len(fcf_history) >= 6 and fcf_history[-6]["fcf"] > 0 and latest > 0:
            cagr_5yr = round(((latest / fcf_history[-6]["fcf"]) ** (1/5) - 1) * 100, 1)

    # ── Revenue CAGRs ─────────────────────────────────────────────────────────
    rev_cagr_3yr = rev_cagr_5yr = None
    if len(revenue_history) >= 2:
        latest_rev = revenue_history[-1]["revenue"]
        if len(revenue_history) >= 4 and revenue_history[-4]["revenue"] > 0 and latest_rev > 0:
            rev_cagr_3yr = round(((latest_rev / revenue_history[-4]["revenue"]) ** (1/3) - 1) * 100, 1)
        if len(revenue_history) >= 6 and revenue_history[-6]["revenue"] > 0 and latest_rev > 0:
            rev_cagr_5yr = round(((latest_rev / revenue_history[-6]["revenue"]) ** (1/5) - 1) * 100, 1)

    # ── Format history strings ────────────────────────────────────────────────
    fcf_lines = []
    for i, item in enumerate(fcf_history):
        line = f"  {item['year']}: ${item['fcf']/1e9:.2f}B"
        if i > 0:
            prev = fcf_history[i-1]["fcf"]
            if prev and prev != 0:
                yoy = (item["fcf"] - prev) / abs(prev) * 100
                line += f"  ({yoy:+.1f}% YoY)"
        fcf_lines.append(line)

    rev_lines = []
    for i, item in enumerate(revenue_history):
        line = f"  {item['year']}: ${item['revenue']/1e9:.2f}B"
        if i > 0:
            prev = revenue_history[i-1]["revenue"]
            if prev and prev != 0:
                yoy = (item["revenue"] - prev) / abs(prev) * 100
                line += f"  ({yoy:+.1f}% YoY)"
        rev_lines.append(line)

    capex_lines = []
    for i, item in enumerate(capex_history):
        line = f"  {item['year']}: ${item['capex']/1e9:.2f}B"
        if i > 0:
            prev = capex_history[i-1]["capex"]
            if prev and prev != 0:
                yoy = (item["capex"] - prev) / abs(prev) * 100
                line += f"  ({yoy:+.1f}% YoY)"
        capex_lines.append(line)

    capex_trough       = f"${min(capex_values)/1e9:.2f}B" if capex_values else "N/A"
    capex_peak         = f"${max(capex_values)/1e9:.2f}B" if capex_values else "N/A"
    capex_median_str   = f"${capex_median/1e9:.2f}B"      if capex_median   is not None else "N/A"
    ocf_median_str     = f"${ocf_median/1e9:.2f}B"        if ocf_median     is not None else "N/A"
    normalised_fcf_str = f"${normalised_fcf/1e9:.2f}B"    if normalised_fcf is not None else "N/A"
    fcf_to_ocf_str     = f"{fcf_to_ocf_ratio:.1%}"        if fcf_to_ocf_ratio is not None else "N/A"
    price_str          = f"${current_price:.2f}"           if current_price else "N/A"

    # ── Analyst estimates string ──────────────────────────────────────────────
    est_lines = []
    if analyst_estimates.get("eps_growth_ltg_pct") is not None:
        est_lines.append(f"  Analyst consensus long-term EPS growth: {analyst_estimates['eps_growth_ltg_pct']}%")
    if analyst_estimates.get("eps_growth_1yr_pct") is not None:
        est_lines.append(f"  Analyst consensus EPS growth (next 12m): {analyst_estimates['eps_growth_1yr_pct']}%")
    if analyst_estimates.get("revenue_growth_+1y_pct") is not None:
        est_lines.append(f"  Analyst consensus revenue growth (next 12m): {analyst_estimates['revenue_growth_+1y_pct']}%")
    if analyst_estimates.get("target_mean") is not None:
        est_lines.append(f"  Analyst price target — low: ${analyst_estimates.get('target_low')}  mean: ${analyst_estimates.get('target_mean')}  high: ${analyst_estimates.get('target_high')}")
        est_lines.append(f"  Number of analysts: {analyst_estimates.get('num_analysts')}")
    analyst_str = "\n".join(est_lines) if est_lines else "  Not available"

    prompt = f"""You are a professional equity analyst suggesting DCF parameters for {company_name} ({symbol}).
The user will review your reasoning and decide whether to apply each scenario — be detailed and specific.

═══════════════════════════════════════════════════════
FINANCIALS
═══════════════════════════════════════════════════════
Current price:         {price_str}
Reported FCF:          ${reported_fcf/1e9:.2f}B
Operating Cash Flow:   ${operating_cash_flow/1e9:.2f}B
Current Capex:         ${(financials.get("capex_direct") or 0)/1e9:.2f}B
FCF-to-OCF ratio:      {fcf_to_ocf_str}  (fraction of OCF that survives after capex)
Median-normalised FCF: {normalised_fcf_str}  (median OCF {ocf_median_str} − median capex {capex_median_str})
Beta:                  {beta}
Risk-free rate:        {rf}%
Base WACC:             {base_wacc:.2f}%  ({wacc_note})

FCF history (oldest → newest):
{chr(10).join(fcf_lines) or "  Not available"}

FCF CAGRs:
  3yr CAGR:   {f"{cagr_3yr}%" if cagr_3yr is not None else "N/A"}
  5yr CAGR:   {f"{cagr_5yr}%" if cagr_5yr is not None else "N/A"}
  Median YoY: {f"{median_yoy}%" if median_yoy is not None else "N/A"}

Revenue history (oldest → newest):
{chr(10).join(rev_lines) or "  Not available"}

Revenue CAGRs:
  3yr CAGR: {f"{rev_cagr_3yr}%" if rev_cagr_3yr is not None else "N/A"}
  5yr CAGR: {f"{rev_cagr_5yr}%" if rev_cagr_5yr is not None else "N/A"}

Capex history (oldest → newest):
{chr(10).join(capex_lines) or "  Not available"}
  Median: {capex_median_str}
  Trough: {capex_trough}
  Peak:   {capex_peak}

Analyst forward estimates:
{analyst_str}

═══════════════════════════════════════════════════════
YOUR JOB
═══════════════════════════════════════════════════════
Produce Conservative, Base, and Bull scenarios. The Bull scenario must produce
the highest intrinsic value, Conservative the lowest.

For each scenario output:

1. base_fcf (billions)
   The normalised FCF the business will earn once the current investment cycle matures.

   Use the FCF-to-OCF ratio ({fcf_to_ocf_str}) to judge how representative reported FCF is:
   - High ratio (FCF close to OCF): reported FCF is your primary anchor.
     Adjust slightly up (Bull) or down (Conservative).
   - Low ratio (FCF heavily below OCF): use median-normalised FCF ({normalised_fcf_str})
     as your anchor — reported FCF understates true earning power.
     Adjust based on whether through-cycle capex will be above/below its median.

   Show your arithmetic in assumptions_rationale.

2. stage1_growth (% per year)
   Annual FCF growth rate during Stage 1.

   You have several anchors — weigh them and form your own view:
   - Historical FCF CAGRs: backward-looking actual returns, but may be distorted
     if FCF has been compressed or boosted by capex cycles or one-off events
   - Historical revenue CAGRs: underlying volume growth, less affected by capex
   - Analyst consensus EPS growth 5yr: forward-looking, reflects analyst expectations
     of margin expansion, investment cycle maturity, and business momentum
   - Analyst price target: if the mean target is significantly above current price,
     the market is pricing in more growth than history alone suggests

   Consider whether history and consensus agree or diverge. If they diverge, explain
   why — is there a specific catalyst (investment cycle ending, margin expansion,
   new product category) that justifies a step-up beyond historical rates?
   If you think consensus is too optimistic or pessimistic, say why.
   Form your own conclusion — do not mechanically follow any single number.
   Do NOT use a single best year as an anchor — that is an outlier, not a trend.

3. stage2_growth (% per year)
   Growth rate after Stage 1, bridging toward terminal growth.
   Must sit between stage1_growth and terminal_growth.
   Example: if stage1=12% and terminal=3%, stage2 should be ~6-8%.

4. terminal_growth (max 3.5%, must not exceed risk-free rate of {rf}%)

5. stage1_years (integer, less than {total_years})

6. wacc_adjustment (pp delta from base WACC of {base_wacc:.2f}%)
   Conservative: positive (more risk). Base: 0. Bull: negative (less risk).

assumptions_rationale must be detailed — 6-8 sentences minimum. Cover:
  - What the FCF-to-OCF ratio tells you and how you derived base_fcf
  - Which growth anchors you considered, whether they agree or diverge, and your conclusion
  - What specific catalyst or risk drives the scenario vs the base case
  - What stage2_growth represents and how it bridges to terminal
  - What the WACC adjustment reflects about risk in this scenario

Respond ONLY with valid JSON:
{{
  "macro_context": "<4-5 sentences: industry positioning, capex cycle, what current price implies>",
  "scenarios": [
    {{
      "label": "Conservative",
      "base_fcf": <number in billions>,
      "stage1_growth": <number>,
      "stage1_years": <integer less than {total_years}>,
      "stage2_growth": <number>,
      "terminal_growth": <number max 3.5>,
      "wacc_adjustment": <positive number>,
      "thesis": "<1 sentence: specific bear case>",
      "assumptions_rationale": "<6-8 sentences covering all points above>",
      "upside_drivers": ["<specific catalyst>", "<specific catalyst>"],
      "downside_risks": ["<specific risk>", "<specific risk>", "<specific risk>"]
    }},
    {{
      "label": "Base",
      "base_fcf": <number in billions>,
      "stage1_growth": <number>,
      "stage1_years": <integer less than {total_years}>,
      "stage2_growth": <number>,
      "terminal_growth": <number max 3.5>,
      "wacc_adjustment": 0.0,
      "thesis": "<1 sentence: most likely outcome>",
      "assumptions_rationale": "<6-8 sentences covering all points above>",
      "upside_drivers": ["<specific catalyst>", "<specific catalyst>"],
      "downside_risks": ["<specific risk>", "<specific risk>", "<specific risk>"]
    }},
    {{
      "label": "Bull",
      "base_fcf": <number in billions>,
      "stage1_growth": <number>,
      "stage1_years": <integer less than {total_years}>,
      "stage2_growth": <number>,
      "terminal_growth": <number max 3.5>,
      "wacc_adjustment": <negative number>,
      "thesis": "<1 sentence: specific bull case>",
      "assumptions_rationale": "<6-8 sentences covering all points above>",
      "upside_drivers": ["<specific catalyst>", "<specific catalyst>", "<specific catalyst>"],
      "downside_risks": ["<specific risk>", "<specific risk>"]
    }}
  ],
  "risks": "<3-4 sentences: cross-scenario risks>"
}}"""

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=4000,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    result = json.loads(raw)

    # ── Post-process: Python owns all arithmetic ──────────────────────────────
    rf_rate = financials.get("risk_free_rate", 4.3)

    for scenario in result.get("scenarios", []):
        wacc_adjustment = scenario.pop("wacc_adjustment", 0.0)

        scenario["base_fcf"]      = round(scenario.get("base_fcf", reported_fcf / 1e9), 2)
        scenario["wacc"]          = round(base_wacc + wacc_adjustment, 2)
        scenario["stage1_growth"] = round(scenario.get("stage1_growth", 0), 1)
        final_stage1_growth       = scenario["stage1_growth"]

        scenario["terminal_growth"] = round(
            min(scenario.get("terminal_growth", 2.5), rf_rate), 2
        )
        clamped_terminal = scenario["terminal_growth"]

        llm_stage2 = scenario.get("stage2_growth", 3.0)
        scenario["stage2_growth"] = round(
            max(clamped_terminal, min(llm_stage2, final_stage1_growth)), 2
        )

    # ── Enforce Bull > Base > Conservative by intrinsic value proxy ───────────
    def proxy_value(s: dict) -> float:
        fcf  = s.get("base_fcf", 0) * 1e9
        g1   = s.get("stage1_growth", 0) / 100
        g2   = s.get("stage2_growth", 0) / 100
        gt   = s.get("terminal_growth", 0) / 100
        wacc = s.get("wacc", 10) / 100
        yrs  = s.get("stage1_years", 5)
        if wacc <= gt:
            return 0.0
        fcf_end_s1 = fcf * ((1 + g1) ** yrs)
        fcf_end_s2 = fcf_end_s1 * ((1 + g2) ** max(1, 10 - yrs))
        return fcf_end_s2 * (1 + gt) / (wacc - gt)

    scenarios = result.get("scenarios", [])
    if len(scenarios) == 3:
        sorted_scenarios = sorted(scenarios, key=proxy_value)
        for i, label in enumerate(["Conservative", "Base", "Bull"]):
            sorted_scenarios[i]["label"] = label
        result["scenarios"] = sorted_scenarios

    return result


@router.post("/{symbol}/period-analysis")
def period_analysis(symbol: str, payload: dict):
    """
    Analyse a single period's financial data point in context of its history.
    Called when the user clicks a bar on the Financials page.
    """
    company_name  = payload.get("company_name") or symbol
    metric        = payload.get("metric")
    period        = payload.get("period")
    value         = payload.get("value")
    history       = payload.get("history", [])
    current_price = payload.get("current_price")

    history_lines = []
    for i, item in enumerate(history):
        line = f"  {item['period']}: ${item['value']:.2f}B"
        if i > 0:
            prev = history[i - 1]["value"]
            if prev and prev != 0:
                yoy = (item["value"] - prev) / abs(prev) * 100
                line += f"  ({yoy:+.1f}% YoY)"
        history_lines.append(line)
        if item["period"] == str(period):
            history_lines[-1] += "  ← selected"

    metric_labels = {
        "revenue": "Revenue",
        "fcf":     "Free Cash Flow",
        "capex":   "Capital Expenditure",
        "ocf":     "Operating Cash Flow",
    }
    metric_label = metric_labels.get(metric, metric)

    prompt = f"""You are a financial analyst explaining a single data point for {company_name} ({symbol}).
The user has clicked on the {period} bar in the {metric_label} chart.

{metric_label} history (oldest → newest):
{chr(10).join(history_lines) or "  Not available"}

Selected period: {period}
Selected value:  ${value:.2f}B
Current stock price: {"$" + str(current_price) if current_price else "N/A"}

Write a focused 4-6 sentence analysis of this specific period. Cover:
1. What drove the {metric_label} result in {period} — be specific about the business reason
2. How it compares to the prior period and the broader trend
3. What this data point tells us about the health or trajectory of the business
4. One forward-looking implication

Be specific. Do not just describe the number — explain the business story behind it.
Avoid vague phrases like "reflects strong performance".

Respond with valid JSON only:
{{
  "headline": "<8-12 word summary of the key insight for this period>",
  "analysis": "<4-6 sentences of detailed analysis>",
  "sentiment": "positive | neutral | negative",
  "yoy_change": <number or null>,
  "context_tag": "<3-5 word label e.g. 'Investment cycle peak'>",
  "watch": "<1 sentence: the one thing to watch going forward>"
}}"""

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=800,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    return json.loads(raw)