(() => {
  const CODE_MAP = {
    "120-99": "120 分钟图上的 MA99：中期多空分界，支撑转压力的关键位。",
    "120-128": "120 分钟图上的 MA128：变盘点与底部确认核心地带。",
    "120-225": "120 分钟图上的 MA225：结构底线，跌破视为结构破坏。",
    "15-225": "15 分钟图上的 MA225：短线压力 / 突破信号。",
    "15-99": "15 分钟图上的 MA99：盘中支撑与做 T 买点。",
    "日-MA20": "日线图上的 MA20：短线生命线，短期多空分界。",
  };

  const IDX_CONFIG = {
    "000001": { secid: "1.000001", symbol: "sh000001", name: "上证指数", color: "#c23b2a" },
    "399006": { secid: "0.399006", symbol: "sz399006", name: "创业板指", color: "#1f7a4d" },
    "000688": { secid: "1.000688", symbol: "sh000688", name: "科创50", color: "#0f7a64" },
  };

  let currentIdx = "000001";
  const idxDataCache = {};

  // ---------- UI helpers ----------
  const nav = document.getElementById("siteNav");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 20);
  });

  const revealEls = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));

  const chips = document.querySelectorAll(".code-chip");
  const explain = document.getElementById("codeExplain");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      explain.textContent = CODE_MAP[chip.dataset.code] || "";
    });
  });

  // ---------- Network / market data ----------
  function fetchJsonp(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const cbName = `__miranda_cb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("行情请求超时"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("行情接口加载失败"));
      };

      const joiner = url.includes("?") ? "&" : "?";
      script.src = `${url}${joiner}cb=${cbName}`;
      document.head.appendChild(script);
    });
  }

  async function fetchCorsJson(url) {
    const resp = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  function calcMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) result.push(null);
      else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j];
        result.push(sum / period);
      }
    }
    return result;
  }

  function getSecId(rawCode) {
    let code = rawCode.trim().toUpperCase();
    code = code.replace(/\.(SH|SZ|BJ)$/i, "");
    code = code.replace(/^(SH|SZ|BJ)/i, "");
    code = code.replace(/^(\d+\.)/, "");

    if (/^BK\d{3,5}$/.test(code)) {
      return { secid: "90." + code, symbol: null, type: "板块", name: code };
    }
    if (code === "000001") return { secid: "1.000001", symbol: "sh000001", type: "指数", name: "上证指数" };
    if (code === "000688") return { secid: "1.000688", symbol: "sh000688", type: "指数", name: "科创50" };
    if (code === "399001") return { secid: "0.399001", symbol: "sz399001", type: "指数", name: "深证成指" };
    if (code === "399006") return { secid: "0.399006", symbol: "sz399006", type: "指数", name: "创业板指" };
    if (code === "399005") return { secid: "0.399005", symbol: "sz399005", type: "指数", name: "中小板指" };
    if (/^[6]\d{5}$/.test(code)) return { secid: "1." + code, symbol: "sh" + code, type: "股票", name: code };
    if (/^(000|001)\d{3}$/.test(code)) return { secid: "0." + code, symbol: "sz" + code, type: "股票", name: code };
    if (/^(002|003)\d{3}$/.test(code)) return { secid: "0." + code, symbol: "sz" + code, type: "股票", name: code };
    if (/^(300|301)\d{3}$/.test(code)) return { secid: "0." + code, symbol: "sz" + code, type: "股票", name: code };
    if (/^[48]\d{5}$/.test(code)) return { secid: "0." + code, symbol: "bj" + code, type: "股票", name: code };
    if (/^(159|16|15)\d{4}$/.test(code)) return { secid: "0." + code, symbol: "sz" + code, type: "ETF", name: code };
    if (/^51\d{4}$/.test(code)) return { secid: "1." + code, symbol: "sh" + code, type: "ETF", name: code };
    return null;
  }

  async function fetchQuote(info) {
    const url = `https://push2delay.eastmoney.com/api/qt/stock/get?secid=${info.secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170`;
    const quoteData = await fetchJsonp(url);
    if (!quoteData.data) throw new Error("未找到该代码数据，请检查是否输入正确");
    const q = quoteData.data;
    return {
      name: q.f58 || info.name,
      price: q.f43 / 100,
      high: q.f44 / 100,
      low: q.f45 / 100,
      open: q.f46 / 100,
      preClose: q.f60 / 100,
      change: q.f169 / 100,
      changePct: q.f170 / 100,
    };
  }

  async function fetchDayKlines(symbol) {
    if (!symbol) throw new Error("该代码暂不支持 K 线拉取（如部分板块）");
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,260,qfq`;
    const data = await fetchCorsJson(url);
    const node = data?.data?.[symbol];
    const rows = node?.qfqday || node?.day;
    if (!rows || !rows.length) throw new Error("未能获取 K 线数据");
    return rows.map((r) => ({
      date: r[0],
      open: parseFloat(r[1]),
      close: parseFloat(r[2]),
      high: parseFloat(r[3]),
      low: parseFloat(r[4]),
      volume: parseFloat(r[5] || 0),
    }));
  }

  async function fetchMinuteCloses(symbol, minutes = 15, count = 250) {
    if (!symbol) return null;
    // Tencent minute endpoint variants differ by market; degrade quietly if unavailable.
    const url = `https://web.ifzq.gtimg.cn/appstock/app/kline/mkline?param=${symbol},m${minutes},,${count}`;
    try {
      const data = await fetchCorsJson(url);
      const node = data?.data?.[symbol];
      const key = `m${minutes}`;
      const rows = node?.[key];
      if (!rows || !rows.length) return null;
      return rows.map((r) => parseFloat(r[2]));
    } catch (_) {
      return null;
    }
  }

  function trendLabel(price, ma) {
    if (ma == null) return "数据不足";
    if (price > ma * 1.01) return "上方偏强";
    if (price < ma * 0.99) return "下方偏弱";
    return "附近纠缠";
  }

  function arrangementScore(current) {
    const order = ["ma5", "ma20", "ma99", "ma128", "ma225"];
    const vals = order.map((k) => current[k]).filter((v) => v != null);
    if (vals.length < 5) return { label: "数据不足", score: 50 };
    let bull = 0;
    for (let i = 0; i < vals.length - 1; i++) if (vals[i] >= vals[i + 1]) bull++;
    if (bull >= 4) return { label: "多头排列", score: 80 };
    if (bull <= 1) return { label: "空头排列", score: 25 };
    return { label: "均线粘合 / 过渡", score: 50 };
  }

  async function analyzeStock() {
    const input = document.getElementById("stockInput");
    const result = document.getElementById("analysisResult");
    const loading = document.getElementById("loadingStatus");
    const error = document.getElementById("errorMsg");

    result.hidden = true;
    error.hidden = true;
    const code = input.value.trim();
    if (!code) {
      error.hidden = false;
      error.textContent = "请输入股票 / 指数 / 板块代码";
      return;
    }

    const info = getSecId(code);
    if (!info) {
      error.hidden = false;
      error.innerHTML =
        "无法识别该代码。支持 600xxx / 000xxx / 300xxx / 688xxx、指数 000001 / 399006，以及板块 BKxxxx。";
      return;
    }

    loading.hidden = false;
    loading.textContent = "获取实时行情...";

    try {
      const quote = await fetchQuote(info);
      const { name, price, change, changePct, high, low, open, preClose } = quote;

      loading.textContent = "计算日线均线...";
      const klines = await fetchDayKlines(info.symbol);
      const closes = klines.map((k) => k.close);
      const last = closes.length - 1;
      const current = {
        ma5: calcMA(closes, 5)[last],
        ma20: calcMA(closes, 20)[last],
        ma99: calcMA(closes, 99)[last],
        ma128: calcMA(closes, 128)[last],
        ma225: calcMA(closes, 225)[last],
      };

      loading.textContent = "读取 15 分钟映射...";
      let m15 = { ma99: null, ma225: null };
      const c15 = await fetchMinuteCloses(info.symbol, 15, 250);
      if (c15 && c15.length) {
        const i15 = c15.length - 1;
        m15 = {
          ma99: calcMA(c15, 99)[i15],
          ma225: calcMA(c15, 225)[i15],
        };
      }

      const arr = arrangementScore(current);
      let score = arr.score;
      if (price > (current.ma20 || price)) score += 5;
      if (price > (current.ma99 || price)) score += 5;
      if (price < (current.ma225 || price)) score -= 10;
      score = Math.max(0, Math.min(100, score));

      const tone =
        score >= 70 ? "偏多，回踩不破可观察加仓节奏" :
        score >= 45 ? "中性震荡，适合控仓与做 T" :
        "偏空防守，先保住仓位弹性";

      const pct = (v) => (v == null ? "--" : v.toFixed(2));
      const cls = change >= 0 ? "price-up" : "price-down";
      const sign = change >= 0 ? "+" : "";

      result.hidden = false;
      result.innerHTML = `
        <div class="result-head">
          <div>
            <h3>${name} <span style="color:var(--muted);font-size:0.9rem;">${info.type} · ${info.name}</span></h3>
            <div class="${cls}" style="font-family:var(--font-display);font-size:1.6rem;font-weight:700;">
              ${price.toFixed(2)} <span style="font-size:1rem;">${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)</span>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.8rem;color:var(--muted);">Miranda 评分</div>
            <div style="font-family:var(--font-display);font-size:2rem;font-weight:700;color:var(--teal-deep);">${score}</div>
            <div style="font-size:0.9rem;">${arr.label}</div>
          </div>
        </div>
        <div class="metric-grid">
          <div class="metric"><span>开盘 / 昨收</span><strong>${pct(open)} / ${pct(preClose)}</strong></div>
          <div class="metric"><span>最高 / 最低</span><strong>${pct(high)} / ${pct(low)}</strong></div>
          <div class="metric"><span>MA5</span><strong>${pct(current.ma5)}</strong></div>
          <div class="metric"><span>MA20</span><strong>${pct(current.ma20)}</strong></div>
          <div class="metric"><span>MA99</span><strong>${pct(current.ma99)}</strong></div>
          <div class="metric"><span>MA128</span><strong>${pct(current.ma128)}</strong></div>
          <div class="metric"><span>MA225</span><strong>${pct(current.ma225)}</strong></div>
          <div class="metric"><span>15-99</span><strong>${pct(m15.ma99)}</strong></div>
          <div class="metric"><span>15-225</span><strong>${pct(m15.ma225)}</strong></div>
        </div>
        <div class="callout">
          <strong>速读：</strong>${tone}<br />
          对 MA20：${trendLabel(price, current.ma20)} ·
          对 MA99：${trendLabel(price, current.ma99)} ·
          对 MA225：${trendLabel(price, current.ma225)}
          ${m15.ma99 != null ? `<br />做 T 参考：靠近 15-99(${pct(m15.ma99)}) 找买点，靠近 15-225(${pct(m15.ma225)}) 找卖点。` : ""}
        </div>
        <p style="font-size:0.82rem;color:var(--muted);margin-top:0.8rem;">自动分析仅供个人学习参考，不构成投资建议。</p>
      `;
    } catch (e) {
      error.hidden = false;
      error.textContent = e.message || "分析失败";
    } finally {
      loading.hidden = true;
    }
  }

  document.getElementById("analyzeBtn").addEventListener("click", analyzeStock);
  document.getElementById("stockInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") analyzeStock();
  });
  document.querySelectorAll(".tool-hints [data-fill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("stockInput").value = btn.dataset.fill;
      analyzeStock();
    });
  });

  // ---------- Review templates ----------
  function near(price, level, pct = 0.015) {
    if (price == null || level == null || level === 0) return false;
    return Math.abs(price - level) / level <= pct;
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function buildContext(quote, klines, m15Closes) {
    const closes = klines.map((k) => k.close);
    const highs = klines.map((k) => k.high);
    const lows = klines.map((k) => k.low);
    const vols = klines.map((k) => k.volume || 0);
    const last = closes.length - 1;
    const ma5 = calcMA(closes, 5);
    const ma20 = calcMA(closes, 20);
    const ma99 = calcMA(closes, 99);
    const ma128 = calcMA(closes, 128);
    const ma225 = calcMA(closes, 225);

    const recent = klines.slice(-8);
    const prev20High = Math.max(...highs.slice(-21, -1));
    const prev10High = Math.max(...highs.slice(-11, -1));
    const recentRange = Math.max(...recent.map((k) => k.high)) - Math.min(...recent.map((k) => k.low));
    const older = klines.slice(-20, -8);
    const olderRange = Math.max(...older.map((k) => k.high)) - Math.min(...older.map((k) => k.low));
    const volAvg10 = avg(vols.slice(-11, -1));
    const volLast = vols[last] || 0;
    const volPrev = vols[last - 1] || 0;

    const maBundle = [ma99[last], ma128[last], ma225[last]].filter((v) => v != null);
    const maSpread =
      maBundle.length === 3
        ? (Math.max(...maBundle) - Math.min(...maBundle)) / quote.price
        : null;

    let m15 = { ma99: null, ma128: null, ma225: null, last: null };
    if (m15Closes && m15Closes.length) {
      const i = m15Closes.length - 1;
      m15 = {
        ma99: calcMA(m15Closes, 99)[i],
        ma128: calcMA(m15Closes, 128)[i],
        ma225: calcMA(m15Closes, 225)[i],
        last: m15Closes[i],
      };
    }

    return {
      quote,
      klines,
      last,
      price: quote.price,
      ma: {
        ma5: ma5[last],
        ma20: ma20[last],
        ma99: ma99[last],
        ma128: ma128[last],
        ma225: ma225[last],
        ma20Prev: ma20[last - 1],
        ma99Prev: ma99[last - 1],
      },
      m15,
      prev20High,
      prev10High,
      recentRangePct: recentRange / quote.price,
      olderRangePct: olderRange / quote.price || 0.01,
      volAvg10,
      volLast,
      volPrev,
      maSpread,
      touchedMaToday:
        near(quote.low, ma99[last], 0.012) ||
        near(quote.low, ma128[last], 0.012) ||
        near(quote.low, ma225[last], 0.012) ||
        near(quote.price, ma99[last], 0.012) ||
        near(quote.price, ma128[last], 0.012) ||
        near(quote.price, ma225[last], 0.012),
      reclaimAfterPierce: (() => {
        const levels = [ma99[last], ma128[last], ma225[last]].filter(Boolean);
        return levels.some((lv) => quote.low < lv && quote.price >= lv * 0.998);
      })(),
      fadeFromHigh: quote.high > 0 ? (quote.high - quote.price) / quote.high >= 0.012 : false,
      weakUpVolume: quote.changePct > 0 && volLast > 0 && volLast < volAvg10 * 0.9,
      failedBreak: quote.high >= prev10High * 0.998 && quote.price < prev10High * 0.995,
    };
  }

  function matchTemplates(ctx) {
    const { price, ma, m15, quote } = ctx;
    const trendOk =
      (price >= (ma.ma20 || price) * 0.985 || (ma.ma20 != null && ma.ma20 >= (ma.ma20Prev || ma.ma20))) &&
      price >= (ma.ma225 || price) * 0.97;

    const pullback15 =
      (m15.ma99 != null && near(m15.last, m15.ma99, 0.012)) ||
      (m15.ma128 != null && near(m15.last, m15.ma128, 0.012)) ||
      (m15.ma225 != null && near(m15.last, m15.ma225, 0.012)) ||
      ctx.touchedMaToday;

    const shrinkVol = ctx.volLast > 0 && ctx.volLast < ctx.volAvg10 * 0.85;
    const clearStop =
      near(price, ma.ma99, 0.02) || near(price, ma.ma128, 0.02) || near(price, ma.ma225, 0.02);

    const converging = ctx.maSpread != null && ctx.maSpread <= 0.035;
    const narrowing = ctx.recentRangePct < ctx.olderRangePct * 0.75;
    const ma20TurnUp = ma.ma20 != null && ma.ma20Prev != null && ma.ma20 > ma.ma20Prev;
    const overlapLike =
      m15.ma99 != null &&
      ma.ma99 != null &&
      Math.abs(m15.ma99 - ma.ma99) / price <= 0.03;
    const tightBox = ctx.recentRangePct <= 0.06;

    const brokeOut = quote.high >= ctx.prev20High || price >= ctx.prev10High;
    const heldAfterBreak = brokeOut && price >= ctx.prev10High * 0.985;
    const retestHold =
      brokeOut &&
      price <= ctx.prev10High * 1.01 &&
      price >= ctx.prev10High * 0.985;
    const volNotCrazy = ctx.volLast <= ctx.volAvg10 * 2.2;

    const nearPressure =
      near(price, ctx.prev20High, 0.012) ||
      near(price, ma.ma99, 0.012) ||
      near(price, ma.ma128, 0.012) ||
      near(price, ma.ma225, 0.012) ||
      near(quote.high, ctx.prev20High, 0.01);
    const underMaAfterBreak =
      ctx.failedBreak &&
      ((ma.ma20 != null && price < ma.ma20) || (ma.ma5 != null && price < ma.ma5));

    const templates = [
      {
        id: "buyA",
        side: "buy",
        title: "买点 A · 强势回踩",
        action: "买入计划仓位的 20%–40%。反弹到压力位先看量：量不足做 T，放量站稳可留仓。",
        checks: [
          { ok: trendOk, text: "日线趋势未明显破坏" },
          { ok: pullback15, text: "回踩 99 / 128 / 225 附近" },
          { ok: shrinkVol, text: "回踩缩量" },
          { ok: ctx.reclaimAfterPierce || (ctx.touchedMaToday && price >= (ma.ma99 || price) * 0.995), text: "摸线或跌破后快速收回" },
          { ok: clearStop, text: "下方止损位清楚" },
        ],
      },
      {
        id: "buyB",
        side: "buy",
        title: "买点 B · 收敛变盘",
        action: "小仓试错，不满仓。靠近支撑买、靠近压力先 T；放量突破站稳再加，跌破收敛下沿止损。",
        checks: [
          { ok: converging, text: "99 / 128 / 225 逐渐靠近" },
          { ok: narrowing, text: "K 线波动变窄" },
          { ok: ma20TurnUp, text: "20 线开始拐头" },
          { ok: overlapLike || tightBox, text: "多周期重叠 / 箱体收窄" },
          { ok: tightBox, text: "上下压力支撑很近" },
        ],
      },
      {
        id: "buyC",
        side: "buy",
        title: "买点 C · 突破回踩确认",
        action: "回踩确认时买入；前高或下一条均线作第一卖点；二次放量突破可留底仓。",
        checks: [
          { ok: brokeOut, text: "已突破关键压力" },
          { ok: heldAfterBreak, text: "突破后没有快速跌回" },
          { ok: retestHold || (heldAfterBreak && near(price, ctx.prev10High, 0.015)), text: "回踩原压力不破" },
          { ok: volNotCrazy, text: "成交量没有明显失控" },
          { ok: trendOk, text: "大结构仍偏支持" },
        ],
      },
      {
        id: "sellA",
        side: "sell",
        title: "卖点 A · 压力位减仓",
        action: "卖 1/3 或 1/2。不确定先落袋；若回踩支撑不破，再考虑接回。",
        checks: [
          { ok: nearPressure, text: "靠近前高 / 均线 / 平台上沿" },
          { ok: ctx.weakUpVolume || (quote.changePct >= 0 && shrinkVol), text: "上攻量能不足" },
          { ok: ctx.fadeFromHigh, text: "盘中冲高回落" },
          { ok: quote.changePct < 1.5, text: "上攻力度一般，防板块分歧" },
        ],
      },
      {
        id: "sellB",
        side: "sell",
        title: "卖点 B · 突破失败",
        action: "短线仓先走，中线至少减仓；等重新站稳再考虑，不提前幻想。",
        checks: [
          { ok: ctx.failedBreak && ctx.volLast > ctx.volAvg10, text: "放量突破失败迹象" },
          { ok: underMaAfterBreak, text: "突破后跌回均线下方" },
          { ok: ctx.failedBreak && price < ctx.prev10High, text: "原压力未转支撑" },
          { ok: ctx.failedBreak && quote.changePct <= 0, text: "反弹尚未重新站上" },
        ],
      },
    ];

    return templates
      .map((t) => {
        const hit = t.checks.filter((c) => c.ok).length;
        const score = Math.round((hit / t.checks.length) * 100);
        return { ...t, hit, score };
      })
      .sort((a, b) => b.score - a.score || (a.side === "buy" ? -1 : 1));
  }

  function renderReviewResult(info, quote, ranked) {
    const best = ranked[0];
    const strong = ranked.filter((t) => t.score >= 60);
    const primary = strong[0] || best;
    const cls = quote.change >= 0 ? "price-up" : "price-down";
    const sign = quote.change >= 0 ? "+" : "";

    const cards = ranked
      .map((t) => {
        const checks = t.checks
          .map((c) => `<li class="${c.ok ? "check-ok" : "check-no"}">${c.ok ? "符合" : "未明"} · ${c.text}</li>`)
          .join("");
        return `
          <article class="match-item" data-id="${t.id}">
            <header>
              <h4>${t.title}</h4>
              <div class="match-score">匹配 ${t.score}%（${t.hit}/${t.checks.length}）</div>
            </header>
            <ul>${checks}</ul>
            <div class="action-box"><strong>操作建议：</strong>${t.action}</div>
          </article>
        `;
      })
      .join("");

    return `
      <div class="result-head">
        <div>
          <h3>${quote.name} <span style="color:var(--muted);font-size:0.9rem;">${info.type} · ${info.name}</span></h3>
          <div class="${cls}" style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;">
            ${quote.price.toFixed(2)}
            <span style="font-size:1rem;">${sign}${quote.change.toFixed(2)} (${sign}${quote.changePct.toFixed(2)}%)</span>
          </div>
        </div>
      </div>
      <div class="advice-banner" data-side="${primary.side}">
        <div class="eyebrow">${primary.side === "buy" ? "Buy Advice" : "Sell Advice"} · 当前更贴近</div>
        <h3>${primary.title}</h3>
        <p>${primary.action}</p>
        <p>匹配度 ${primary.score}%。请对照下方清单逐条复核，尤其是“未明”项要人工确认量能与板块。</p>
      </div>
      <div class="match-list">${cards}</div>
      <p style="font-size:0.82rem;color:var(--muted);">复盘模板仅供 Miranda 个人学习，不构成投资建议。板块支持/分歧需结合盘面人工判断。</p>
    `;
  }

  function highlightTemplateCards(ranked) {
    const hotId = (ranked.find((t) => t.score >= 60) || ranked[0] || {}).id;
    document.querySelectorAll(".template-card").forEach((card, idx) => {
      const map = ["buyA", "buyB", "buyC", "sellA", "sellB"];
      card.classList.toggle("is-hot", map[idx] === hotId);
    });
  }

  async function runReview() {
    const input = document.getElementById("reviewInput");
    const result = document.getElementById("reviewResult");
    const loading = document.getElementById("reviewLoading");
    const error = document.getElementById("reviewError");

    result.hidden = true;
    error.hidden = true;
    const code = input.value.trim();
    if (!code) {
      error.hidden = false;
      error.textContent = "请输入测试股票代码";
      return;
    }

    const info = getSecId(code);
    if (!info || !info.symbol) {
      error.hidden = false;
      error.textContent = "请输入可复盘的股票 / 指数代码（板块代码暂不支持完整复盘）。";
      return;
    }

    loading.hidden = false;
    loading.textContent = "拉取行情并对照模板...";
    try {
      const quote = await fetchQuote(info);
      loading.textContent = "计算均线与量能...";
      const klines = await fetchDayKlines(info.symbol);
      const m15 = await fetchMinuteCloses(info.symbol, 15, 250);
      const ctx = buildContext(quote, klines, m15);
      const ranked = matchTemplates(ctx);
      result.hidden = false;
      result.innerHTML = renderReviewResult(info, { ...quote, name: quote.name }, ranked);
      highlightTemplateCards(ranked);
      // sync into technical lab for convenience
      document.getElementById("stockInput").value = code;
    } catch (e) {
      error.hidden = false;
      error.textContent = e.message || "复盘失败";
    } finally {
      loading.hidden = true;
    }
  }

  document.getElementById("reviewBtn").addEventListener("click", runReview);
  document.getElementById("reviewInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runReview();
  });
  document.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("reviewInput").value = btn.dataset.review;
      runReview();
    });
  });

  // ---------- Index chart ----------
  function showIdxLoading(msg) {
    const el = document.getElementById("idxLoading");
    el.hidden = false;
    el.textContent = msg;
    document.getElementById("idxError").hidden = true;
  }

  function hideIdxLoading() {
    document.getElementById("idxLoading").hidden = true;
  }

  function showIdxError(msg) {
    const el = document.getElementById("idxError");
    el.hidden = false;
    el.textContent = msg;
    document.getElementById("idxMAValues").hidden = true;
    document.getElementById("idxPositionAlert").style.display = "none";
    hideIdxLoading();
  }

  async function fetchIdxData(code) {
    const cfg = IDX_CONFIG[code];
    showIdxLoading(`获取 ${cfg.name} 行情...`);
    try {
      const quote = await fetchQuote({ secid: cfg.secid, name: cfg.name });
      showIdxLoading(`获取 ${cfg.name} K 线...`);
      const klines = await fetchDayKlines(cfg.symbol);
      const closes = klines.map((k) => k.close);
      const ma99 = calcMA(closes, 99);
      const ma128 = calcMA(closes, 128);
      const ma225 = calcMA(closes, 225);
      const data = {
        name: cfg.name,
        price: quote.price,
        changeAmt: quote.change,
        changePct: quote.changePct,
        klines,
        ma99,
        ma128,
        ma225,
        lastMA99: ma99[ma99.length - 1],
        lastMA128: ma128[ma128.length - 1],
        lastMA225: ma225[ma225.length - 1],
      };
      idxDataCache[code] = data;
      hideIdxLoading();
      renderIdxChart(data);
    } catch (e) {
      showIdxError(`${cfg.name} 获取失败：${e.message}`);
    }
  }

  function renderIdxChart(data) {
    const canvas = document.getElementById("idxChartCanvas");
    const ctx = canvas.getContext("2d");
    const W = 900;
    const H = 480;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { klines, ma99, ma128, ma225, price, name, changeAmt, changePct } = data;
    const displayCount = Math.min(90, klines.length);
    const sliced = klines.slice(-displayCount);
    const ma99s = ma99.slice(-displayCount);
    const ma128s = ma128.slice(-displayCount);
    const ma225s = ma225.slice(-displayCount);

    let minP = Infinity;
    let maxP = -Infinity;
    sliced.forEach((k) => {
      maxP = Math.max(maxP, k.high);
      minP = Math.min(minP, k.low);
    });
    [ma99s, ma128s, ma225s].forEach((arr) => {
      arr.forEach((v) => {
        if (v != null) {
          maxP = Math.max(maxP, v);
          minP = Math.min(minP, v);
        }
      });
    });

    const padding = { top: 40, right: 70, bottom: 40, left: 55 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;
    const pad = (maxP - minP) * 0.06;
    const yMin = minP - pad;
    const yMax = maxP + pad;
    const yRange = yMax - yMin || 1;
    const gap = chartW / displayCount;
    const candleW = Math.max(2, gap * 0.68);
    const yPos = (p) => padding.top + chartH - ((p - yMin) / yRange) * chartH;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f7faf8";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(13,31,26,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = "#5a6e66";
      ctx.font = '11px "Noto Sans SC", sans-serif';
      ctx.textAlign = "right";
      ctx.fillText((yMax - (i / 5) * yRange).toFixed(1), padding.left - 8, y + 4);
    }

    function drawMA(values, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < displayCount; i++) {
        const v = values[i];
        if (v == null) {
          started = false;
          continue;
        }
        const x = padding.left + (i + 0.5) * gap;
        const y = yPos(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    drawMA(ma99s, "#0f7a64");
    drawMA(ma128s, "#c9952a");
    drawMA(ma225s, "#c23b2a");

    for (let i = 0; i < displayCount; i++) {
      const k = sliced[i];
      const x = padding.left + (i + 0.5) * gap;
      const up = k.close >= k.open;
      ctx.strokeStyle = up ? "#c23b2a" : "#1f7a4d";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yPos(k.high));
      ctx.lineTo(x, yPos(k.low));
      ctx.stroke();
      const top = yPos(Math.max(k.open, k.close));
      const bottom = yPos(Math.min(k.open, k.close));
      ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
    }

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#0f7a64";
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos(price));
    ctx.lineTo(W - padding.right, yPos(price));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#0d1f1a";
    ctx.font = 'bold 14px "Noto Serif SC", serif';
    ctx.textAlign = "left";
    ctx.fillText(name, padding.left, 22);
    ctx.fillStyle = changeAmt >= 0 ? "#c23b2a" : "#1f7a4d";
    ctx.font = '13px "Noto Sans SC", sans-serif';
    const changeStr =
      changeAmt >= 0
        ? `+${changeAmt.toFixed(2)} (+${changePct.toFixed(2)}%)`
        : `${changeAmt.toFixed(2)} (${changePct.toFixed(2)}%)`;
    ctx.fillText(`现价 ${price.toFixed(2)}  ${changeStr}`, padding.left + 90, 22);

    document.getElementById("idxNameDisplay").textContent = data.name;
    const priceEl = document.getElementById("idxPriceDisplay");
    priceEl.textContent = price.toFixed(2);
    priceEl.className = changeAmt >= 0 ? "price-up" : "price-down";
    document.getElementById("idxMA99Display").textContent = data.lastMA99?.toFixed(2) ?? "N/A";
    document.getElementById("idxMA128Display").textContent = data.lastMA128?.toFixed(2) ?? "N/A";
    document.getElementById("idxMA225Display").textContent = data.lastMA225?.toFixed(2) ?? "N/A";
    document.getElementById("idxMAValues").hidden = false;

    const alert = document.getElementById("idxPositionAlert");
    let msg = "指数处于均线之间，震荡观察，等待方向选择。";
    if (data.lastMA225 && price <= data.lastMA225 * 1.02) {
      msg = "接近 / 触及 MA225 结构底线区域，防守与决战并重，先看是否破位。";
    } else if (data.lastMA128 && price <= data.lastMA128 * 1.03) {
      msg = "位于 MA128 变盘点附近，重点观察量能是否配合。";
    } else if (data.lastMA99 && price <= data.lastMA99 * 1.03) {
      msg = "位于 MA99 中期分界附近，多空拉锯，不宜追涨杀跌。";
    } else if (data.lastMA99 && price > data.lastMA99) {
      msg = "运行于 MA99 上方，中期偏强，关注能否站稳。";
    }
    alert.style.display = "block";
    alert.textContent = msg;
  }

  document.querySelectorAll("#idxTabs [data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentIdx = btn.dataset.idx;
      document.querySelectorAll("#idxTabs [data-idx]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      if (idxDataCache[currentIdx]) renderIdxChart(idxDataCache[currentIdx]);
      else fetchIdxData(currentIdx);
    });
  });

  document.getElementById("refreshIdx").addEventListener("click", () => {
    delete idxDataCache[currentIdx];
    fetchIdxData(currentIdx);
  });

  setTimeout(() => fetchIdxData("000001"), 400);
})();
