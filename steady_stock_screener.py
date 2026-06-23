#!/usr/bin/env python3
"""A-share steady observation screener.

This screener pulls quote and basic valuation fields from Eastmoney's public
quote list endpoint, applies conservative filters, and ranks candidates for
further manual research. It does not produce buy/sell recommendations.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


EASTMONEY_LIST_URL = "https://push2.eastmoney.com/api/qt/clist/get"
DEFAULT_EXCLUDED_CODES = {"688027", "002214", "300604"}
DEFAULT_PAGE_SIZE = 100
DEFAULT_MAX_PAGES = 10
MAX_FETCH_RETRIES = 3


@dataclass(frozen=True)
class Stock:
    code: str
    name: str
    price: float
    change_percent: float
    turnover_rate: float
    volume_ratio: float
    pe_dynamic: float
    pe_ttm: float
    pb: float
    total_market_cap: float
    float_market_cap: float


@dataclass(frozen=True)
class ScoredStock:
    stock: Stock
    score: int
    signals: list[str]


def fetch_a_share_universe(
    page_size: int = DEFAULT_PAGE_SIZE,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> list[Stock]:
    stocks: list[Stock] = []
    page = 1
    total = None

    while page <= max_pages and (total is None or len(stocks) < total):
        payload = fetch_page(page, page_size)
        data = payload.get("data") or {}
        diff = data.get("diff") or []
        if total is None:
            total = int(data.get("total") or 0)
        if not diff:
            break

        stocks.extend(parse_stock(item) for item in diff)
        page += 1

    return stocks


def fetch_page(page: int, page_size: int) -> dict[str, Any]:
    params = {
        "pn": page,
        "pz": page_size,
        "po": 1,
        "np": 1,
        "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        "fltt": 2,
        "invt": 2,
        "fid": "f20",
        "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
        "fields": "f2,f3,f8,f9,f10,f12,f14,f20,f21,f23,f115",
    }
    url = f"{EASTMONEY_LIST_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url,
        headers={
            "Referer": "https://quote.eastmoney.com/",
            "User-Agent": "Mozilla/5.0",
        },
    )

    last_error: Exception | None = None
    for attempt in range(1, MAX_FETCH_RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response)
        except (urllib.error.URLError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < MAX_FETCH_RETRIES:
                time.sleep(2 ** (attempt - 1))

    raise RuntimeError(f"Failed to fetch Eastmoney stock list page {page}: {last_error}")


def parse_stock(item: dict[str, Any]) -> Stock:
    return Stock(
        code=str(item.get("f12") or ""),
        name=str(item.get("f14") or ""),
        price=as_float(item.get("f2")),
        change_percent=as_float(item.get("f3")),
        turnover_rate=as_float(item.get("f8")),
        volume_ratio=as_float(item.get("f10")),
        pe_dynamic=as_float(item.get("f9")),
        pe_ttm=as_float(item.get("f115")),
        pb=as_float(item.get("f23")),
        total_market_cap=as_float(item.get("f20")),
        float_market_cap=as_float(item.get("f21")),
    )


def as_float(value: Any) -> float:
    if value in (None, "-", ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def passes_conservative_filters(
    stock: Stock,
    *,
    min_market_cap: float,
    max_pe_ttm: float,
    max_pb: float,
    excluded_codes: set[str],
) -> bool:
    if stock.code in excluded_codes:
        return False
    if not stock.code or not stock.name or stock.price <= 0:
        return False
    if any(marker in stock.name.upper() for marker in ("ST", "退")):
        return False
    if stock.total_market_cap < min_market_cap:
        return False
    if stock.pe_ttm <= 0 or stock.pe_ttm > max_pe_ttm:
        return False
    if stock.pb <= 0 or stock.pb > max_pb:
        return False
    if abs(stock.change_percent) > 7:
        return False
    if stock.turnover_rate <= 0 or stock.turnover_rate > 8:
        return False
    if stock.volume_ratio <= 0 or stock.volume_ratio > 3:
        return False
    return True


def score_stock(stock: Stock) -> ScoredStock:
    score = 0
    signals: list[str] = []

    market_cap_100m = stock.total_market_cap / 100_000_000
    if market_cap_100m >= 1000:
        score += 25
        signals.append("超大市值")
    elif market_cap_100m >= 500:
        score += 21
        signals.append("大市值")
    elif market_cap_100m >= 300:
        score += 17
        signals.append("中大市值")
    else:
        score += 12
        signals.append("市值达标")

    if 8 <= stock.pe_ttm <= 25:
        score += 20
        signals.append("PE适中")
    elif 0 < stock.pe_ttm < 8:
        score += 14
        signals.append("PE较低，需查周期性")
    else:
        score += 10
        signals.append("PE偏高但未超阈值")

    if 0 < stock.pb <= 2:
        score += 15
        signals.append("PB较稳")
    elif stock.pb <= 3:
        score += 11
        signals.append("PB可接受")
    else:
        score += 7
        signals.append("PB偏高")

    abs_change = abs(stock.change_percent)
    if abs_change <= 2:
        score += 15
        signals.append("当日波动温和")
    elif abs_change <= 4:
        score += 11
        signals.append("当日波动可控")
    else:
        score += 6
        signals.append("当日波动偏大")

    if 0.5 <= stock.turnover_rate <= 3:
        score += 13
        signals.append("换手适中")
    elif stock.turnover_rate <= 5:
        score += 9
        signals.append("换手略高")
    else:
        score += 5
        signals.append("换手偏高")

    if 0.7 <= stock.volume_ratio <= 1.8:
        score += 12
        signals.append("量比平稳")
    elif stock.volume_ratio <= 2.5:
        score += 8
        signals.append("量比略高")
    else:
        score += 4
        signals.append("量比偏高")

    return ScoredStock(stock=stock, score=score, signals=signals)


def rank_stocks(
    stocks: list[Stock],
    *,
    min_market_cap: float,
    max_pe_ttm: float,
    max_pb: float,
    excluded_codes: set[str],
) -> list[ScoredStock]:
    filtered = [
        stock
        for stock in stocks
        if passes_conservative_filters(
            stock,
            min_market_cap=min_market_cap,
            max_pe_ttm=max_pe_ttm,
            max_pb=max_pb,
            excluded_codes=excluded_codes,
        )
    ]
    return sorted(
        (score_stock(stock) for stock in filtered),
        key=lambda item: (
            item.score,
            item.stock.total_market_cap,
            -abs(item.stock.change_percent),
        ),
        reverse=True,
    )


def print_report(items: list[ScoredStock], limit: int) -> None:
    rows = []
    for item in items[:limit]:
        stock = item.stock
        rows.append(
            [
                str(item.score),
                stock.name,
                stock.code,
                f"{stock.price:.2f}",
                f"{stock.change_percent:+.2f}%",
                f"{stock.total_market_cap / 100_000_000:,.0f}亿",
                f"{stock.pe_ttm:.2f}",
                f"{stock.pb:.2f}",
                f"{stock.turnover_rate:.2f}%",
                f"{stock.volume_ratio:.2f}",
                "；".join(item.signals[:4]),
            ]
        )

    print_table(
        ["分数", "股票", "代码", "现价", "涨跌幅", "总市值", "PE(TTM)", "PB", "换手", "量比", "观察理由"],
        rows,
    )
    print()
    print("说明: 分数越高表示越符合本模型的稳健观察条件，但仍需继续核对财报、行业景气度和公告风险。")


def print_table(headers: list[str], rows: list[list[str]]) -> None:
    widths = [
        max(display_width(row[index]) for row in [headers, *rows])
        for index in range(len(headers))
    ]
    print(" | ".join(pad_cell(header, widths[index]) for index, header in enumerate(headers)))
    print("-+-".join("-" * width for width in widths))
    for row in rows:
        print(" | ".join(pad_cell(cell, widths[index]) for index, cell in enumerate(row)))


def display_width(value: str) -> int:
    return sum(2 if ord(char) > 127 else 1 for char in value)


def pad_cell(value: str, width: int) -> str:
    return value + " " * (width - display_width(value))


def parse_excluded_codes(raw: str | None) -> set[str]:
    if raw is None:
        return set(DEFAULT_EXCLUDED_CODES)
    if not raw.strip():
        return set()
    return {item.strip() for item in raw.split(",") if item.strip()}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Screen A-share stocks for steady observation.")
    parser.add_argument("--limit", type=int, default=20, help="Number of candidates to display.")
    parser.add_argument(
        "--min-market-cap",
        type=float,
        default=30_000_000_000,
        help="Minimum total market cap in yuan. Default: 30,000,000,000.",
    )
    parser.add_argument("--max-pe-ttm", type=float, default=35, help="Maximum PE(TTM).")
    parser.add_argument("--max-pb", type=float, default=4, help="Maximum PB.")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help=(
            "Maximum quote-list pages to fetch, sorted by total market cap. "
            f"Default: {DEFAULT_MAX_PAGES} pages, about {DEFAULT_MAX_PAGES * DEFAULT_PAGE_SIZE} stocks."
        ),
    )
    parser.add_argument(
        "--exclude",
        help=(
            "Comma-separated stock codes to exclude. "
            "Default excludes the current holding list: 688027,002214,300604. "
            "Pass an empty string to disable."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        stocks = fetch_a_share_universe(max_pages=max(args.max_pages, 1))
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    ranked = rank_stocks(
        stocks,
        min_market_cap=args.min_market_cap,
        max_pe_ttm=args.max_pe_ttm,
        max_pb=args.max_pb,
        excluded_codes=parse_excluded_codes(args.exclude),
    )

    if not ranked:
        print("No stocks matched the current conservative filters.")
        return 0

    print_report(ranked, max(args.limit, 1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
