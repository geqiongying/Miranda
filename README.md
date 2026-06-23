# Miranda

一个用于个人持仓观察的小工具仓库。

## A 股行情观察工具

`stock_watch.py` 会通过公开行情接口查询 A 股报价，并按持仓成本和数量输出：

- 现价和当日涨跌幅
- 持仓市值
- 浮盈亏和收益率
- 简单观察信号，例如接近成本线、跌破成本、ST 风险、浮盈保护提醒

默认观察以下持仓：

| 股票 | 代码 | 持仓数量 | 成本 |
| --- | --- | ---: | ---: |
| 国盾量子 | 688027 | 387 | 520.1536 |
| *ST大立 | 002214 | 4300 | 22.9626 |
| 长川科技 | 300604 | 700 | 196.9961 |

运行：

```bash
python3 stock_watch.py
```

也可以传入自己的 CSV 或 JSON 持仓文件：

```bash
python3 stock_watch.py --holdings holdings.csv
```

CSV 字段：

```csv
code,alias,shares,cost
688027,国盾量子,387,520.1536
002214,*ST大立,4300,22.9626
300604,长川科技,700,196.9961
```

JSON 示例：

```json
[
  {"code": "688027", "alias": "国盾量子", "shares": 387, "cost": 520.1536},
  {"code": "002214", "alias": "*ST大立", "shares": 4300, "cost": 22.9626},
  {"code": "300604", "alias": "长川科技", "shares": 700, "cost": 196.9961}
]
```

> 注意：公开行情接口可能存在延迟、限流或临时不可用。这个工具只用于观察和复盘，不构成投资建议，也不会执行任何交易。

## 本地股票观察面板

`stock_dashboard.py` 会启动一个本地网页面板，用浏览器查看当前持仓：

- 组合市值、组合成本、组合浮盈亏和收益率
- 每只股票的现价、涨跌幅、持仓市值、仓位占比
- 风险/观察信号标签
- 手动刷新和每 60 秒自动刷新

运行：

```bash
python3 stock_dashboard.py
```

然后打开：

```text
http://127.0.0.1:8765
```

也可以使用自定义持仓文件：

```bash
python3 stock_dashboard.py --holdings holdings.csv
```

快速输出一次 JSON 快照：

```bash
python3 stock_dashboard.py --once
```

如需修改端口：

```bash
python3 stock_dashboard.py --port 9000
```

## A 股观察股筛选模型

`steady_stock_screener.py` 会从公开行情列表接口拉取 A 股基础行情和估值字段，并按不同观察周期筛选“值得进一步研究的观察标的”。

运行：

```bash
python3 steady_stock_screener.py
```

默认使用 `mid` 中线稳健观察版。也可以显式选择三种模型：

```bash
# 短线趋势观察版：约 1-4 周
python3 steady_stock_screener.py --profile short --limit 10

# 中线稳健观察版：约 3-12 个月，默认
python3 steady_stock_screener.py --profile mid --limit 10

# 长期分红价值观察版：约 1-3 年以上
python3 steady_stock_screener.py --profile long --limit 10

# 一次输出三版，便于横向对比
python3 steady_stock_screener.py --profile all --limit 5
```

三版模型：

| 模型 | 观察周期 | 侧重点 | 典型限制 |
| --- | --- | --- | --- |
| `short` 短线趋势观察版 | 1-4 周 | 趋势走强、量能适度放大、换手活跃 | 排除 ST/退市风险；涨幅不能过度极端；估值不能明显过热 |
| `mid` 中线稳健观察版 | 3-12 个月 | 大中市值、估值不过热、波动和成交不过度异常 | 总市值默认不低于 300 亿元；`PE(TTM)` 默认不高于 35；`PB` 默认不高于 4 |
| `long` 长期分红价值观察版 | 1-3 年以上 | 大市值、低估值、低波动、低换手的成熟公司 | 总市值默认不低于 500 亿元；`PE(TTM)` 默认不高于 25；`PB` 默认不高于 2.5 |

通用规则：

- 按总市值排序，默认最多拉取前 10 页，约 1000 只大中市值股票
- 如果公开接口对较深分页返回错误，脚本会使用已成功拉取的数据继续输出
- 默认排除当前持仓：`688027`、`002214`、`300604`
- 排除名称包含 `ST` 或 `退` 的股票

常用参数：

```bash
# 只显示前 10 个观察标的
python3 steady_stock_screener.py --limit 10

# 调整模型和市值、PE、PB 阈值
python3 steady_stock_screener.py --profile long --min-market-cap 80000000000 --max-pe-ttm 20 --max-pb 2

# 扩大或缩小拉取页数；公开接口偶尔会对较深分页返回错误
python3 steady_stock_screener.py --max-pages 5

# 不排除默认持仓
python3 steady_stock_screener.py --exclude ""

# 自定义排除代码
python3 steady_stock_screener.py --exclude 688027,002214,300604,600519
```

> 注意：这些模型只做第一层量化初筛。进入观察名单后，仍需要继续核对财报质量、主营业务、行业景气度、分红记录、现金流、股东减持、诉讼处罚、重大公告等信息。
