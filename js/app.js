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

      const cls = change >= 0 ? "price-up" : "price-down";
      const sign = change >= 0 ? "+" : "";
      const ctx = buildContext(quote, klines, c15);
      const ranked = matchTemplates(ctx);
      const playbook = buildPlaybook(ctx, ranked);

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
        <div class="advice-banner" data-side="${playbook.primary.side}" style="margin-top:1rem;">
          <div class="eyebrow">综合买卖建议</div>
          <h3>${playbook.primary.title}</h3>
          <p>${playbook.primary.action}</p>
          <p>建议风格：${playbook.style} · 匹配 ${playbook.primary.score}%</p>
        </div>
        ${renderPlaybookHtml(playbook)}
        <p style="font-size:0.82rem;color:var(--muted);margin-top:0.8rem;">自动分析仅供个人学习参考，不构成投资建议。更完整模板清单见「复盘台」。</p>
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

  // ---------- Review engine (knowledge embedded, not displayed as docs) ----------
  // Internal playbook reference (Yange framework): style -> pool -> structure ->
  // key level -> position sizing -> review. MA5/20/99/128/225; day/120/15/5 roles;
  // support buy / pressure sell / confirm then 格局; sell 1/3~1/2 when unsure.
  function near(price, level, pct = 0.015) {
    if (price == null || level == null || level === 0) return false;
    return Math.abs(price - level) / level <= pct;
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function pct(v) {
    return v == null || Number.isNaN(v) ? "--" : Number(v).toFixed(2);
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
    const prev20Low = Math.min(...lows.slice(-21, -1));
    const recentRange = Math.max(...recent.map((k) => k.high)) - Math.min(...recent.map((k) => k.low));
    const older = klines.slice(-20, -8);
    const olderRange = Math.max(...older.map((k) => k.high)) - Math.min(...older.map((k) => k.low));
    const volAvg10 = avg(vols.slice(-11, -1));
    const volLast = vols[last] || 0;
    const volPrev = vols[last - 1] || 0;
    const dayAmp = quote.high > 0 && quote.low > 0 ? (quote.high - quote.low) / quote.low : 0;
    const avgAmp5 = avg(
      klines.slice(-5).map((k) => (k.low > 0 ? (k.high - k.low) / k.low : 0))
    );

    const maBundle = [ma99[last], ma128[last], ma225[last]].filter((v) => v != null);
    const maSpread =
      maBundle.length === 3
        ? (Math.max(...maBundle) - Math.min(...maBundle)) / quote.price
        : null;

    // First-touch heuristic: recently above the MA, now first approach within ~8 bars.
    function firstTouch(maArr, lookback = 12) {
      const lv = maArr[last];
      if (lv == null) return false;
      const nowNear = near(quote.price, lv, 0.015) || near(quote.low, lv, 0.015);
      if (!nowNear) return false;
      let priorTouches = 0;
      for (let i = last - lookback; i < last; i++) {
        if (i < 0 || maArr[i] == null) continue;
        if (lows[i] <= maArr[i] * 1.01 && highs[i] >= maArr[i] * 0.99) priorTouches++;
      }
      const wasAbove = closes.slice(last - lookback, last).filter((c, idx) => {
        const i = last - lookback + idx;
        return maArr[i] != null && c > maArr[i] * 1.01;
      }).length;
      return priorTouches <= 1 && wasAbove >= 3;
    }

    let m15 = { ma5: null, ma20: null, ma99: null, ma128: null, ma225: null, last: null };
    if (m15Closes && m15Closes.length) {
      const i = m15Closes.length - 1;
      m15 = {
        ma5: calcMA(m15Closes, 5)[i],
        ma20: calcMA(m15Closes, 20)[i],
        ma99: calcMA(m15Closes, 99)[i],
        ma128: calcMA(m15Closes, 128)[i],
        ma225: calcMA(m15Closes, 225)[i],
        last: m15Closes[i],
      };
    }

    const bullCount = [
      ma5[last] != null && ma20[last] != null && ma5[last] >= ma20[last],
      ma20[last] != null && ma99[last] != null && ma20[last] >= ma99[last],
      ma99[last] != null && ma128[last] != null && ma99[last] >= ma128[last],
      ma128[last] != null && ma225[last] != null && ma128[last] >= ma225[last],
    ].filter(Boolean).length;

    const arrangement =
      bullCount >= 3 ? "偏多头" : bullCount <= 1 ? "偏空头" : "粘合 / 过渡";

    const nearMa225 = near(quote.price, ma225[last], 0.02);
    const underLongPressure = ma225[last] != null && quote.price < ma225[last] && nearMa225;
    const structureRepair =
      ma225[last] != null &&
      quote.price < ma225[last] * 1.03 &&
      quote.price > (ma99[last] || quote.price) * 0.97;

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
        ma5Prev: ma5[last - 1],
        ma20Prev: ma20[last - 1],
        ma99Prev: ma99[last - 1],
      },
      m15,
      prev20High,
      prev10High,
      prev20Low,
      recentRangePct: recentRange / quote.price,
      olderRangePct: olderRange / quote.price || 0.01,
      volAvg10,
      volLast,
      volPrev,
      maSpread,
      dayAmp,
      avgAmp5,
      arrangement,
      bullCount,
      nearMa225,
      underLongPressure,
      structureRepair,
      firstTouch99: firstTouch(ma99),
      firstTouch128: firstTouch(ma128),
      firstTouch225: firstTouch(ma225),
      shrinkVol: volLast > 0 && volLast < volAvg10 * 0.85,
      expandVol: volLast > volAvg10 * 1.2,
      hugeVolNoRise: volLast > volAvg10 * 1.8 && quote.changePct <= 0.3,
      shrinkBreakout: quote.high >= prev10High && volLast > 0 && volLast < volAvg10 * 0.95,
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
      tFriendly: avgAmp5 >= 0.03 || dayAmp >= 0.035,
      tPoor: avgAmp5 > 0 && avgAmp5 < 0.02,
    };
  }

  function nearestLevels(ctx) {
    const { price, ma, prev20High, prev20Low } = ctx;
    const supports = [
      { name: "MA20", v: ma.ma20 },
      { name: "MA99", v: ma.ma99 },
      { name: "MA128", v: ma.ma128 },
      { name: "MA225", v: ma.ma225 },
      { name: "近20日低", v: prev20Low },
    ]
      .filter((x) => x.v != null && x.v <= price * 1.002)
      .sort((a, b) => b.v - a.v);
    const pressures = [
      { name: "前高/平台", v: prev20High },
      { name: "MA99", v: ma.ma99 },
      { name: "MA128", v: ma.ma128 },
      { name: "MA225", v: ma.ma225 },
      { name: "MA20", v: ma.ma20 },
    ]
      .filter((x) => x.v != null && x.v >= price * 0.998)
      .sort((a, b) => a.v - b.v);
    return {
      support: supports[0] || null,
      pressure: pressures[0] || null,
      supports,
      pressures,
    };
  }

  function roundPrice(v) {
    if (v == null || Number.isNaN(v)) return null;
    if (v >= 100) return Math.round(v * 100) / 100;
    if (v >= 10) return Math.round(v * 100) / 100;
    return Math.round(v * 1000) / 1000;
  }

  function buildPriceTargets(ctx, gate, ranked) {
    const levels = nearestLevels(ctx);
    const primary = ranked.find((t) => t.score >= 60) || ranked[0];
    const price = ctx.price;
    const ma = ctx.ma;

    // Prefer structural buy anchors by template type.
    let buyAnchor = levels.support;
    if (primary?.id === "buyA") {
      const pull = [ma.ma99, ma.ma128, ma.ma225]
        .filter((v) => v != null)
        .map((v) => ({ name: "回踩均线", v }))
        .sort((a, b) => Math.abs(a.v - price) - Math.abs(b.v - price))[0];
      if (pull) buyAnchor = { name: pull.name, v: pull.v };
    } else if (primary?.id === "buyC" && ctx.prev10High) {
      buyAnchor = { name: "突破回踩确认", v: ctx.prev10High };
    } else if (primary?.id === "buyB" && levels.support) {
      buyAnchor = levels.support;
    }

    let sellAnchor = levels.pressure;
    if (ctx.underLongPressure && ma.ma225 != null) {
      sellAnchor = { name: "MA225 长期压力", v: ma.ma225 };
    } else if (levels.pressure) {
      sellAnchor = levels.pressure;
    } else if (ctx.prev20High) {
      sellAnchor = { name: "前高/平台", v: ctx.prev20High };
    }

    const buyCore = buyAnchor?.v ?? price * 0.99;
    const sellCore = sellAnchor?.v ?? price * 1.02;
    // Keep a practical band around the anchor.
    const buyLow = roundPrice(Math.min(buyCore, price) * 0.995);
    const buyHigh = roundPrice(Math.min(Math.max(buyCore, buyCore * 1.005), price * 1.002));
    const sellLow = roundPrice(Math.max(sellCore * 0.995, price * 1.005));
    const sellHigh = roundPrice(sellCore * 1.008);
    const stop = roundPrice((buyAnchor?.v ?? price) * 0.985);

    const buyNow = gate.verdict === "yes";
    const buyLabel = buyNow ? "建议买入价" : "观察买入价";
    const sellLabel = "建议卖出价";

    let buyNote = buyAnchor
      ? `参考 ${buyAnchor.name} ${pct(buyAnchor.v)} 附近挂单/回踩确认。`
      : "下方支撑不清，价格仅作粗略参考。";
    let sellNote = sellAnchor
      ? `参考 ${sellAnchor.name} ${pct(sellAnchor.v)} 附近减仓或做 T。`
      : "上方压力不清，价格仅作粗略参考。";

    if (!buyNow) {
      buyNote = `当前不建议追价；等到 ${pct(buyLow)}–${pct(buyHigh)} 一带缩量回踩/确认再评估。`;
    }
    if (sellCore <= price * 1.003) {
      sellNote = `已靠近压力区，可按现价上方 ${pct(sellLow)}–${pct(sellHigh)} 分批减。`;
    }

    // If buy band is inverted/weird, fall back.
    const buyText =
      buyLow != null && buyHigh != null
        ? buyLow === buyHigh
          ? pct(buyLow)
          : `${pct(buyLow)} – ${pct(buyHigh)}`
        : "--";
    const sellText =
      sellLow != null && sellHigh != null
        ? sellLow === sellHigh
          ? pct(sellLow)
          : `${pct(sellLow)} – ${pct(sellHigh)}`
        : "--";

    return {
      buyLabel,
      sellLabel,
      buyText,
      sellText,
      buyNote,
      sellNote,
      stopText: stop != null ? pct(stop) : "--",
      stopNote: `放量跌破 ${stop != null ? pct(stop) : "支撑"} 且收不回，当笔逻辑失效。`,
      buyNow,
    };
  }

  function renderPriceTargetsHtml(targets) {
    return `
      <div class="price-targets">
        <div class="section-label" style="margin-bottom:0.55rem;">价格建议</div>
        <div class="price-grid">
          <div class="price-card" data-kind="buy">
            <span>${targets.buyLabel}</span>
            <strong>${targets.buyText}</strong>
            <p>${targets.buyNote}</p>
          </div>
          <div class="price-card" data-kind="sell">
            <span>${targets.sellLabel}</span>
            <strong>${targets.sellText}</strong>
            <p>${targets.sellNote}</p>
          </div>
          <div class="price-card" data-kind="stop">
            <span>止损参考价</span>
            <strong>${targets.stopText}</strong>
            <p>${targets.stopNote}</p>
          </div>
        </div>
      </div>
    `;
  }

  function matchTemplates(ctx) {
    const { price, ma, m15, quote } = ctx;
    const trendOk =
      (price >= (ma.ma20 || price) * 0.985 || (ma.ma20 != null && ma.ma20 >= (ma.ma20Prev || ma.ma20))) &&
      price >= (ma.ma225 || price) * 0.97;

    const structureOk = trendOk || ctx.structureRepair || ctx.arrangement !== "偏空头";
    const pullback15 =
      (m15.ma99 != null && near(m15.last, m15.ma99, 0.012)) ||
      (m15.ma128 != null && near(m15.last, m15.ma128, 0.012)) ||
      (m15.ma225 != null && near(m15.last, m15.ma225, 0.012)) ||
      ctx.touchedMaToday;
    const firstPullback = ctx.firstTouch99 || ctx.firstTouch128 || ctx.firstTouch225 || (pullback15 && structureOk);
    const shrinkVol = ctx.shrinkVol;
    const clearStop =
      near(price, ma.ma99, 0.02) || near(price, ma.ma128, 0.02) || near(price, ma.ma225, 0.02) || near(price, ma.ma20, 0.015);

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
    const volHealthyBreak = ctx.expandVol && !ctx.shrinkBreakout && !ctx.hugeVolNoRise;
    const volNotCrazy = ctx.volLast <= ctx.volAvg10 * 2.2;

    const nearPressure =
      near(price, ctx.prev20High, 0.012) ||
      near(price, ma.ma99, 0.012) ||
      near(price, ma.ma128, 0.012) ||
      near(price, ma.ma225, 0.012) ||
      near(quote.high, ctx.prev20High, 0.01) ||
      ctx.underLongPressure;
    const underMaAfterBreak =
      ctx.failedBreak &&
      ((ma.ma20 != null && price < ma.ma20) || (ma.ma5 != null && price < ma.ma5));

    const templates = [
      {
        id: "buyA",
        side: "buy",
        title: "买点 A · 强势回踩",
        action: "第一笔只买计划仓位 30%–40%。反弹到压力先看量：量不足做 T；放量站稳可留观察仓。破位不再补仓。",
        checks: [
          { ok: structureOk, text: "日线 / 结构趋势未明显破坏" },
          { ok: firstPullback || pullback15, text: "偏第一次回踩 99 / 128 / 225" },
          { ok: shrinkVol, text: "回踩缩量（卖压不大）" },
          { ok: ctx.reclaimAfterPierce || (ctx.touchedMaToday && price >= (ma.ma99 || price) * 0.995), text: "摸线或刺破后快速收回" },
          { ok: clearStop, text: "下方止损位清楚" },
        ],
      },
      {
        id: "buyB",
        side: "buy",
        title: "买点 B · 收敛变盘",
        action: "收敛区小仓试错，不满仓。靠近支撑买、靠近压力先 T；真正放量突破并站稳后再加；跌破收敛下沿立刻认错。",
        checks: [
          { ok: converging, text: "99 / 128 / 225 成本压缩靠近" },
          { ok: narrowing || tightBox, text: "波动变窄，进入方向选择题" },
          { ok: ma20TurnUp, text: "20 线开始拐头" },
          { ok: overlapLike || tightBox, text: "多周期重叠 / 箱体收窄" },
          { ok: !ctx.hugeVolNoRise, text: "未见巨量滞涨破坏收敛" },
        ],
      },
      {
        id: "buyC",
        side: "buy",
        title: "买点 C · 突破回踩确认",
        action: "不在第一次冲动突破满仓。回踩原压力不破时介入；前高或下一条均线作第一卖点；二次放量突破可保留底仓观察格局。",
        checks: [
          { ok: brokeOut, text: "已突破关键压力" },
          { ok: heldAfterBreak && !ctx.failedBreak, text: "突破后没有快速跌回" },
          { ok: retestHold || (heldAfterBreak && near(price, ctx.prev10High, 0.015)), text: "回踩原压力转为支撑确认" },
          { ok: volHealthyBreak || volNotCrazy, text: "量能健康，非缩量假突破 / 巨量失控" },
          { ok: structureOk, text: "大结构仍偏支持" },
        ],
      },
      {
        id: "sellA",
        side: "sell",
        title: "卖点 A · 压力位减仓",
        action: "不确定就卖 1/3 或 1/2 落袋。若回踩支撑不破，再滚动接回；无量冲高不要幻想午后一定继续。",
        checks: [
          { ok: nearPressure, text: "靠近前高 / 99·128·225 / 平台上沿" },
          { ok: ctx.weakUpVolume || ctx.shrinkBreakout || (quote.changePct >= 0 && shrinkVol), text: "上攻量能不足或缩量冲高" },
          { ok: ctx.fadeFromHigh || ctx.hugeVolNoRise, text: "冲高回落或巨量不涨" },
          { ok: quote.changePct < 2 || ctx.underLongPressure, text: "延续性存疑，防分歧兑现" },
        ],
      },
      {
        id: "sellB",
        side: "sell",
        title: "卖点 B · 突破失败",
        action: "短线仓先走，中线至少减仓。原压力未转支撑前不提前幻想；等重新站稳再谈下一笔。",
        checks: [
          { ok: ctx.failedBreak && (ctx.expandVol || ctx.volLast > ctx.volAvg10), text: "放量突破失败迹象" },
          { ok: underMaAfterBreak, text: "突破后跌回均线下方" },
          { ok: ctx.failedBreak && price < ctx.prev10High, text: "原压力没有转支撑" },
          { ok: ctx.failedBreak && quote.changePct <= 0.2, text: "反弹尚未重新站上" },
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

  function getHoldStatus() {
    const checked = document.querySelector('input[name="holdStatus"]:checked');
    return checked ? checked.value : "flat";
  }

  function decideEntryGate(ctx, ranked) {
    const buyBest = ranked.filter((t) => t.side === "buy").sort((a, b) => b.score - a.score)[0];
    const sellBest = ranked.filter((t) => t.side === "sell").sort((a, b) => b.score - a.score)[0];
    const reasons = [];

    const hardNo =
      (sellBest && sellBest.id === "sellB" && sellBest.score >= 60) ||
      ctx.failedBreak ||
      (ctx.arrangement === "偏空头" && (!buyBest || buyBest.score < 60)) ||
      (ctx.hugeVolNoRise && sellBest && sellBest.score >= 50);

    if (hardNo) {
      if (ctx.failedBreak || (sellBest && sellBest.id === "sellB" && sellBest.score >= 60)) {
        reasons.push("更像突破失败 / 假突破，不宜新开多仓。");
      }
      if (ctx.arrangement === "偏空头") reasons.push("均线结构偏空，先防守。");
      if (ctx.hugeVolNoRise) reasons.push("出现巨量不涨，资金态度偏分歧。");
      if (sellBest && sellBest.score >= 60) reasons.push(`卖点模板更匹配：${sellBest.title}（${sellBest.score}%）。`);
      return {
        verdict: "no",
        title: "不建议买入",
        summary: "当前更适合空手观望，或只处理已有持仓，不新增仓位。",
        reasons,
        buyBest,
        sellBest,
      };
    }

    const waitLike =
      (ctx.underLongPressure && (!buyBest || buyBest.score < 80)) ||
      (sellBest && sellBest.id === "sellA" && sellBest.score >= 60 && (!buyBest || buyBest.score < 80)) ||
      (buyBest && buyBest.score < 60) ||
      (buyBest && sellBest && sellBest.score >= buyBest.score);

    if (waitLike) {
      if (ctx.underLongPressure) reasons.push("靠近长期压力（如 MA225 / 前高一带），追高性价比低。");
      if (sellBest && sellBest.score >= 60) reasons.push(`压力/卖点信号不弱：${sellBest.title}（${sellBest.score}%）。`);
      if (!buyBest || buyBest.score < 60) reasons.push("买点模板匹配度不够，条件未齐。");
      if (ctx.arrangement === "粘合 / 过渡") reasons.push("结构仍在过渡，方向未清前先等。");
      return {
        verdict: "wait",
        title: "暂不建议买入",
        summary: "可以盯着，但现在还不到动手位置；等回踩确认、收敛选向或突破站稳再说。",
        reasons,
        buyBest,
        sellBest,
      };
    }

    reasons.push(`买点更贴近：${buyBest.title}（${buyBest.score}%）。`);
    if (buyBest.id === "buyA") reasons.push("强势回踩逻辑成立时，只适合分批低吸，不追高。");
    if (buyBest.id === "buyB") reasons.push("收敛变盘区先小仓试错，不满仓赌方向。");
    if (buyBest.id === "buyC") reasons.push("突破后回踩确认，比第一次冲动追突破更稳。");
    if (ctx.tPoor) reasons.push("振幅偏小，即使试仓也要降低做 T 预期。");

    return {
      verdict: "yes",
      title: buyBest.score >= 80 ? "可小仓试错" : "可分批关注",
      summary: "技术条件相对更好，但仍要先过主营/主线人工闸门，再按仓位计划执行。",
      reasons,
      buyBest,
      sellBest,
    };
  }

  function buildHoldingAdvice(ctx, ranked, gate, holdStatus) {
    const levels = nearestLevels(ctx);
    const supportTxt = levels.support ? `${levels.support.name} ${pct(levels.support.v)}` : "下方关键支撑";
    const pressureTxt = levels.pressure ? `${levels.pressure.name} ${pct(levels.pressure.v)}` : "上方关键压力";
    const primary = ranked.find((t) => t.score >= 60) || ranked[0];
    const items = [];

    if (holdStatus === "flat") {
      if (gate.verdict === "no") {
        items.push("空仓：继续空手，不因为盘中拉升临时追进去。");
        items.push(`观察位：回落到 ${supportTxt} 且缩量、能收回，再重新评估。`);
        items.push(`若向上，也要等放量突破 ${pressureTxt} 并站稳，而不是半路接飞刀/追高。`);
      } else if (gate.verdict === "wait") {
        items.push("空仓：先写计划，不提前挂大单。");
        items.push(`触发再看：缩量回踩 ${supportTxt}，或放量突破 ${pressureTxt} 后回踩不破。`);
        items.push("在触发前，现金本身就是仓位。");
      } else {
        items.push(`空仓开仓：第一笔只做计划仓 30%–40%，参考 ${supportTxt}。`);
        items.push("不要一次买满；第二笔留给下一支撑或突破确认。");
        items.push("建仓期少做 T，避免把低成本筹码卖飞。");
      }
      return {
        title: "持仓情况：空仓",
        items,
      };
    }

    // has position
    if (gate.verdict === "no" || (primary && primary.side === "sell" && primary.score >= 60)) {
      items.push(
        holdStatus === "heavy"
          ? "重仓：优先减负，先卖 1/3 到 1/2，把心态和风险降下来。"
          : "轻仓：可先卖一部分锁定，或严格按压力位条件单处理。"
      );
      items.push(`压力区 ${pressureTxt}：量能不足就落袋，不幻想午后必拉。`);
      items.push(`若放量跌破 ${supportTxt} 且收不回：短线仓先走，中线至少再减。`);
      if (ctx.tFriendly && gate.verdict !== "no") {
        items.push("若结构只是转弱未破位，可用剩余仓位高抛低吸做 T，但破位停止接回。");
      } else {
        items.push("当前更像防守阶段，减少无效做 T，先把风险降下来。");
      }
    } else if (gate.verdict === "wait") {
      items.push("已有仓位：先不加仓，让利润/亏损都交给既定支撑压力管理。");
      items.push(`靠近 ${pressureTxt}：可先做 T 卖出一部分；回踩 ${supportTxt} 不破再接。`);
      items.push(holdStatus === "heavy" ? "重仓时更要主动降仓到舒服位置。" : "轻仓可继续观察，但别把轻仓做成重仓。");
    } else {
      const canGeJu =
        primary.side === "buy" &&
        (primary.id === "buyC" || (ctx.arrangement === "偏多头" && !ctx.underLongPressure)) &&
        primary.score >= 60 &&
        !ctx.failedBreak;

      items.push(
        holdStatus === "heavy"
          ? "已有重仓：原则上不再大幅加仓，只做结构确认后的微调。"
          : "已有轻仓：若回踩确认仍有效，可按计划小幅补到舒适仓位。"
      );
      items.push(
        canGeJu
          ? "结构偏格局：不必在第一个小压力全卖，可留底仓看二次上攻。"
          : "结构更偏做 T / 波段：压力减、支撑接，不要无脑长拿。"
      );
      items.push(`认错位不变：放量跌破 ${supportTxt} 且收不回，就减仓或退出。`);
    }

    return {
      title: holdStatus === "heavy" ? "持仓情况：已有重仓" : "持仓情况：已有轻仓",
      items,
    };
  }

  function buildPlaybook(ctx, ranked, holdStatus = "flat") {
    const gate = decideEntryGate(ctx, ranked);
    const primary = ranked.find((t) => t.score >= 60) || ranked[0];
    const levels = nearestLevels(ctx);
    const supportTxt = levels.support ? `${levels.support.name} ${pct(levels.support.v)}` : "下方需人工标支撑";
    const pressureTxt = levels.pressure ? `${levels.pressure.name} ${pct(levels.pressure.v)}` : "上方需人工标压力";
    const holding = buildHoldingAdvice(ctx, ranked, gate, holdStatus);

    const canGeJu =
      gate.verdict === "yes" &&
      primary.side === "buy" &&
      (primary.id === "buyC" || (ctx.arrangement === "偏多头" && !ctx.underLongPressure)) &&
      primary.score >= 60 &&
      !ctx.failedBreak &&
      !ctx.shrinkBreakout;

    let style = "观望 / 不新开仓";
    if (gate.verdict === "no") style = "不建议买入 · 先处理风险";
    else if (gate.verdict === "wait") style = "暂不买入 · 等待触发";
    else if (canGeJu) style = "可小仓试错 · 部分可格局";
    else if (ctx.tFriendly) style = "可小仓试错 · 偏做 T";
    else style = "可分批关注 · 严格仓位";

    const buyPlan =
      gate.verdict === "yes"
        ? [
            `第一笔：关键支撑附近试仓 30%–40%（参考 ${supportTxt}）。`,
            "第二笔：若回落下一支撑且大逻辑未破，再补 30%–40%；破位停止补仓。",
            "第三笔：仅在突破后横盘确认 / 二次放量突破时补剩余。",
            canGeJu
              ? "风格：突破确认后可保留部分仓位观察二次上攻，不要在第一个小压力全部卖飞。"
              : "风格：更适合做 T 或波段差价，未确认大级别结构前不要无脑格局。",
          ]
        : [
            "当前结论是不新开仓或暂不买入，仓位计划先写成「触发条件」，而不是立刻下单。",
            `关注触发：缩量回踩 ${supportTxt}，或放量突破 ${pressureTxt} 后站稳。`,
            "触发前保持现金，比提前上车更重要。",
          ];

    const sellPlan = [
      `第一卖点 / 压力观察：${pressureTxt}。`,
      ctx.weakUpVolume || ctx.shrinkBreakout
        ? "量能偏弱：靠近压力优先落袋，不赌午后一定继续。"
        : "若放量突破并站稳，可留底仓，等二次确认。",
      ctx.tFriendly
        ? "日内振幅够，适合围绕支撑压力做 T（尽量覆盖手续费与滑点，2% 以内慎做）。"
        : "振幅一般，做 T 空间有限，减少无效抖动交易。",
    ];

    const invalidation = [
      levels.support
        ? `若放量跌破 ${levels.support.name}（${pct(levels.support.v)}）且收不回，当笔逻辑失效。`
        : "若关键支撑放量跌破且收不回，当笔逻辑失效。",
      "建仓期少做 T，避免把低成本筹码卖飞；只有破位或达到预设盈利才卖。",
      "主力线/板块/主营是否贴合主线，必须人工确认后再加仓。",
    ];

    const manualGate = [
      "F10：主营是否真贴合题材，而非只是蹭概念。",
      "主线：当前是主线票、梯队博弈，还是杂毛。",
      "板块与大盘：个股强弱是否得到板块支持。",
      "风格：长线 / 中线 / 短线 / 做 T 不要混用同一套预期。",
    ];

    return {
      gate,
      holding,
      primary,
      style,
      supportTxt,
      pressureTxt,
      canGeJu,
      buyPlan,
      sellPlan,
      invalidation,
      manualGate,
      arrangement: ctx.arrangement,
      holdStatus,
    };
  }

  function renderPlaybookHtml(playbook) {
    const list = (items) => items.map((x) => `<li>${x}</li>`).join("");
    const showBuyPlan = playbook.gate.verdict === "yes";
    return `
      <div class="playbook">
        <div class="metric-grid">
          <div class="metric"><span>建议风格</span><strong>${playbook.style}</strong></div>
          <div class="metric"><span>均线结构</span><strong>${playbook.arrangement}</strong></div>
          <div class="metric"><span>参考支撑</span><strong>${playbook.supportTxt}</strong></div>
          <div class="metric"><span>参考压力</span><strong>${playbook.pressureTxt}</strong></div>
        </div>
        <div class="split" style="margin-top:1rem;">
          <div class="plain-block">
            <h3>${showBuyPlan ? "若决定试仓" : "等待触发后再谈买"}</h3>
            <ul>${list(playbook.buyPlan)}</ul>
          </div>
          <div class="plain-block">
            <h3>卖出 / 做 T</h3>
            <ul>${list(playbook.sellPlan)}</ul>
          </div>
        </div>
        <div class="callout" style="margin-top:1rem;">
          <strong>认错位置：</strong>
          <ul style="margin-top:0.4rem;">${list(playbook.invalidation)}</ul>
        </div>
        <div class="callout quote" style="margin-top:0.8rem;">
          <strong>下单前人工闸门（系统无法自动判断）：</strong>
          <ul style="margin-top:0.4rem;">${list(playbook.manualGate)}</ul>
        </div>
      </div>
    `;
  }

  function renderReviewResult(info, quote, ranked, ctx, holdStatus = "flat") {
    const playbook = buildPlaybook(ctx, ranked, holdStatus);
    const gate = playbook.gate;
    const targets = buildPriceTargets(ctx, gate, ranked);
    const cls = quote.change >= 0 ? "price-up" : "price-down";
    const sign = quote.change >= 0 ? "+" : "";
    const reasonHtml = gate.reasons.map((r) => `<li>${r}</li>`).join("");
    const holdingHtml = playbook.holding.items.map((r) => `<li>${r}</li>`).join("");

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
            <div class="action-box"><strong>模板动作：</strong>${t.action}</div>
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

      <div class="verdict-banner" data-verdict="${gate.verdict}">
        <div class="eyebrow">第一步 · 买入结论</div>
        <h3>${gate.title}</h3>
        <p>${gate.summary}</p>
        <ul class="verdict-reasons">${reasonHtml}</ul>
      </div>

      <div class="position-panel">
        <h3>第二步 · ${playbook.holding.title}</h3>
        <ul>${holdingHtml}</ul>
      </div>

      ${renderPriceTargetsHtml(targets)}

      ${renderPlaybookHtml(playbook)}
      <div class="match-list">${cards}</div>
      <p style="font-size:0.82rem;color:var(--muted);">流程：先判断买不买 → 再按持仓处理 → 给出买卖价格带 → 最后看模板细节。价格为技术位参考，不构成投资建议。</p>
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
      const holdStatus = getHoldStatus();
      result.hidden = false;
      result.innerHTML = renderReviewResult(info, { ...quote, name: quote.name }, ranked, ctx, holdStatus);
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
