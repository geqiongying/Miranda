#!/usr/bin/env python3
"""Push a daily home-cooking menu to WeChat via PushPlus.

This is separate from the stock close alert and the stock observation list.
It plans breakfast / lunch / dinner from cook_dishes.json using the calendar
date as a seed, so the same day always gets the same menu.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

from stock_buy_alert import send_pushplus

DEFAULT_DISH_FILE = "cook_dishes.json"
WEEKDAYS = "一二三四五六日"


def load_dishes(path: Path) -> dict[str, list[dict[str, Any]]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    required = ("breakfast", "meat", "vegetable", "staple", "soup")
    missing = [key for key in required if not data.get(key)]
    if missing:
        raise RuntimeError(f"{path} missing dish groups: {', '.join(missing)}")
    return data


def pick(items: list[dict[str, Any]], seed: str, offset: int = 0) -> dict[str, Any]:
    digest = hashlib.sha256(f"{seed}:{offset}".encode("utf-8")).hexdigest()
    index = int(digest[:8], 16) % len(items)
    return items[index]


def pick_unique(
    items: list[dict[str, Any]],
    seed: str,
    used_names: set[str],
    *,
    avoid_protein: str | None = None,
    start: int = 0,
) -> dict[str, Any]:
    for offset in range(start, start + max(len(items) * 2, 8)):
        candidate = pick(items, seed, offset)
        if candidate["name"] in used_names:
            continue
        if avoid_protein and candidate.get("protein") == avoid_protein:
            continue
        return candidate
    return pick(items, seed, start)


def format_dish(dish: dict[str, Any], heading: str) -> str:
    ingredients = "、".join(dish.get("ingredients") or [])
    steps = dish.get("steps") or []
    step_text = " ".join(f"{index}. {step}" for index, step in enumerate(steps, start=1))
    time_note = dish.get("time") or ""
    title = f"**{heading}：{dish['name']}**"
    if time_note:
        title += f"（约 {time_note}）"
    lines = [title]
    if ingredients:
        lines.append(f"食材：{ingredients}")
    if step_text:
        lines.append(f"做法：{step_text}")
    lines.append("")
    return "\n".join(lines)


def shopping_list(dishes: list[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    skip = {"盐", "糖", "生抽", "老抽", "醋", "料酒", "蚝油", "香油", "淀粉", "水淀粉", "白胡椒", "黑胡椒", "淀粉水"}
    for dish in dishes:
        for item in dish.get("ingredients") or []:
            name = item.split(" ")[0]
            if name in skip or name in seen:
                continue
            seen.add(name)
            ordered.append(item)
    return ordered


def build_menu(dishes: dict[str, list[dict[str, Any]]], day: dt.date) -> str:
    seed = day.isoformat()
    weekday = WEEKDAYS[day.weekday()]
    used: set[str] = set()

    breakfast = pick_unique(dishes["breakfast"], seed, used, start=0)
    used.add(breakfast["name"])

    lunch_meat = pick_unique(dishes["meat"], seed, used, start=10)
    used.add(lunch_meat["name"])
    lunch_veg = pick_unique(dishes["vegetable"], seed, used, start=20)
    used.add(lunch_veg["name"])
    rice = next((item for item in dishes["staple"] if item["name"] == "米饭"), None)
    lunch_staple = rice if rice is not None else pick_unique(dishes["staple"], seed, used, start=30)
    used.add(lunch_staple["name"])

    dinner_meat = pick_unique(
        dishes["meat"],
        seed,
        used,
        avoid_protein=str(lunch_meat.get("protein") or ""),
        start=40,
    )
    used.add(dinner_meat["name"])
    dinner_veg = pick_unique(dishes["vegetable"], seed, used, start=50)
    used.add(dinner_veg["name"])
    dinner_soup = pick_unique(dishes["soup"], seed, used, start=60)
    used.add(dinner_soup["name"])

    all_dishes = [
        breakfast,
        lunch_meat,
        lunch_veg,
        lunch_staple,
        dinner_meat,
        dinner_veg,
        dinner_soup,
    ]
    groceries = shopping_list(all_dishes)

    parts = [
        f"## Miranda 今日做饭菜单（{day.isoformat()} 周{weekday}）",
        "",
        "家常三餐，按当天日期固定，不是外卖推荐。",
        "",
        "### 早餐",
        format_dish(breakfast, "早"),
        "### 午餐",
        format_dish(lunch_meat, "荤"),
        format_dish(lunch_veg, "素"),
        format_dish(lunch_staple, "主食"),
        "### 晚餐",
        format_dish(dinner_meat, "荤"),
        format_dish(dinner_veg, "素"),
        format_dish(dinner_soup, "汤"),
        "### 采购备忘",
        "、".join(groceries) if groceries else "冰箱里的常备调味即可。",
        "",
        "这是做饭菜单，不是股票名单。",
    ]
    return "\n".join(parts).strip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send Miranda's daily cooking menu via PushPlus.")
    parser.add_argument(
        "--token",
        default=os.getenv("PUSHPLUS_TOKEN"),
        help="PushPlus token. Defaults to PUSHPLUS_TOKEN.",
    )
    parser.add_argument(
        "--dishes",
        default=DEFAULT_DISH_FILE,
        help="JSON file of breakfast/meat/vegetable/staple/soup dishes.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the menu without sending.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        dishes = load_dishes(Path(args.dishes))
        content = build_menu(dishes, dt.date.today())
    except (OSError, json.JSONDecodeError, RuntimeError) as exc:
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
        send_pushplus(args.token, "今日做饭菜单", content)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print("PushPlus 做饭菜单已发送。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
