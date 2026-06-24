#!/usr/bin/env python3
"""PushPlus buy-signal alert for A-share trend rules.

Default targets are 国投中鲁 (600962) and 飞龙股份 (002536). The rule is
intentionally simple and matches the manual discipline used in this repository:

- latest price is above the 20-day moving average
- the 20-day moving average is flat or rising
- latest price is above the 60-day moving average

This script only sends observation alerts. It does not place trades and does
not constitute investment advice.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SINA_QUOTE_URL = "https://hq.sinajs.cn/list={symbol}"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
PUSHPLUS_URL = "http://www.pushplus.plus/send"
DEFAULT_CODE = "600962"
DEFAULT_ALIAS = "国投中鲁"
DEFAULT_STATE_FILE = ".stock_buy_alert_state.json"


@dataclass(frozen=True)
class WatchTarget:
    code: str
    alias: str


DEFAULT_WATCHLIST = (
    WatchTarget(code="600962", alias="国投中鲁"),
    WatchTarget(code="002536", alias="飞龙股份"),
)


@dataclass(frozen=True)
class Quote:
    code: str
    name: str
    current_price: float
    previous_close: float
    high: float
    low: float
    volume: int
    amount: float
    date: dt.date | None
    time: str

    @property
    def change_percent(self) -> float:
        if self.previous_close <= 0:
            return 0.0
        return (self.current_price - self.previous_close) / self.previous_close * 100


@dataclass(frozen=True)
class DailyBar:
    date: dt.date
    close: float
    volume: int


@dataclass(frozen=True)
class SignalSnapshot:
    code: str
    name: str
    price: float
    ma20: float
    prev_ma20: float
    ma60: float
    change_percent: float
    quote_date: dt.date
    quote_time: str
    triggered: bool
    reasons: list[str]


def market_symbol(code: str) -> str:
    if code.startswith(("5", "6", "9")):
        return f"sh{code}"
    if code.startswith(("0", "1", "2", "3")):
        return f"sz{code}"
    raise ValueError(f"Cannot infer market for stock code: {code}")


def yahoo_symbol(code: str) -> str:
    if code.startswith(("5", "6", "9")):
        return f"{code}.SS"
    if code.startswith(("0", "1", "2", "3")):
        return f"{code}.SZ"
    raise ValueError(f"Cannot infer Yahoo market for stock code: {code}")


def fetch_sina_quote(code: str) -> Quote:
    request = urllib.request.Request(
        SINA_QUOTE_URL.format(symbol=market_symbol(code)),
        headers={
            "Referer": "https://finance.sina.com.cn/",
            "User-Agent": "Mozilla/5.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = response.read().decode("gbk", errors="replace")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Failed to fetch Sina quote: {exc}") from exc

    _, _, raw_values = payload.partition("=")
    values = raw_values.strip().strip('";').split(",")
    if len(values) < 32 or not values[0]:
        raise RuntimeError(f"Sina returned no quote data for {code}")

    return Quote(
        code=code,
        name=values[0],
        current_price=parse_float(values[3]),
        previous_close=parse_float(values[2]),
        high=parse_float(values[4]),
        low=parse_float(values[5]),
        volume=parse_int(values[8]),
        amount=parse_float(values[9]),
        date=parse_date(values[30]),
        time=values[31],
    )


def fetch_daily_bars(code: str, lookback_days: int = 420) -> list[DailyBar]:
    end = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)
    start = end - dt.timedelta(days=lookback_days)
    params = urllib.parse.urlencode(
        {
            "period1": int(start.timestamp()),
            "period2": int(end.timestamp()),
            "interval": "1d",
            "events": "history",
        }
    )
    request = urllib.request.Request(
        f"{YAHOO_CHART_URL.format(symbol=urllib.parse.quote(yahoo_symbol(code)))}?{params}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Failed to fetch Yahoo daily bars: {exc}") from exc

    result = payload.get("chart", {}).get("result")
    if not result:
        raise RuntimeError(f"Yahoo returned no daily bars for {code}")

    chart = result[0]
    timestamps = chart.get("timestamp") or []
    quote = (chart.get("indicators", {}).get("quote") or [{}])[0]
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    bars: list[DailyBar] = []
    for index, timestamp in enumerate(timestamps):
        if index >= len(closes) or closes[index] is None:
            continue
        trade_date = dt.datetime.fromtimestamp(timestamp, dt.timezone.utc).date()
        volume = volumes[index] if index < len(volumes) and volumes[index] else 0
        bars.append(DailyBar(date=trade_date, close=float(closes[index]), volume=int(volume)))

    if len(bars) < 61:
        raise RuntimeError(f"Need at least 61 daily bars, got {len(bars)} for {code}")
    return bars


def evaluate_signal(code: str, alias: str | None = None) -> SignalSnapshot:
    quote = fetch_sina_quote(code)
    bars = fetch_daily_bars(code)
    bars = merge_realtime_quote(bars, quote)
    closes = [bar.close for bar in bars]

    ma20 = moving_average(closes, 20)
    prev_ma20 = moving_average(closes[:-1], 20)
    ma60 = moving_average(closes, 60)
    price = closes[-1]

    reasons: list[str] = []
    if price > ma20:
        reasons.append("价格站上20日线")
    else:
        reasons.append("价格未站上20日线")

    if ma20 >= prev_ma20:
        reasons.append("20日线走平/向上")
    else:
        reasons.append("20日线仍向下")

    if price > ma60:
        reasons.append("价格站上60日线")
    else:
        reasons.append("价格未站上60日线")

    triggered = price > ma20 and ma20 >= prev_ma20 and price > ma60
    quote_date = quote.date or bars[-1].date

    return SignalSnapshot(
        code=code,
        name=quote.name or alias or code,
        price=price,
        ma20=ma20,
        prev_ma20=prev_ma20,
        ma60=ma60,
        change_percent=quote.change_percent,
        quote_date=quote_date,
        quote_time=quote.time,
        triggered=triggered,
        reasons=reasons,
    )


def merge_realtime_quote(bars: list[DailyBar], quote: Quote) -> list[DailyBar]:
    if quote.current_price <= 0 or quote.date is None:
        return bars

    merged = list(bars)
    latest = merged[-1]
    if latest.date == quote.date:
        merged[-1] = DailyBar(date=quote.date, close=quote.current_price, volume=quote.volume)
    elif latest.date < quote.date:
        merged.append(DailyBar(date=quote.date, close=quote.current_price, volume=quote.volume))
    return merged


def moving_average(values: list[float], window: int) -> float:
    if len(values) < window:
        raise RuntimeError(f"Need at least {window} values to calculate moving average")
    return sum(values[-window:]) / window


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


def parse_date(value: str) -> dt.date | None:
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        return None


def build_message(snapshot: SignalSnapshot) -> str:
    status = "触发买入观察信号" if snapshot.triggered else "尚未触发买入观察信号"
    return "\n".join(
        [
            f"### {snapshot.name}({snapshot.code}) {status}",
            "",
            f"- 最新价: {snapshot.price:.2f}",
            f"- 当日涨跌幅: {snapshot.change_percent:+.2f}%",
            f"- 20日线: {snapshot.ma20:.2f}",
            f"- 前一日20日线: {snapshot.prev_ma20:.2f}",
            f"- 60日线: {snapshot.ma60:.2f}",
            f"- 行情时间: {snapshot.quote_date} {snapshot.quote_time}",
            f"- 规则结果: {'；'.join(snapshot.reasons)}",
            "",
            "仅作观察提醒，不构成投资建议，也不会自动交易。",
        ]
    )


def build_combined_message(snapshots: list[SignalSnapshot]) -> str:
    return "\n\n---\n\n".join(build_message(snapshot) for snapshot in snapshots)


def send_pushplus(token: str, title: str, content: str) -> None:
    payload = json.dumps(
        {
            "token": token,
            "title": title,
            "content": content,
            "template": "markdown",
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        PUSHPLUS_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Failed to send PushPlus message: {exc}") from exc

    try:
        result: dict[str, Any] = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"PushPlus returned non-JSON response: {body}") from exc

    if result.get("code") not in (200, "200"):
        raise RuntimeError(f"PushPlus send failed: {result}")


def already_sent(state_file: Path, alert_key: str) -> bool:
    if not state_file.exists():
        return False
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return alert_key in state.get("sent_alerts", [])


def mark_sent(state_file: Path, alert_key: str) -> None:
    state = {"sent_alerts": []}
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            state = {"sent_alerts": []}
    alerts = list(dict.fromkeys([*state.get("sent_alerts", []), alert_key]))
    state_file.write_text(
        json.dumps({"sent_alerts": alerts[-200:]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send PushPlus alert when an A-share buy signal triggers.")
    parser.add_argument(
        "--code",
        help=(
            "Watch a single stock code instead of the default watchlist "
            f"({DEFAULT_CODE}/{DEFAULT_ALIAS}, 002536/飞龙股份)."
        ),
    )
    parser.add_argument("--alias", help="Display name for --code.")
    parser.add_argument(
        "--token",
        default=os.environ.get("PUSHPLUS_TOKEN"),
        help="PushPlus token. Prefer setting PUSHPLUS_TOKEN in the environment.",
    )
    parser.add_argument(
        "--state-file",
        default=DEFAULT_STATE_FILE,
        help="Local JSON file used to avoid duplicate alerts on the same trading day.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the alert content without sending PushPlus.")
    parser.add_argument(
        "--notify-when-inactive",
        action="store_true",
        help="Also push a message when the signal has not triggered. Useful for testing.",
    )
    parser.add_argument("--force", action="store_true", help="Ignore duplicate-alert state and send again.")
    return parser.parse_args()


def resolve_watchlist(args: argparse.Namespace) -> list[WatchTarget]:
    if args.code:
        return [WatchTarget(code=args.code, alias=args.alias or args.code)]
    return list(DEFAULT_WATCHLIST)


def main() -> int:
    args = parse_args()
    targets = resolve_watchlist(args)

    snapshots: list[SignalSnapshot] = []
    errors: list[str] = []
    for target in targets:
        try:
            snapshots.append(evaluate_signal(target.code, target.alias))
        except (RuntimeError, ValueError) as exc:
            errors.append(f"{target.alias}({target.code}): {exc}")

    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
    if not snapshots:
        return 1

    content = build_combined_message(snapshots)
    print(content)

    notify_snapshots = snapshots if args.notify_when_inactive else [snapshot for snapshot in snapshots if snapshot.triggered]
    if not notify_snapshots:
        print("未触发提醒条件，不推送。")
        return 0

    state_file = Path(args.state_file)
    notify_items = [
        (snapshot, f"{snapshot.code}:{snapshot.quote_date}:buy-signal:{snapshot.triggered}")
        for snapshot in notify_snapshots
    ]
    unsent_items = [
        (snapshot, alert_key)
        for snapshot, alert_key in notify_items
        if args.force or not already_sent(state_file, alert_key)
    ]
    if not unsent_items:
        print("今天已经推送过本次提醒。")
        return 0

    if args.dry_run:
        print("dry-run 模式，不发送 PushPlus。")
        return 0

    if not args.token:
        print("error: missing PushPlus token. Set PUSHPLUS_TOKEN or pass --token.", file=sys.stderr)
        return 1

    try:
        unsent_snapshots = [snapshot for snapshot, _ in unsent_items]
        push_title = "股票提醒: " + "、".join(
            f"{snapshot.name}({snapshot.code})" for snapshot in unsent_snapshots
        )
        push_content = build_combined_message(unsent_snapshots)
        send_pushplus(args.token, push_title, push_content)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    for _, alert_key in unsent_items:
        mark_sent(state_file, alert_key)
    print("PushPlus 推送已发送。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
