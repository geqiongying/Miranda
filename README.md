# MIRANDA · 三入口学习站

Miranda 的私人 A 股学习站：**均线手记**、**量能操盘台**、**五哥笔记台** 分轨运行，模板与闸门互不混用。

线上地址（合并 `main` 并由 GitHub Pages 发布后）：

`https://geqiongying.github.io/Miranda/`

## 三入口

| 入口 | 页面 | 逻辑 |
|------|------|------|
| 首页门户 | `index.html` | 选择进入哪条线 |
| 均线手记 | `ma.html` | 买点 A/B/C、卖点 A/B；`data-engine="ma"` |
| 量能操盘台 | `coach.html` | 买点 V/Ctl/H、卖点 V；`data-engine="volume"` |
| 五哥笔记台 | `wuge.html` | 试盘线 / 龙头近似；`data-engine="wuge"` |
| 微信推送 | `push.html` | 收盘提醒和晚饭菜单通过 PushPlus 发到微信 |

## 微信收盘推送

`stock_buy_alert.py` 默认监控国投中鲁 (600962)、飞龙股份 (002536)、*ST大立 (002214)。工作日北京时间 15:10 由 GitHub Actions 运行，即使没有买入观察信号也会推送当日状态。

要真正发到微信，先把本仓库 Actions secret `PUSHPLUS_TOKEN` 配好，再到 Actions 里手动跑一次 `Stock close alert`。说明页：`push.html`。

脚本只做观察提醒，不构成投资建议。

## 每日晚饭菜单推送

`dinner_menu_push.py` 每天按日期选择一套四人份家常晚饭菜单，并通过 PushPlus 推送到微信。菜单会在 **三菜一汤** 和 **四个菜** 之间自动轮换，内容包含做饭顺序和买菜清单。

GitHub Actions 默认在 **北京时间每天 11:00** 运行 `Dinner menu push`。

本地预览今天菜单：

```bash
python3 dinner_menu_push.py --dry-run
```

指定日期或人数：

```bash
python3 dinner_menu_push.py --date 2026-09-06 --servings 4 --dry-run
```

要真正发到微信，复用仓库 Actions secret `PUSHPLUS_TOKEN`。如果要推送到 PushPlus 群组，可额外配置 `PUSHPLUS_TOPIC`。

## 五哥笔记来源

- `教学笔记-五哥.pdf`
- `notes/教学笔记-五哥_compressed_4mb.pdf`
- 可执行摘要：`notes/wuge-rules.md`

## 重要说明

- 页面显示的是 **规则契合度**，不是胜率
- **不承诺、也不暗示 90% 成功率**
- 仅供个人学习参考，不构成投资建议

## 本地预览

```bash
python3 -m http.server 4173
```

打开：http://localhost:4173
