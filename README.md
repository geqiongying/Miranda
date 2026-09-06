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
| 微信推送 | `push.html` | 工作日 15:10 通过 PushPlus 发到微信 |

## 微信收盘推送

监控名单在 `watchlist.json`。当前默认只看 **国投中鲁 600962**，规则是：价在 MA20 上方、MA20 走平或向上、价在 MA60 上方。飞龙股份、*ST大立 已从每日推送里拿掉。

要加别的票，在 `watchlist.json` 的 `stocks` 里追加 `code` / `alias` / `mode`（普通观察用 `buy`）。工作日北京时间 15:10 由 GitHub Actions 运行；也可以在 Actions 里手动跑 `Stock close alert`。说明页：`push.html`。

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
