# MIRANDA · 四入口学习站

Miranda 的私人 A 股学习站：**均线手记**、**量能操盘台**、**五哥笔记台**、**板块观察台** 分轨运行。

线上地址（合并 `main` 并由 GitHub Pages 发布后）：

`https://geqiongying.github.io/Miranda/`

## 四入口

| 入口 | 页面 | 逻辑 |
|------|------|------|
| 首页门户 | `index.html` | 选择进入哪条线 |
| 均线手记 | `ma.html` | 买点 A/B/C、卖点 A/B；`data-engine="ma"` |
| 量能操盘台 | `coach.html` | 买点 V/Ctl/H、卖点 V；`data-engine="volume"` |
| 五哥笔记台 | `wuge.html` | 试盘线 / 龙头近似；`data-engine="wuge"` |
| 板块观察台 | `board.html` | 板块推荐池 → 池内短/中期打分 |
| 微信推送 | `push.html` | 收盘盯盘、每日观察菜单和晚饭菜单通过 PushPlus 发到微信 |

## 板块观察台

1. 先按主线板块整理推荐股票（核心票 + 东财板块扩展）
2. 再对池内股票做**全员筛选**，分数从高到低
3. 结果拆成 **短期 / 中期** 两栏

老师发言稿：`notes/2026年9月14日学习.pdf`  
要点摘要：`notes/teacher-speech.md`  
理论骨架：`notes/sector-theory.md`

当前主线池：化肥、大炼化、化纤、煤化工、煤炭资源、液冷、光纤、光模块/光芯片、存储。

## 微信收盘推送

`stock_buy_alert.py` 默认监控国投中鲁 (600962)、飞龙股份 (002536)、*ST大立 (002214)。工作日北京时间 15:10 由 GitHub Actions 运行，即使没有买入观察信号也会推送当日状态。

## 每日观察菜单

`daily_menu_alert.py` 工作日北京时间 **08:20** 推送短线 / 中线各 5 只观察票。这是第一层筛选菜单，不是教学买点。Actions 工作流名：`Daily menu alert`，可手动试发。

三条推送共用仓库 secret `PUSHPLUS_TOKEN`。说明页：`push.html`。

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

- 页面显示的是 **规则契合度 / 观察分**，不是胜率
- **不承诺、也不暗示 90% 成功率**
- 仅供个人学习参考，不构成投资建议

## 本地预览

```bash
python3 -m http.server 4173
```

打开：http://localhost:4173
