#!/usr/bin/env python3
"""Simple A-share quote watcher for a small holding list.

The script uses Sina's public quote endpoint. Public endpoints can be delayed
or temporarily unavailable, so treat the output as an observation aid rather
than an authoritative trading feed.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Iterable


SINA_QUOTE_URL = "https://hq.sinajs.cn/list={symbols}"


@dataclass(frozen=True)
class Holding:
    code: str
    shares: int
    cost: float
    alias: str | None = None


@dataclass(frozen=True)
class Quote:
    code: str
    name: str
    open_price: float
    previous_close: float
    current_price: float
    high: float
    low: float
    volume: int
    amount: float
    date: str
    time: str

    @property
    def change(self) -> float:
        return self.current_price - self.previous_close

    @property
    def change_percent(self) -> float:
        if self.previous_close == 0:
            return 0.0
        return self.change / self.previous_close * 100


DEFAULT_HOLDINGS = [
    Holding(code="688027", alias="国盾量子", shares=387, cost=520.1536),
    Holding(code="002214", alias="*ST大立", shares=4300, cost=22.9626),
    Holding(code="300604", alias="长川科技", shares=700, cost=196.9961),
]


def market_symbol(code: str) -> str:
    if code.startswith(("5", "6", "9")):
        return f"sh{code}"
    if code.startswith(("0", "1", "2", "3")):
        return f"sz{code}"
    raise ValueError(f"Cannot infer market for stock code: {code}")


def fetch_sina_quotes(codes: Iterable[str]) -> dict[str, Quote]:
    symbols = ",".join(market_symbol(code) for code in codes)
    request = urllib.request.Request(
        SINA_QUOTE_URL.format(symbols=symbols),
        headers={
            "Referer": "https://finance.sina.com.cn/",
            "User-Agent": "Mozilla/5.0",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = response.read().decode("gbk", errors="replace")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Failed to fetch quote data: {exc}") from exc

    quotes: dict[str, Quote] = {}
    for line in payload.splitlines():
        if not line.strip():
            continue
        prefix, _, raw_values = line.partition("=")
        symbol = prefix.rsplit("_", 1)[-1]
        code = symbol[-6:]
        values = raw_values.strip().strip('";').split(",")
        if len(values) < 32 or not values[0]:
            continue

        quotes[code] = Quote(
            code=code,
            name=values[0],
            open_price=parse_float(values[1]),
            previous_close=parse_float(values[2]),
            current_price=parse_float(values[3]),
            high=parse_float(values[4]),
            low=parse_float(values[5]),
            volume=parse_int(values[8]),
            amount=parse_float(values[9]),
            date=values[30],
            time=values[31],
        )

    return quotes


def parse_float(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return 0.0


def parse_int(value: str) -> int:
    try:
        return int(float(value))
    except ValueError:
        return 0


def risk_signals(holding: Holding, quote: Quote, profit_percent: float) -> list[str]:
    signals: list[str] = []

    if quote.current_price <= 0:
        return ["行情缺失"]

    if quote.current_price < holding.cost:
        signals.append("跌破成本")
    elif abs(quote.current_price - holding.cost) / holding.cost <= 0.02:
        signals.append("接近成本线")

    if profit_percent <= -30:
        signals.append("亏损超过30%，重点复盘")
    elif profit_percent >= 30:
        signals.append("浮盈超过30%，关注盈利保护")

    if quote.change_percent <= -5:
        signals.append("当日跌幅较大")
    elif quote.change_percent >= 5:
        signals.append("当日涨幅较大")

    if "ST" in quote.name.upper() or "ST" in (holding.alias or "").upper():
        signals.append("ST风险优先看公告")

    return signals or ["正常观察"]


def print_report(holdings: list[Holding], quotes: dict[str, Quote]) -> int:
    rows = []
    total_market_value = 0.0
    total_profit = 0.0

    for holding in holdings:
        quote = quotes.get(holding.code)
        if quote is None:
            rows.append(
                [
                    holding.alias or holding.code,
                    holding.code,
                    "-",
                    "-",
                    "-",
                    "-",
                    "-",
                    "行情缺失",
                ]
            )
            continue

        market_value = quote.current_price * holding.shares
        cost_value = holding.cost * holding.shares
        profit = market_value - cost_value
        profit_percent = 0.0 if cost_value == 0 else profit / cost_value * 100
        total_market_value += market_value
        total_profit += profit

        rows.append(
            [
                quote.name or holding.alias or holding.code,
                holding.code,
                f"{quote.current_price:.2f}",
                f"{quote.change_percent:+.2f}%",
                f"{market_value:,.2f}",
                f"{profit:+,.2f}",
                f"{profit_percent:+.2f}%",
                "；".join(risk_signals(holding, quote, profit_percent)),
            ]
        )

    total_cost = sum(item.cost * item.shares for item in holdings)
    total_profit_percent = 0.0 if total_cost == 0 else total_profit / total_cost * 100

    print_table(
        ["股票", "代码", "现价", "涨跌幅", "持仓市值", "浮盈亏", "收益率", "观察信号"],
        rows,
    )
    print()
    print(f"组合市值: {total_market_value:,.2f}")
    print(f"组合浮盈亏: {total_profit:+,.2f} ({total_profit_percent:+.2f}%)")

    dates = sorted(
        {f"{quote.date} {quote.time}" for quote in quotes.values() if quote.date and quote.time}
    )
    if dates:
        print(f"行情时间: {dates[-1]}")

    return 0


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


def load_holdings(path: str) -> list[Holding]:
    if path.endswith(".json"):
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return [
            Holding(
                code=str(item["code"]),
                alias=item.get("alias"),
                shares=int(item["shares"]),
                cost=float(item["cost"]),
            )
            for item in data
        ]

    with open(path, "r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [
            Holding(
                code=str(row["code"]),
                alias=row.get("alias") or None,
                shares=int(row["shares"]),
                cost=float(row["cost"]),
            )
            for row in reader
        ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Watch A-share quotes for configured holdings.")
    parser.add_argument(
        "--holdings",
        help="Optional CSV or JSON file. Required fields: code, shares, cost; optional: alias.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    holdings = load_holdings(args.holdings) if args.holdings else DEFAULT_HOLDINGS

    try:
        quotes = fetch_sina_quotes(item.code for item in holdings)
    except (RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    return print_report(holdings, quotes)


if __name__ == "__main__":
    raise SystemExit(main())
