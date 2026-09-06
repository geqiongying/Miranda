#!/usr/bin/env python3
"""PushPlus daily observation menu for Miranda.

This is the second WeChat message, separate from the close-alert watchlist.
It ranks a short-term and mid-term observation menu from public A-share
quotes. It is not a buy list and does not constitute investment advice.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys

from stock_buy_alert import send_pushplus
from steady_stock_screener import (
    PROFILES,
    ScreeningProfile,
    ScoredStock,
    fetch_a_share_universe,
    parse_excluded_codes,
    rank_stocks,
)

MENU_PROFILES = ("short", "mid")
DEFAULT_LIMIT = 5
DEFAULT_MAX_PAGES = 8


def format_section(profile: ScreeningProfile, ranked: list[ScoredStock], limit: int) -> str:
    lines = [
        f"### {profile.title}",
        f"观察周期：{profile.holding_period}",
        "",
    ]
    if not ranked:
        lines.append("今日没有符合条件的观察票。")
        lines.append("")
        return "\n".join(lines)

    for index, item in enumerate(ranked[:limit], start=1):
        stock = item.stock
        cap_yi = stock.total_market_cap / 100_000_000
        reason = "；".join(item.signals[:3])
        lines.append(
            f"{index}. **{stock.name}** `{stock.code}`  "
            f"{stock.price:.2f}  {stock.change_percent:+.2f}%"
        )
        lines.append(
            f"   分数 {item.score} · 市值 {cap_yi:,.0f}亿 · "
            f"PE {stock.pe_ttm:.1f} · {reason}"
        )
        lines.append("")
    return "\n".join(lines)


def build_menu(limit: int, max_pages: int) -> str:
    today = dt.date.today().isoformat()
    stocks = fetch_a_share_universe(max_pages=max(max_pages, 1))
    excluded = parse_excluded_codes(None)

    parts = [
        f"## Miranda 每日观察菜单（{today}）",
        "",
        "这是观察名单，不是买入指令，也不构成投资建议。",
        "完整教学规则请到网站量能台 / 五哥台再核对。",
        "",
    ]
    for key in MENU_PROFILES:
        profile = PROFILES[key]
        ranked = rank_stocks(stocks, profile=profile, excluded_codes=excluded)
        parts.append(format_section(profile, ranked, limit))
    parts.append("公开行情可能延迟。买卖前打开券商软件核对。")
    return "\n".join(parts).strip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send Miranda's daily observation menu via PushPlus.")
    parser.add_argument(
        "--token",
        default=os.getenv("PUSHPLUS_TOKEN"),
        help="PushPlus token. Defaults to the PUSHPLUS_TOKEN environment variable.",
    )
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Names per section. Default: 5.")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help="Quote-list pages to fetch, sorted by market cap. Default: 8.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the menu without sending PushPlus.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        content = build_menu(max(args.limit, 1), args.max_pages)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(content)

    if args.dry_run:
        print("dry-run 模式，不发送 PushPlus。")
        return 0

    if not args.token:
        print("error: missing PushPlus token. Set PUSHPLUS_TOKEN or pass --token.", file=sys.stderr)
        return 1

    try:
        send_pushplus(args.token, "Miranda 每日观察菜单", content)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print("PushPlus 每日菜单已发送。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
