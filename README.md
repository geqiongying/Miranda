# MIRANDA · 四入口学习站

Miranda 的私人 A 股学习站：**均线手记**、**量能操盘台**、**五哥笔记台**、**板块观察台** 分轨运行。

线上地址（合并 `main` 并由 GitHub Pages 发布后）：

`https://geqiongying.github.io/Miranda/`

## 四入口

| 入口 | 页面 | 逻辑 |
|------|------|------|
| 首页门户 | `index.html` | 选择进入哪条线 |
| 均线手记 | `ma.html` | 买点 A/B/C、卖点 A/B |
| 量能操盘台 | `coach.html` | 买点 V/Ctl/H、卖点 V |
| 五哥笔记台 | `wuge.html` | 试盘线 / 龙头近似 |
| 板块观察台 | `board.html` | 板块推荐池 → 池内短/中期打分 |

## 板块观察台

1. 先按主线板块整理推荐股票（核心票 + 东财板块扩展）
2. 再对池内股票做**全员筛选**，分数从高到低
3. 结果拆成 **短期 / 中期** 两栏

老师发言稿入口：`notes/teacher-speech.md`  
理论骨架：`notes/sector-theory.md`

## 重要说明

- 页面显示的是 **规则契合度 / 观察分**，不是胜率
- **不承诺、也不暗示 90% 成功率**
- 仅供个人学习参考，不构成投资建议

## 本地预览

```bash
python3 -m http.server 4173
```

打开：http://localhost:4173
