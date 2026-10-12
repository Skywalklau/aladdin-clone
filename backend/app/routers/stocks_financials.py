"""
Comprehensive financial data router — mount in app/main.py:
    from app.routers.stocks_financials import router as fin_router
    app.include_router(fin_router, prefix="/api")
"""

import math
import pandas as pd
import yfinance as yf
from fastapi import APIRouter

router = APIRouter(prefix="/stocks", tags=["stocks-financials"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _period_label(date, quarterly: bool) -> str:
    if quarterly:
        q = (date.month - 1) // 3 + 1
        return f"Q{q} {date.year}"
    return str(date.year)


def _stmt_series(df, *candidates):
    """Return sorted [(date, float)] from the first matching row in a statement DF."""
    if df is None or df.empty:
        return []
    for name in candidates:
        if name in df.index:
            pairs = []
            for date, val in df.loc[name].items():
                v = _safe(val)
                if v is not None:
                    pairs.append((date, v))
            pairs.sort(key=lambda x: x[0])
            return pairs
    return []


def _bs_val(df, *candidates) -> float | None:
    """Get the most recent value from a balance sheet row."""
    if df is None or df.empty:
        return None
    for name in candidates:
        if name in df.index:
            v = _safe(df.loc[name].iloc[0])
            if v is not None:
                return v
    return None


def _build_period_map(df, fields: dict, quarterly: bool) -> list:
    """
    Build list of period dicts from a statement DataFrame.
    fields: {output_key: [candidate_row_names]}
    """
    if df is None or df.empty:
        return []

    period_data: dict = {}

    for key, candidates in fields.items():
        for date, val in _stmt_series(df, *candidates):
            p = _period_label(date, quarterly)
            if p not in period_data:
                period_data[p] = {"period": p, "_sort_key": date}
            if key not in period_data[p]:
                period_data[p][key] = val

    result = sorted(period_data.values(), key=lambda x: x["_sort_key"])
    for r in result:
        r.pop("_sort_key", None)
    return result


# ── Statement Builders ────────────────────────────────────────────────────────

def build_income(df, quarterly: bool) -> list:
    rows = _build_period_map(df, {
        "revenue":          ["Total Revenue", "Revenue"],
        "gross_profit":     ["Gross Profit"],
        "operating_income": ["Operating Income", "EBIT"],
        "ebitda":           ["EBITDA", "Normalized EBITDA"],
        "net_income":       ["Net Income", "Net Income Common Stockholders"],
        "rd_expense":       ["Research And Development"],
        "sga_expense":      ["Selling General And Administration",
                             "General And Administrative Expense"],
        "depreciation":     ["Reconciled Depreciation",
                             "Depreciation And Amortization In Income Statement"],
        "interest_expense": ["Interest Expense", "Interest Expense Non Operating"],
        "eps_diluted":      ["Diluted EPS"],
        "eps_basic":        ["Basic EPS"],
    }, quarterly)

    for r in rows:
        rev = r.get("revenue")
        if rev and rev > 0:
            for k, col in [("gross_margin",     "gross_profit"),
                           ("operating_margin", "operating_income"),
                           ("net_margin",       "net_income"),
                           ("ebitda_margin",    "ebitda")]:
                v = r.get(col)
                if v is not None:
                    r[k] = round(v / rev * 100, 2)
            rd = r.get("rd_expense")
            if rd is not None:
                r["rd_margin"] = round(abs(rd) / rev * 100, 2)
        # Flip sign on expense rows
        for k in ["rd_expense", "sga_expense", "interest_expense", "depreciation"]:
            if k in r and r[k] is not None:
                r[k] = abs(r[k])

    return rows


def build_cashflow(df, quarterly: bool) -> list:
    rows = _build_period_map(df, {
        "operating_cf":   ["Operating Cash Flow",
                           "Cash Flow From Continuing Operating Activities"],
        "fcf":            ["Free Cash Flow"],
        "capex":          ["Purchase Of PPE", "Capital Expenditure", "Capital Expenditures"],
        "sbc":            ["Stock Based Compensation"],
        "buybacks":       ["Repurchase Of Capital Stock", "Common Stock Repurchased"],
        "dividends_paid": ["Cash Dividends Paid", "Common Stock Dividend Paid"],
        "change_in_wc":   ["Change In Working Capital"],
    }, quarterly)

    for r in rows:
        for k in ["capex", "buybacks", "dividends_paid"]:
            if k in r and r[k] is not None:
                r[k] = abs(r[k])
        fcf = r.get("fcf")
        sbc = r.get("sbc")
        if fcf is not None and sbc is not None:
            r["fcf_adj"] = fcf - abs(sbc)
        # FCF conversion rate
        ocf = r.get("operating_cf")
        if fcf is not None and ocf and ocf != 0:
            r["fcf_conversion"] = round(fcf / ocf * 100, 1)

    return rows


def build_balance(df, quarterly: bool) -> list:
    rows = _build_period_map(df, {
        "cash":                ["Cash And Cash Equivalents",
                                "Cash Cash Equivalents And Short Term Investments",
                                "Cash And Short Term Investments"],
        "short_term_inv":      ["Other Short Term Investments",
                                "Available For Sale Securities"],
        "total_assets":        ["Total Assets"],
        "current_assets":      ["Current Assets"],
        "current_liabilities": ["Current Liabilities"],
        "total_equity":        ["Stockholders Equity", "Common Stock Equity"],
        "retained_earnings":   ["Retained Earnings"],
        "total_debt":          ["Total Debt"],
        "long_term_debt":      ["Long Term Debt",
                                "Long Term Debt And Capital Lease Obligation"],
        "current_debt":        ["Current Debt",
                                "Current Debt And Capital Lease Obligation"],
        # ── Expanded candidates: yfinance uses different names across years ──
        "capital_lease":       [
                                "Capital Lease Obligations",
                                "Finance Lease Liability",
                                "Operating Lease Liability",
                                "Long Term Capital Lease Obligation",
                                "Current Capital Lease Obligation",
                                "Capitalized Lease Obligations",
                                "Lease Obligations",
                               ],
        "goodwill":            ["Goodwill"],
        "intangibles":         ["Goodwill And Other Intangible Assets"],
        "inventories":         ["Inventory"],
        "accounts_receivable": ["Accounts Receivable"],
    }, quarterly)

    for r in rows:
        cash = r.get("cash", 0) or 0
        debt = r.get("total_debt", 0) or 0
        # net_cash = cash - total_debt
        # Note: total_debt already includes capital lease obligations,
        # so lease is shown in the tooltip for breakdown only — not subtracted again.
        r["net_cash"] = cash - debt
        ca = r.get("current_assets")
        cl = r.get("current_liabilities")
        if ca and cl and cl != 0:
            r["current_ratio"] = round(ca / cl, 2)
        ta = r.get("total_assets")
        te = r.get("total_equity")
        if ta and te and ta != 0:
            r["debt_to_equity"] = round(debt / max(te, 1), 2) if te else None
            r["equity_ratio"]   = round(te / ta * 100, 1)

    return rows


def build_dividends(cf_df, inc_df, ticker, quarterly: bool) -> list:
    """
    Build per-period dividend metrics:
      - dividends_paid  : total cash dividends paid (from cash flow statement)
      - dps             : dividend per share (summed from ticker.dividends)
      - payout_ratio    : dividends_paid / net_income * 100
      - div_yield       : dps / period-end price * 100
    """
    # ── Base rows: total dividends paid from cash flow statement ──────────────
    rows = _build_period_map(cf_df, {
        "dividends_paid": ["Cash Dividends Paid", "Common Stock Dividend Paid"],
    }, quarterly)

    if not rows:
        return []

    # Flip sign — dividends_paid is negative in the cash flow statement
    for r in rows:
        if r.get("dividends_paid") is not None:
            r["dividends_paid"] = abs(r["dividends_paid"])

    # ── DPS: sum actual per-share payments from ticker.dividends ──────────────
    try:
        raw_divs = ticker.dividends  # Series: DatetimeIndex → float (per share)
        if raw_divs is not None and not raw_divs.empty:
            # Normalise timezone
            if raw_divs.index.tz is not None:
                raw_divs.index = raw_divs.index.tz_localize(None)

            for r in rows:
                try:
                    period_label = r["period"]
                    if quarterly:
                        parts = period_label.split()
                        q, yr = int(parts[0][1]), int(parts[1])
                        month = q * 3
                        start = pd.Timestamp(year=yr, month=month - 2, day=1)
                        end   = pd.Timestamp(year=yr, month=month, day=1) + pd.offsets.MonthEnd(0)
                    else:
                        yr    = int(period_label)
                        start = pd.Timestamp(year=yr, month=1,  day=1)
                        end   = pd.Timestamp(year=yr, month=12, day=31)

                    mask = (raw_divs.index >= start) & (raw_divs.index <= end)
                    total_dps = float(raw_divs[mask].sum())
                    if total_dps > 0:
                        r["dps"] = round(total_dps, 4)
                except Exception:
                    pass
    except Exception:
        pass

    # ── Payout ratio: cross-reference net income ──────────────────────────────
    inc_rows = _build_period_map(inc_df, {
        "net_income": ["Net Income", "Net Income Common Stockholders"],
    }, quarterly)
    inc_map = {r["period"]: r.get("net_income") for r in inc_rows}

    for r in rows:
        ni = inc_map.get(r["period"])
        dp = r.get("dividends_paid")
        if ni and ni > 0 and dp is not None:
            r["payout_ratio"] = round(dp / ni * 100, 1)

    # ── Dividend yield: dps / period-end price ────────────────────────────────
    try:
        freq = "QE" if quarterly else "YE"
        hist = ticker.history(period="10y", interval="1mo")

        if not hist.empty:
            prices = hist["Close"].resample(freq).last()

            for r in rows:
                dps = r.get("dps")
                if dps is None:
                    continue
                try:
                    period_label = r["period"]
                    if quarterly:
                        parts  = period_label.split()
                        q, yr  = int(parts[0][1]), int(parts[1])
                        month  = q * 3
                        target = pd.Timestamp(year=yr, month=month, day=1) + pd.offsets.MonthEnd(0)
                    else:
                        target = pd.Timestamp(year=int(period_label), month=12, day=31)

                    idx   = prices.index.get_indexer([target], method="nearest")[0]
                    price = float(prices.iloc[idx])
                    if price > 0:
                        r["div_yield"] = round(dps / price * 100, 2)
                except Exception:
                    pass
    except Exception:
        pass

    return [r for r in rows if r.get("dividends_paid") is not None]


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@router.get("/{symbol}/comprehensive")
def get_comprehensive(symbol: str):
    ticker = yf.Ticker(symbol)
    info   = ticker.info

    inc_a = ticker.income_stmt
    inc_q = ticker.quarterly_income_stmt
    cf_a  = ticker.cashflow
    cf_q  = ticker.quarterly_cashflow
    bs_a  = ticker.balance_sheet
    bs_q  = ticker.quarterly_balance_sheet

    # ── Valuation/Summary ─────────────────────────────────────────────────────
    mc  = _safe(info.get("marketCap"))
    ev  = _safe(info.get("enterpriseValue"))

    # ── FCF TTM ───────────────────────────────────────────────────────────────
    fcf_ttm = _safe(info.get("freeCashflow"))
    if fcf_ttm is None:
        fcf_series = _stmt_series(cf_a, "Free Cash Flow")
        fcf_ttm    = fcf_series[-1][1] if fcf_series else None

    # ── Cash ──────────────────────────────────────────────────────────────────
    cash_info = _safe(info.get("totalCash") or info.get("cash"))
    if cash_info is None:
        cash_info = _bs_val(bs_a,
            "Cash And Cash Equivalents",
            "Cash Cash Equivalents And Short Term Investments",
            "Cash And Short Term Investments")

    # ── Debt ──────────────────────────────────────────────────────────────────
    debt_info = _safe(info.get("totalDebt"))
    if debt_info is None:
        debt_info = _bs_val(bs_a, "Total Debt")
    if debt_info is None:
        ltd = _bs_val(bs_a, "Long Term Debt", "Long Term Debt And Capital Lease Obligation") or 0
        cd  = _bs_val(bs_a, "Current Debt", "Current Debt And Capital Lease Obligation") or 0
        if ltd or cd:
            debt_info = ltd + cd

    # ── EBITDA TTM ────────────────────────────────────────────────────────────
    ebitda_ttm = _safe(info.get("ebitda"))
    if ebitda_ttm is None:
        ebitda_series = _stmt_series(inc_a, "EBITDA", "Normalized EBITDA")
        if ebitda_series:
            ebitda_ttm = ebitda_series[-1][1]

    # ── EV fallback ───────────────────────────────────────────────────────────
    if ev is None and mc is not None:
        c  = cash_info or 0
        d  = debt_info or 0
        mi = _safe(info.get("minorityInterest")) or 0
        ps = _safe(info.get("preferredStock")) or 0
        ev = mc + d - c + mi + ps

    # ── EV/EBITDA fallback ────────────────────────────────────────────────────
    ev_to_ebitda = _safe(info.get("enterpriseToEbitda"))
    if ev_to_ebitda is None and ev is not None and ebitda_ttm and ebitda_ttm != 0:
        ev_to_ebitda = round(ev / ebitda_ttm, 2)

    # ── Revenue TTM ───────────────────────────────────────────────────────────
    rev_ttm = _safe(info.get("totalRevenue"))
    if rev_ttm is None:
        rev_series = _stmt_series(inc_a, "Total Revenue", "Revenue")
        if rev_series:
            rev_ttm = rev_series[-1][1]

    # ── Dividend yield (summary card) ─────────────────────────────────────────
    div_rate  = _safe(info.get("dividendRate"))
    cur_price = _safe(info.get("currentPrice") or info.get("regularMarketPrice"))
    if div_rate and cur_price and cur_price > 0:
        div_yield = div_rate / cur_price
    else:
        raw = _safe(info.get("dividendYield"))
        if raw is not None and raw > 1:
            raw = raw / 100
        div_yield = raw if raw is not None and raw < 0.25 else None

    summary = {
        # Valuation
        "market_cap":          mc,
        "enterprise_value":    ev,
        "pe_ttm":              _safe(info.get("trailingPE")),
        "pe_forward":          _safe(info.get("forwardPE")),
        "peg_ratio":           _safe(info.get("pegRatio")),
        "price_to_sales":      _safe(info.get("priceToSalesTrailing12Months")),
        "price_to_book":       _safe(info.get("priceToBook")),
        "ev_to_ebitda":        ev_to_ebitda,
        "ev_to_revenue":       _safe(info.get("enterpriseToRevenue")),
        "fcf_yield":           round(fcf_ttm / mc * 100, 2)
                               if fcf_ttm and mc and mc > 0 else None,
        # Margins & Growth
        "profit_margin":       _safe(info.get("profitMargins")),
        "operating_margin":    _safe(info.get("operatingMargins")),
        "gross_margin":        _safe(info.get("grossMargins")),
        "ebitda_margin":       None,
        "return_on_equity":    _safe(info.get("returnOnEquity")),
        "return_on_assets":    _safe(info.get("returnOnAssets")),
        "revenue_growth_yoy":  _safe(info.get("revenueGrowth")),
        "earnings_growth_yoy": _safe(info.get("earningsGrowth")),
        # Cash Flow
        "revenue_ttm":         rev_ttm,
        "ebitda_ttm":          ebitda_ttm,
        "fcf_ttm":             fcf_ttm,
        "eps_ttm":             _safe(info.get("trailingEps")),
        "eps_forward":         _safe(info.get("forwardEps")),
        # Balance
        "cash":                cash_info,
        "total_debt":          debt_info,
        "net_cash":            (cash_info - debt_info)
                               if cash_info is not None and debt_info is not None else None,
        # Dividend
        "dividend_yield":      div_yield,
        "dividend_rate":       _safe(info.get("dividendRate")),
        "payout_ratio":        _safe(info.get("payoutRatio")),
        "ex_dividend_date":    str(info.get("exDividendDate", "")),
        # Market data
        "beta":                _safe(info.get("beta")),
        "52w_high":            _safe(info.get("fiftyTwoWeekHigh")),
        "52w_low":             _safe(info.get("fiftyTwoWeekLow")),
        "50d_avg":             _safe(info.get("fiftyDayAverage")),
        "200d_avg":            _safe(info.get("twoHundredDayAverage")),
        "shares_outstanding":  _safe(info.get("sharesOutstanding")),
        "float_shares":        _safe(info.get("floatShares")),
        "short_ratio":         _safe(info.get("shortRatio")),
        "short_pct_float":     _safe(info.get("shortPercentOfFloat")),
        # Analyst
        "target_mean":         _safe(info.get("targetMeanPrice")),
        "target_low":          _safe(info.get("targetLowPrice")),
        "target_high":         _safe(info.get("targetHighPrice")),
        "num_analysts":        info.get("numberOfAnalystOpinions"),
        "recommendation":      info.get("recommendationKey"),
        # Company
        "sector":              info.get("sector"),
        "industry":            info.get("industry"),
        "employees":           info.get("fullTimeEmployees"),
        "book_value":          _safe(info.get("bookValue")),
    }

    # ── Derived metrics ───────────────────────────────────────────────────────

    if rev_ttm and ebitda_ttm and rev_ttm > 0:
        summary["ebitda_margin"] = round(ebitda_ttm / rev_ttm * 100, 2)

    if not summary["ev_to_revenue"] and ev is not None and rev_ttm and rev_ttm > 0:
        summary["ev_to_revenue"] = round(ev / rev_ttm, 2)

    net_debt = (debt_info or 0) - (cash_info or 0)
    summary["net_debt_to_ebitda"] = (
        round(net_debt / ebitda_ttm, 2) if ebitda_ttm and ebitda_ttm > 0 else None
    )

    ebit_series = _stmt_series(inc_a, "Operating Income", "EBIT")
    ebit_ttm    = ebit_series[-1][1] if ebit_series else None
    int_series  = _stmt_series(inc_a, "Interest Expense", "Interest Expense Non Operating")
    int_ttm     = abs(int_series[-1][1]) if int_series else None
    summary["interest_coverage"] = (
        round(ebit_ttm / int_ttm, 1) if ebit_ttm and int_ttm and int_ttm > 0 else None
    )

    summary["ev_to_fcf"]    = round(ev / fcf_ttm, 1)    if ev and fcf_ttm and fcf_ttm > 0 else None
    summary["price_to_fcf"] = round(mc / fcf_ttm, 1)    if mc and fcf_ttm and fcf_ttm > 0 else None

    tax_rate      = None
    tax_series    = _stmt_series(inc_a, "Tax Provision", "Income Tax Expense")
    pretax_series = _stmt_series(inc_a, "Pretax Income", "Income Before Tax")
    if tax_series and pretax_series:
        t, pt = tax_series[-1][1], pretax_series[-1][1]
        if pt and pt > 0:
            tax_rate = t / pt
    equity_bs = _bs_val(bs_a, "Stockholders Equity", "Common Stock Equity")
    if ebit_ttm and tax_rate is not None and equity_bs is not None:
        nopat        = ebit_ttm * (1 - tax_rate)
        invested_cap = (equity_bs or 0) + (debt_info or 0) - (cash_info or 0)
        summary["roic"] = round(nopat / invested_cap * 100, 2) if invested_cap > 0 else None
    else:
        summary["roic"] = None

    sbc_series = _stmt_series(cf_a, "Stock Based Compensation")
    sbc_ttm    = sbc_series[-1][1] if sbc_series else None
    summary["sbc_to_fcf"] = (
        round(abs(sbc_ttm) / fcf_ttm * 100, 1) if sbc_ttm and fcf_ttm and fcf_ttm > 0 else None
    )

    employees = info.get("fullTimeEmployees")
    summary["revenue_per_employee"] = (
        round(rev_ttm / employees) if rev_ttm and employees and employees > 0 else None
    )

    shares_series = _stmt_series(bs_a, "Share Issued", "Ordinary Shares Number")
    if len(shares_series) >= 2:
        cur_sh, prev_sh = shares_series[-1][1], shares_series[-2][1]
        summary["shares_yoy_change"] = (
            round((cur_sh - prev_sh) / prev_sh * 100, 2) if prev_sh and prev_sh > 0 else None
        )
    else:
        summary["shares_yoy_change"] = None

    # ── Build dividend history ────────────────────────────────────────────────
    div_a = build_dividends(cf_a, inc_a, ticker, quarterly=False)
    div_q = build_dividends(cf_q, inc_q, ticker, quarterly=True)

    return {
        "symbol":               symbol.upper(),
        "company_name":         info.get("longName") or info.get("shortName"),
        "current_price":        _safe(info.get("currentPrice")
                                      or info.get("regularMarketPrice")),
        "currency":             info.get("currency", "USD"),
        "exchange":             info.get("exchange"),
        "summary":              summary,
        "income_annual":        build_income(inc_a, quarterly=False),
        "income_quarterly":     build_income(inc_q, quarterly=True),
        "cashflow_annual":      build_cashflow(cf_a, quarterly=False),
        "cashflow_quarterly":   build_cashflow(cf_q, quarterly=True),
        "balance_annual":       build_balance(bs_a, quarterly=False),
        "balance_quarterly":    build_balance(bs_q, quarterly=True),
        "dividend_annual":      div_a,
        "dividend_quarterly":   div_q,
    }