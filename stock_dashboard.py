#!/usr/bin/env python3
"""Local web dashboard for watching A-share holdings.

Run this script and open the printed local URL in a browser. The dashboard uses
the same public quote endpoint and default holding list as stock_watch.py.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from stock_watch import DEFAULT_HOLDINGS, Holding, fetch_sina_quotes, load_holdings, risk_signals


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765


def build_portfolio_payload(holdings: list[Holding]) -> dict[str, Any]:
    quotes = fetch_sina_quotes(item.code for item in holdings)
    positions = []
    total_market_value = 0.0
    total_cost = 0.0
    quote_times: set[str] = set()

    for holding in holdings:
        quote = quotes.get(holding.code)
        cost_value = holding.cost * holding.shares
        total_cost += cost_value

        if quote is None:
            positions.append(
                {
                    "code": holding.code,
                    "name": holding.alias or holding.code,
                    "shares": holding.shares,
                    "cost": holding.cost,
                    "currentPrice": None,
                    "changePercent": None,
                    "marketValue": 0.0,
                    "profit": -cost_value,
                    "profitPercent": -100.0 if cost_value else 0.0,
                    "signals": ["行情缺失"],
                }
            )
            continue

        market_value = quote.current_price * holding.shares
        profit = market_value - cost_value
        profit_percent = 0.0 if cost_value == 0 else profit / cost_value * 100
        total_market_value += market_value
        if quote.date and quote.time:
            quote_times.add(f"{quote.date} {quote.time}")

        positions.append(
            {
                "code": holding.code,
                "name": quote.name or holding.alias or holding.code,
                "shares": holding.shares,
                "cost": round(holding.cost, 4),
                "currentPrice": round(quote.current_price, 4),
                "changePercent": round(quote.change_percent, 2),
                "marketValue": round(market_value, 2),
                "profit": round(profit, 2),
                "profitPercent": round(profit_percent, 2),
                "signals": risk_signals(holding, quote, profit_percent),
            }
        )

    total_profit = total_market_value - total_cost
    total_profit_percent = 0.0 if total_cost == 0 else total_profit / total_cost * 100
    for position in positions:
        position["weightPercent"] = (
            round(position["marketValue"] / total_market_value * 100, 2)
            if total_market_value
            else 0.0
        )

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "quoteTime": sorted(quote_times)[-1] if quote_times else None,
        "totals": {
            "cost": round(total_cost, 2),
            "marketValue": round(total_market_value, 2),
            "profit": round(total_profit, 2),
            "profitPercent": round(total_profit_percent, 2),
        },
        "positions": positions,
        "disclaimer": "公开行情可能延迟或临时不可用；本面板只用于观察和复盘，不构成投资建议。",
    }


def make_handler(holdings: list[Holding]) -> type[BaseHTTPRequestHandler]:
    class DashboardHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - http.server uses this name.
            if self.path in ("/", "/index.html"):
                self.send_text(HTTPStatus.OK, DASHBOARD_HTML, "text/html; charset=utf-8")
                return
            if self.path == "/api/portfolio":
                try:
                    payload = build_portfolio_payload(holdings)
                except Exception as exc:  # Keep the dashboard responsive if the quote source fails.
                    self.send_json(HTTPStatus.BAD_GATEWAY, {"error": str(exc)})
                    return
                self.send_json(HTTPStatus.OK, payload)
                return
            if self.path == "/health":
                self.send_json(HTTPStatus.OK, {"status": "ok"})
                return
            self.send_text(HTTPStatus.NOT_FOUND, "Not found", "text/plain; charset=utf-8")

        def log_message(self, format: str, *args: Any) -> None:
            sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

        def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def send_text(self, status: HTTPStatus, text: str, content_type: str) -> None:
            body = text.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return DashboardHandler


def build_static_html(payload: dict[str, Any]) -> str:
    data_script = (
        "  <script>\n"
        f"    window.__PORTFOLIO_DATA__ = {json.dumps(payload, ensure_ascii=False)};\n"
        "  </script>\n"
    )
    return DASHBOARD_HTML.replace("  <script>\n    const elements =", f"{data_script}  <script>\n    const elements =", 1)


DASHBOARD_HTML = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>A股持仓观察面板</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7fb;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --line: #e5e7eb;
      --red: #ef4444;
      --green: #16a34a;
      --blue: #2563eb;
      --amber: #d97706;
      --shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #f7f2ea 0%, var(--bg) 42%, #eef2ff 100%);
      color: var(--text);
    }
    .page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    .hero {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 22px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 5vw, 44px);
      letter-spacing: -0.03em;
    }
    .subtitle {
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
    }
    .actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      min-width: 170px;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      background: var(--text);
      color: #fff;
      font-size: 15px;
      cursor: pointer;
      box-shadow: var(--shadow);
    }
    button:disabled {
      cursor: wait;
      opacity: 0.7;
    }
    .timestamp {
      color: var(--muted);
      font-size: 13px;
      text-align: right;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 18px;
    }
    .card {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 22px;
      padding: 20px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }
    .label {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 10px;
    }
    .value {
      font-size: clamp(22px, 3vw, 31px);
      font-weight: 760;
      letter-spacing: -0.03em;
      white-space: nowrap;
    }
    .positive { color: var(--red); }
    .negative { color: var(--green); }
    .neutral { color: var(--text); }
    .panel {
      background: var(--card);
      border-radius: 24px;
      box-shadow: var(--shadow);
      overflow: hidden;
      border: 1px solid rgba(229, 231, 235, 0.8);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
      white-space: nowrap;
    }
    th {
      color: var(--muted);
      font-size: 13px;
      font-weight: 650;
      background: #fafafa;
    }
    tr:last-child td { border-bottom: 0; }
    .stock-name {
      font-weight: 720;
      margin-bottom: 4px;
    }
    .code {
      color: var(--muted);
      font-size: 13px;
    }
    .weight {
      min-width: 110px;
    }
    .bar {
      height: 9px;
      width: 100%;
      border-radius: 999px;
      background: #eef2f7;
      margin-top: 7px;
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #60a5fa, #2563eb);
    }
    .signals {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      white-space: normal;
      min-width: 210px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 12px;
      background: #eef2ff;
      color: #3730a3;
    }
    .badge.warn {
      background: #fff7ed;
      color: #c2410c;
    }
    .badge.danger {
      background: #fef2f2;
      color: #b91c1c;
    }
    .notice {
      margin-top: 16px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.7;
    }
    .error {
      display: none;
      margin-bottom: 16px;
      padding: 14px 16px;
      border-radius: 16px;
      background: #fef2f2;
      color: #b91c1c;
    }

    @media (max-width: 900px) {
      .hero { flex-direction: column; }
      .actions { align-items: flex-start; }
      .timestamp { text-align: left; }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .panel { overflow-x: auto; }
    }

    @media (max-width: 540px) {
      .page { padding: 24px 14px 38px; }
      .cards { grid-template-columns: 1fr; }
      th, td { padding: 14px 12px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <h1>A股持仓观察面板</h1>
        <p class="subtitle">跟踪当前持仓市值、浮盈亏、仓位占比和风险信号。数据来自公开行情接口，仅用于观察和复盘。</p>
      </div>
      <div class="actions">
        <button id="refresh">刷新行情</button>
        <div class="timestamp" id="timestamp">等待加载...</div>
      </div>
    </section>

    <div class="error" id="error"></div>

    <section class="cards">
      <div class="card">
        <div class="label">组合市值</div>
        <div class="value" id="marketValue">--</div>
      </div>
      <div class="card">
        <div class="label">组合成本</div>
        <div class="value" id="cost">--</div>
      </div>
      <div class="card">
        <div class="label">组合浮盈亏</div>
        <div class="value" id="profit">--</div>
      </div>
      <div class="card">
        <div class="label">组合收益率</div>
        <div class="value" id="profitPercent">--</div>
      </div>
    </section>

    <section class="panel">
      <table>
        <thead>
          <tr>
            <th>股票</th>
            <th>现价</th>
            <th>涨跌幅</th>
            <th>持仓</th>
            <th>市值</th>
            <th>浮盈亏</th>
            <th>仓位</th>
            <th>观察信号</th>
          </tr>
        </thead>
        <tbody id="positions">
          <tr><td colspan="8">正在加载行情...</td></tr>
        </tbody>
      </table>
    </section>

    <p class="notice" id="notice">公开行情可能延迟或临时不可用；本面板不构成投资建议，也不会执行任何交易。</p>
  </main>

  <script>
    const elements = {
      refresh: document.querySelector("#refresh"),
      timestamp: document.querySelector("#timestamp"),
      error: document.querySelector("#error"),
      marketValue: document.querySelector("#marketValue"),
      cost: document.querySelector("#cost"),
      profit: document.querySelector("#profit"),
      profitPercent: document.querySelector("#profitPercent"),
      positions: document.querySelector("#positions"),
      notice: document.querySelector("#notice"),
    };

    function money(value) {
      if (value === null || value === undefined) return "--";
      return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        maximumFractionDigits: 2
      }).format(value);
    }

    function number(value, digits = 2) {
      if (value === null || value === undefined) return "--";
      return Number(value).toFixed(digits);
    }

    function signedMoney(value) {
      if (value === null || value === undefined) return "--";
      const sign = value > 0 ? "+" : "";
      return sign + money(value);
    }

    function percent(value) {
      if (value === null || value === undefined) return "--";
      const sign = value > 0 ? "+" : "";
      return `${sign}${Number(value).toFixed(2)}%`;
    }

    function tone(value) {
      if (value > 0) return "positive";
      if (value < 0) return "negative";
      return "neutral";
    }

    function signalClass(signal) {
      if (signal.includes("ST") || signal.includes("亏损") || signal.includes("跌破") || signal.includes("缺失")) {
        return "danger";
      }
      if (signal.includes("接近") || signal.includes("关注") || signal.includes("较大")) {
        return "warn";
      }
      return "";
    }

    function render(data) {
      elements.error.style.display = "none";
      elements.marketValue.textContent = money(data.totals.marketValue);
      elements.cost.textContent = money(data.totals.cost);
      elements.profit.textContent = signedMoney(data.totals.profit);
      elements.profit.className = `value ${tone(data.totals.profit)}`;
      elements.profitPercent.textContent = percent(data.totals.profitPercent);
      elements.profitPercent.className = `value ${tone(data.totals.profitPercent)}`;
      elements.timestamp.textContent = `行情时间：${data.quoteTime || "未知"} / 刷新：${data.generatedAt}`;
      elements.notice.textContent = data.disclaimer;

      elements.positions.innerHTML = data.positions.map((item) => `
        <tr>
          <td>
            <div class="stock-name">${item.name}</div>
            <div class="code">${item.code}</div>
          </td>
          <td>${number(item.currentPrice, 2)}</td>
          <td class="${tone(item.changePercent)}">${percent(item.changePercent)}</td>
          <td>${item.shares} 股<br><span class="code">成本 ${number(item.cost, 4)}</span></td>
          <td>${money(item.marketValue)}</td>
          <td class="${tone(item.profit)}">${signedMoney(item.profit)}<br><span class="code ${tone(item.profitPercent)}">${percent(item.profitPercent)}</span></td>
          <td class="weight">
            ${percent(item.weightPercent)}
            <div class="bar"><span style="width:${Math.min(item.weightPercent || 0, 100)}%"></span></div>
          </td>
          <td>
            <div class="signals">
              ${item.signals.map((signal) => `<span class="badge ${signalClass(signal)}">${signal}</span>`).join("")}
            </div>
          </td>
        </tr>
      `).join("");
    }

    async function load() {
      elements.refresh.disabled = true;
      elements.refresh.textContent = "刷新中...";
      try {
        if (window.__PORTFOLIO_DATA__) {
          render(window.__PORTFOLIO_DATA__);
          elements.timestamp.textContent = `静态快照：${window.__PORTFOLIO_DATA__.quoteTime || "未知"} / 生成：${window.__PORTFOLIO_DATA__.generatedAt}`;
          return;
        }
        const response = await fetch("/api/portfolio", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "行情接口请求失败");
        }
        render(data);
      } catch (error) {
        elements.error.textContent = `加载失败：${error.message}`;
        elements.error.style.display = "block";
      } finally {
        elements.refresh.disabled = false;
        elements.refresh.textContent = window.__PORTFOLIO_DATA__ ? "重新显示快照" : "刷新行情";
      }
    }

    elements.refresh.addEventListener("click", load);
    load();
    if (!window.__PORTFOLIO_DATA__) {
      setInterval(load, 60000);
    }
  </script>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a local A-share holding dashboard.")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Bind host. Default: {DEFAULT_HOST}.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Bind port. Default: {DEFAULT_PORT}.")
    parser.add_argument(
        "--holdings",
        help="Optional CSV or JSON file. Required fields: code, shares, cost; optional: alias.",
    )
    parser.add_argument("--once", action="store_true", help="Print one JSON snapshot and exit.")
    parser.add_argument(
        "--export",
        metavar="PATH",
        help="Generate a self-contained static HTML dashboard and exit.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    holdings = load_holdings(args.holdings) if args.holdings else DEFAULT_HOLDINGS

    if args.once:
        try:
            print(json.dumps(build_portfolio_payload(holdings), ensure_ascii=False, indent=2))
        except Exception as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        return 0

    if args.export:
        try:
            payload = build_portfolio_payload(holdings)
            output_path = Path(args.export)
            output_path.write_text(build_static_html(payload), encoding="utf-8")
        except Exception as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        print(f"Static dashboard written to {output_path}")
        return 0

    server = ThreadingHTTPServer((args.host, args.port), make_handler(holdings))
    print(f"Stock dashboard running at http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dashboard.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
