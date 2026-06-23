#!/usr/bin/env python3
"""Terminal alert monitor for A-share holdings.

The monitor polls the public quote endpoint used by stock_watch.py and prints
terminal alerts when configured rules are triggered. It is an observation aid,
not a trading system.
"""

from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass
from datetime import datetime

from stock_watch import DEFAULT_HOLDINGS, Holding, Quote, fetch_sina_quotes, load_holdings


DEFAULT_INTERVAL_SECONDS = 60
DEFAULT_COOLDOWN_SECONDS = 15 * 60


@dataclass(frozen=True)
class AlertRule:
    code: str
    price_below: float | None = None
    price_above: float | None = None
    daily_drop_percent: float | None = None
    daily_rise_percent: float | None = None
    profit_loss_percent: float | None = None
    profit_gain_percent: float | None = None
    st_notice: bool = False


def default_rules(holdings: list[Holding]) -> dict[str, AlertRule]:
    rules: dict[str, AlertRule] = {}
    for holding in holdings:
        rules[holding.code] = AlertRule(
            code=holding.code,
            price_below=holding.cost,
            daily_drop_percent=-5,
            daily_rise_percent=5,
        )

    rules["002214"] = AlertRule(
        code="002214",
        price_below=15.0,
        daily_drop_percent=-3,
        profit_loss_percent=-30,
        st_notice=True,
    )
    rules["300604"] = AlertRule(
        code="300604",
        price_below=196.9961,
        daily_drop_percent=-5,
        profit_gain_percent=30,
    )
    return rules


def evaluate_alerts(holding: Holding, quote: Quote | None, rule: AlertRule | None) -> list[str]:
    if quote is None:
        return [f"{holding.alias or holding.code} 行情缺失，无法监测"]

    cost_value = holding.cost * holding.shares
    market_value = quote.current_price * holding.shares
    profit = market_value - cost_value
    profit_percent = 0.0 if cost_value == 0 else profit / cost_value * 100
    alerts: list[str] = []

    if rule is None:
        rule = AlertRule(code=holding.code)

    name = quote.name or holding.alias or holding.code
    if rule.price_below is not None and quote.current_price <= rule.price_below:
        alerts.append(
            f"{name} 当前价 {quote.current_price:.2f}，触发价格下限 {rule.price_below:.2f}"
        )
    if rule.price_above is not None and quote.current_price >= rule.price_above:
        alerts.append(
            f"{name} 当前价 {quote.current_price:.2f}，触发价格上限 {rule.price_above:.2f}"
        )
    if rule.daily_drop_percent is not None and quote.change_percent <= rule.daily_drop_percent:
        alerts.append(
            f"{name} 当日跌幅 {quote.change_percent:.2f}%，达到 {rule.daily_drop_percent:.2f}% 提醒线"
        )
    if rule.daily_rise_percent is not None and quote.change_percent >= rule.daily_rise_percent:
        alerts.append(
            f"{name} 当日涨幅 {quote.change_percent:.2f}%，达到 +{rule.daily_rise_percent:.2f}% 提醒线"
        )
    if rule.profit_loss_percent is not None and profit_percent <= rule.profit_loss_percent:
        alerts.append(
            f"{name} 当前浮盈亏 {profit:+,.2f}，收益率 {profit_percent:.2f}%，达到亏损复盘线"
        )
    if rule.profit_gain_percent is not None and profit_percent >= rule.profit_gain_percent:
        alerts.append(
            f"{name} 当前浮盈 {profit:+,.2f}，收益率 {profit_percent:.2f}%，关注盈利保护"
        )
    if rule.st_notice and ("ST" in name.upper() or "ST" in (holding.alias or "").upper()):
        alerts.append(f"{name} 为 ST 风险持仓，优先查看公告、退市风险和重整进展")

    return alerts


def print_snapshot(holdings: list[Holding], quotes: dict[str, Quote]) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{now}] 行情检查")
    for holding in holdings:
        quote = quotes.get(holding.code)
        if quote is None:
            print(f"- {holding.alias or holding.code}: 行情缺失")
            continue
        cost_value = holding.cost * holding.shares
        market_value = quote.current_price * holding.shares
        profit = market_value - cost_value
        profit_percent = 0.0 if cost_value == 0 else profit / cost_value * 100
        print(
            f"- {quote.name or holding.alias or holding.code} {holding.code}: "
            f"现价 {quote.current_price:.2f}, 涨跌幅 {quote.change_percent:+.2f}%, "
            f"浮盈亏 {profit:+,.2f} ({profit_percent:+.2f}%)"
        )


def alert_key(code: str, message: str) -> str:
    return f"{code}:{message}"


def run_check(
    holdings: list[Holding],
    rules: dict[str, AlertRule],
    *,
    cooldown_seconds: int,
    last_alerted_at: dict[str, float],
    show_snapshot: bool,
    bell: bool,
) -> int:
    quotes = fetch_sina_quotes(item.code for item in holdings)
    if show_snapshot:
        print_snapshot(holdings, quotes)

    alert_count = 0
    now = time.time()
    for holding in holdings:
        alerts = evaluate_alerts(holding, quotes.get(holding.code), rules.get(holding.code))
        for message in alerts:
            key = alert_key(holding.code, message)
            last_time = last_alerted_at.get(key, 0)
            if now - last_time < cooldown_seconds:
                continue
            last_alerted_at[key] = now
            alert_count += 1
            prefix = "\a[提醒]" if bell else "[提醒]"
            print(f"{prefix} {message}")

    if alert_count == 0:
        print("[状态] 暂无新提醒")
    sys.stdout.flush()
    return alert_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Monitor A-share holdings and print terminal alerts.")
    parser.add_argument(
        "--holdings",
        help="Optional CSV or JSON file. Required fields: code, shares, cost; optional: alias.",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_INTERVAL_SECONDS,
        help=f"Polling interval in seconds. Default: {DEFAULT_INTERVAL_SECONDS}.",
    )
    parser.add_argument(
        "--cooldown",
        type=int,
        default=DEFAULT_COOLDOWN_SECONDS,
        help=f"Seconds before repeating the same alert. Default: {DEFAULT_COOLDOWN_SECONDS}.",
    )
    parser.add_argument("--once", action="store_true", help="Run one check and exit.")
    parser.add_argument("--no-snapshot", action="store_true", help="Only print alerts, not the quote snapshot.")
    parser.add_argument("--bell", action="store_true", help="Emit a terminal bell when an alert fires.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    holdings = load_holdings(args.holdings) if args.holdings else DEFAULT_HOLDINGS
    rules = default_rules(holdings)
    last_alerted_at: dict[str, float] = {}

    print("Stock alert monitor started.")
    print(f"Polling interval: {max(args.interval, 1)} seconds")
    print("Press Ctrl+C to stop.")
    try:
        while True:
            try:
                run_check(
                    holdings,
                    rules,
                    cooldown_seconds=max(args.cooldown, 0),
                    last_alerted_at=last_alerted_at,
                    show_snapshot=not args.no_snapshot,
                    bell=args.bell,
                )
            except Exception as exc:
                print(f"[错误] 行情检查失败: {exc}", file=sys.stderr)
                sys.stderr.flush()
                if args.once:
                    return 1

            if args.once:
                return 0
            time.sleep(max(args.interval, 1))
    except KeyboardInterrupt:
        print("\nStock alert monitor stopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
