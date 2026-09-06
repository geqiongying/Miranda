#!/usr/bin/env python3
"""Daily home dinner menu push via PushPlus.

The script picks a four-person family dinner plan by date and sends it as a
Markdown message. It never stores the PushPlus token in code; set
PUSHPLUS_TOKEN in the environment or pass --token locally.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


PUSHPLUS_URL = "https://www.pushplus.plus/send"


@dataclass(frozen=True)
class Dish:
    name: str
    ingredients: tuple[str, ...]
    steps: tuple[str, ...]


@dataclass(frozen=True)
class MenuPlan:
    title: str
    note: str
    dishes: tuple[Dish, ...]
    soup: Dish | None
    prep_order: tuple[str, ...]


MENU_PLANS: tuple[MenuPlan, ...] = (
    MenuPlan(
        title="番茄牛腩家常餐",
        note="适合老人孩子，电压力锅做主菜，炒菜压力小。",
        dishes=(
            Dish(
                "番茄土豆牛腩",
                ("牛腩700g", "番茄3个", "土豆2个", "姜片", "生抽", "少量老抽"),
                ("牛腩焯水", "番茄炒出汁", "全部放入电压力锅炖肉模式", "开盖后按口味加盐"),
            ),
            Dish(
                "蘑菇炒鸡蛋",
                ("蘑菇300g", "鸡蛋4个", "葱花"),
                ("鸡蛋先炒熟盛出", "蘑菇炒软", "倒回鸡蛋，加盐和少量生抽"),
            ),
            Dish(
                "蒜蓉西兰花",
                ("西兰花1颗", "蒜末", "蚝油"),
                ("西兰花焯水", "蒜末爆香", "下西兰花快炒，加盐和蚝油"),
            ),
        ),
        soup=Dish(
            "紫菜蛋花汤",
            ("紫菜", "鸡蛋2个", "虾皮", "葱花"),
            ("水开下紫菜和虾皮", "淋入蛋液", "加盐和香油"),
        ),
        prep_order=("先压牛腩", "洗切蔬菜", "炒鸡蛋和青菜", "最后做汤"),
    ),
    MenuPlan(
        title="可乐鸡翅孩子餐",
        note="孩子通常接受度高，整体偏快手。",
        dishes=(
            Dish(
                "可乐鸡翅",
                ("鸡翅中14个", "可乐1罐", "姜片", "生抽", "老抽"),
                ("鸡翅划刀焯水", "煎到两面微黄", "加调料和可乐", "中火收汁"),
            ),
            Dish(
                "肉末豆腐",
                ("嫩豆腐2盒", "肉末150g", "葱姜蒜"),
                ("肉末炒香", "加豆腐和少量水", "生抽调味", "水淀粉勾薄芡"),
            ),
            Dish(
                "清炒油麦菜",
                ("油麦菜500g", "蒜末"),
                ("大火爆香蒜末", "下油麦菜快炒", "断生后加盐"),
            ),
        ),
        soup=Dish(
            "冬瓜虾皮汤",
            ("冬瓜400g", "虾皮", "葱花"),
            ("冬瓜切片煮软", "加虾皮和盐", "撒葱花"),
        ),
        prep_order=("先处理鸡翅", "炖鸡翅时做豆腐", "青菜最后炒", "汤可同时煮"),
    ),
    MenuPlan(
        title="清爽少油晚饭",
        note="适合天气热或前一天吃得比较油的时候。",
        dishes=(
            Dish(
                "虾仁滑蛋",
                ("虾仁300g", "鸡蛋5个", "白胡椒"),
                ("虾仁用盐和白胡椒抓匀", "鸡蛋打散", "虾仁炒变色后倒蛋液滑熟"),
            ),
            Dish(
                "莴笋炒肉片",
                ("莴笋2根", "瘦肉200g", "蒜片"),
                ("肉片用生抽和淀粉腌10分钟", "先炒肉片", "再炒莴笋后合炒"),
            ),
            Dish(
                "蚝油生菜",
                ("生菜2颗", "蒜末", "蚝油"),
                ("生菜焯水或快炒", "蚝油加少量水调汁", "淋汁"),
            ),
        ),
        soup=Dish(
            "番茄菌菇汤",
            ("番茄2个", "白玉菇1包", "鸡蛋1个"),
            ("番茄炒出汁", "加水和白玉菇", "水开后淋蛋液"),
        ),
        prep_order=("先腌肉片", "切莴笋和生菜", "先做汤底", "虾仁滑蛋最后出锅"),
    ),
    MenuPlan(
        title="排骨玉米电锅餐",
        note="主菜和汤合并，适合忙的时候。",
        dishes=(
            Dish(
                "排骨玉米胡萝卜汤",
                ("排骨800g", "玉米2根", "胡萝卜1根", "姜片"),
                ("排骨焯水", "全部放电压力锅", "选排骨/煲汤模式", "出锅加盐"),
            ),
            Dish(
                "青椒炒肉丝",
                ("青椒4个", "肉丝250g", "姜蒜"),
                ("肉丝用生抽和淀粉腌", "先炒肉丝", "再下青椒合炒"),
            ),
            Dish(
                "蒜香娃娃菜",
                ("娃娃菜2颗", "蒜末", "蚝油"),
                ("蒜末爆香", "下娃娃菜", "加盐和蚝油炒软"),
            ),
        ),
        soup=Dish(
            "电锅汤已包含",
            ("不用另备汤",),
            ("排骨玉米胡萝卜汤作为主菜兼汤",),
        ),
        prep_order=("先压排骨汤", "腌肉丝", "炒青椒肉丝", "娃娃菜最后炒"),
    ),
    MenuPlan(
        title="鱼香肉丝下饭餐",
        note="酸甜咸香，孩子能吃的话很下饭。",
        dishes=(
            Dish(
                "鱼香肉丝",
                ("里脊肉300g", "胡萝卜半根", "木耳", "青椒", "葱姜蒜"),
                ("肉丝腌10分钟", "调糖醋生抽淀粉汁", "先炒肉丝", "配菜炒软后合炒收汁"),
            ),
            Dish(
                "番茄炒蛋",
                ("番茄3个", "鸡蛋4个", "葱花"),
                ("鸡蛋先炒", "番茄炒出汁", "倒回鸡蛋，加盐和少量糖"),
            ),
            Dish(
                "清炒菠菜",
                ("菠菜500g", "蒜末"),
                ("菠菜焯水去草酸", "蒜末爆香后快炒", "加盐"),
            ),
        ),
        soup=Dish(
            "豆腐青菜汤",
            ("嫩豆腐1盒", "小青菜", "葱花"),
            ("水开下豆腐", "加青菜", "盐和香油调味"),
        ),
        prep_order=("泡木耳并腌肉", "先炒番茄蛋", "再做鱼香肉丝", "菠菜和汤最后做"),
    ),
    MenuPlan(
        title="鸡腿香菇焖饭餐",
        note="主食和主菜一起做，省锅省时间。",
        dishes=(
            Dish(
                "鸡腿香菇焖饭",
                ("鸡腿肉500g", "香菇8朵", "胡萝卜半根", "大米3杯"),
                ("鸡腿肉用生抽老抽腌", "香菇胡萝卜切丁", "和米一起入锅", "按煮饭模式"),
            ),
            Dish(
                "黄瓜拌腐竹",
                ("黄瓜2根", "腐竹", "蒜末"),
                ("腐竹泡软焯水", "黄瓜拍碎", "加生抽醋香油拌匀"),
            ),
            Dish(
                "蒜蓉空心菜",
                ("空心菜500g", "蒜末"),
                ("大火热油", "蒜末爆香", "空心菜快炒出锅"),
            ),
        ),
        soup=Dish(
            "裙带菜蛋汤",
            ("裙带菜", "鸡蛋2个", "葱花"),
            ("裙带菜泡发", "水开后下锅", "淋蛋液，加盐"),
        ),
        prep_order=("先腌鸡腿肉并煮焖饭", "泡腐竹", "拌凉菜", "炒空心菜和做汤"),
    ),
    MenuPlan(
        title="红烧肉少量解馋餐",
        note="红烧肉做少一点，配两个清爽菜平衡。",
        dishes=(
            Dish(
                "红烧肉鹌鹑蛋",
                ("五花肉500g", "鹌鹑蛋20个", "姜片", "冰糖", "生抽老抽"),
                ("五花肉焯水煸油", "炒糖色可省略", "加调料和水", "电压力锅炖肉模式"),
            ),
            Dish(
                "芹菜炒香干",
                ("芹菜400g", "香干4片", "蒜片"),
                ("香干切条", "芹菜切段", "先炒香干后下芹菜"),
            ),
            Dish(
                "凉拌西红柿",
                ("番茄3个", "少量白糖"),
                ("番茄切块", "按口味撒少量糖或不加糖"),
            ),
        ),
        soup=Dish(
            "丝瓜蛋汤",
            ("丝瓜2根", "鸡蛋2个"),
            ("丝瓜切滚刀", "煮软后淋蛋液", "加盐"),
        ),
        prep_order=("红烧肉先入电压力锅", "准备凉菜", "炒香干芹菜", "最后做丝瓜汤"),
    ),
    MenuPlan(
        title="四菜快手均衡餐",
        note="不单独做汤，四个菜口味分散，适合想多一点选择的时候。",
        dishes=(
            Dish(
                "葱油鸡腿",
                ("鸡腿4只", "小葱", "姜片", "生抽"),
                ("鸡腿煮熟或蒸熟", "撕块装盘", "淋热葱油和生抽"),
            ),
            Dish(
                "肉末茄子",
                ("茄子3根", "肉末150g", "蒜末", "生抽"),
                ("茄子切条蒸软或少油煎软", "肉末蒜末炒香", "下茄子调味收汁"),
            ),
            Dish(
                "蘑菇炒青菜",
                ("蘑菇300g", "小青菜500g", "蒜末"),
                ("蘑菇先炒软", "下青菜大火快炒", "加盐和少量蚝油"),
            ),
            Dish(
                "番茄炒蛋",
                ("番茄3个", "鸡蛋4个", "葱花"),
                ("鸡蛋先炒", "番茄炒出汁", "倒回鸡蛋调味"),
            ),
        ),
        soup=None,
        prep_order=("先蒸或煮鸡腿", "处理茄子和肉末", "炒肉末茄子", "最后做青菜和番茄蛋"),
    ),
    MenuPlan(
        title="周中省事四菜餐",
        note="不用电压力锅，基本都是快炒和凉拌，适合工作日中午收到后下班照着买菜。",
        dishes=(
            Dish(
                "黑椒杏鲍菇牛肉",
                ("牛肉片250g", "杏鲍菇2个", "洋葱半个", "黑胡椒"),
                ("牛肉用生抽淀粉腌10分钟", "杏鲍菇煎香", "合炒后加黑胡椒"),
            ),
            Dish(
                "虾仁豆腐",
                ("虾仁250g", "嫩豆腐2盒", "葱姜"),
                ("虾仁炒变色", "加豆腐和少量水", "盐和白胡椒调味"),
            ),
            Dish(
                "清炒小白菜",
                ("小白菜500g", "蒜末"),
                ("大火热油", "蒜末爆香", "小白菜快炒断生"),
            ),
            Dish(
                "凉拌黄瓜木耳",
                ("黄瓜2根", "木耳", "蒜末", "香醋"),
                ("木耳泡发焯水", "黄瓜拍碎", "加生抽香醋香油拌匀"),
            ),
        ),
        soup=None,
        prep_order=("先泡木耳并腌牛肉", "处理豆腐和虾仁", "先做凉菜", "再炒牛肉、豆腐和青菜"),
    ),
    MenuPlan(
        title="不辣下饭四菜餐",
        note="口味偏家常，不放辣也下饭，照顾孩子和老人。",
        dishes=(
            Dish(
                "糖醋里脊",
                ("里脊肉350g", "鸡蛋1个", "番茄酱", "白醋"),
                ("里脊切条裹蛋液和淀粉", "煎或炸到定型", "糖醋汁收汁裹匀"),
            ),
            Dish(
                "芹菜木耳肉片",
                ("芹菜400g", "木耳", "瘦肉200g", "蒜片"),
                ("肉片腌10分钟", "先炒肉片", "芹菜木耳合炒"),
            ),
            Dish(
                "土豆丝",
                ("土豆2个", "青椒1个", "醋"),
                ("土豆丝冲水", "大火快炒", "出锅前加少量醋"),
            ),
            Dish(
                "清炒生菜",
                ("生菜2颗", "蒜末"),
                ("蒜末爆香", "生菜快炒", "加盐出锅"),
            ),
        ),
        soup=None,
        prep_order=("先泡木耳并腌肉", "切土豆丝泡水", "先做糖醋里脊", "再炒肉片、土豆丝和生菜"),
    ),
)


def pick_menu(for_date: dt.date) -> MenuPlan:
    return MENU_PLANS[for_date.toordinal() % len(MENU_PLANS)]


def shopping_list(menu: MenuPlan) -> list[str]:
    items: list[str] = []
    dishes = (*menu.dishes, menu.soup) if menu.soup else menu.dishes
    for dish in dishes:
        items.extend(dish.ingredients)
    return list(dict.fromkeys(items))


def build_message(menu: MenuPlan, for_date: dt.date, servings: int) -> str:
    menu_style = "三菜一汤" if menu.soup else f"{len(menu.dishes)}个菜"
    lines = [
        f"# 今晚家常菜推荐：{menu.title}",
        "",
        f"- 日期：{for_date.isoformat()}",
        f"- 人数：约 {servings} 人",
        f"- 组合：{menu_style}",
        f"- 思路：{menu.note}",
        "",
        "## 菜单",
    ]

    for index, dish in enumerate(menu.dishes, start=1):
        lines.extend(
            [
                f"### {index}. {dish.name}",
                f"- 食材：{'、'.join(dish.ingredients)}",
                f"- 做法：{'；'.join(dish.steps)}",
                "",
            ]
        )

    if menu.soup:
        lines.extend(
            [
                f"### 汤：{menu.soup.name}",
                f"- 食材：{'、'.join(menu.soup.ingredients)}",
                f"- 做法：{'；'.join(menu.soup.steps)}",
                "",
            ]
        )

    lines.append("## 做饭顺序")
    lines.extend(f"{index}. {step}" for index, step in enumerate(menu.prep_order, start=1))
    lines.extend(
        [
            "",
            "## 买菜清单",
            "、".join(shopping_list(menu)),
            "",
            "小提醒：口味按家里老人和孩子调整，少油少辣更稳。",
        ]
    )
    return "\n".join(lines)


def send_pushplus(token: str, title: str, content: str, topic: str | None = None) -> None:
    payload: dict[str, Any] = {
        "token": token,
        "title": title,
        "content": content,
        "template": "markdown",
    }
    if topic:
        payload["topic"] = topic

    request = urllib.request.Request(
        PUSHPLUS_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Failed to send PushPlus message: {exc}") from exc

    try:
        result = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"PushPlus returned non-JSON response: {body}") from exc

    if result.get("code") not in (200, "200"):
        raise RuntimeError(f"PushPlus send failed: {result}")


def parse_date(value: str | None) -> dt.date:
    if not value:
        return dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    return dt.date.fromisoformat(value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send a daily family dinner menu via PushPlus.")
    parser.add_argument("--date", help="Menu date in YYYY-MM-DD. Default: today in China time.")
    parser.add_argument("--servings", type=int, default=4, help="Number of diners. Default: 4.")
    parser.add_argument(
        "--token",
        default=os.environ.get("PUSHPLUS_TOKEN"),
        help="PushPlus token. Prefer setting PUSHPLUS_TOKEN in the environment.",
    )
    parser.add_argument(
        "--topic",
        default=os.environ.get("PUSHPLUS_TOPIC"),
        help="Optional PushPlus topic/group code. Can also use PUSHPLUS_TOPIC.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the menu without sending PushPlus.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        for_date = parse_date(args.date)
    except ValueError:
        print("error: --date must use YYYY-MM-DD", file=sys.stderr)
        return 1

    menu = pick_menu(for_date)
    servings = max(args.servings, 1)
    title = f"今晚{servings}人晚饭推荐：{menu.title}"
    content = build_message(menu, for_date, servings)

    if args.dry_run:
        print(f"Title: {title}\n")
        print(content)
        return 0

    if not args.token:
        print("error: PUSHPLUS_TOKEN is required unless --dry-run is used.", file=sys.stderr)
        return 1

    try:
        send_pushplus(args.token, title, content, args.topic)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"Sent dinner menu for {for_date.isoformat()}: {menu.title}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
