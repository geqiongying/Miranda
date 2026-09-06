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
| 微信推送 | `push.html` | 收盘盯盘 + 每日观察菜单 |

## 微信收盘推送

`stock_buy_alert.py` 默认监控国投中鲁 (600962)、飞龙股份 (002536)、*ST大立 (002214)。工作日北京时间 15:10 由 GitHub Actions 运行，即使没有买入观察信号也会推送当日状态。

## 每日观察菜单

`daily_menu_alert.py` 工作日北京时间 **08:20** 推送短线 / 中线各 5 只观察票。这是第一层筛选菜单，不是教学买点。Actions 工作流名：`Daily menu alert`，可手动试发。

两条推送共用仓库 secret `PUSHPLUS_TOKEN`。说明页：`push.html`。

脚本只做观察提醒，不构成投资建议。

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
