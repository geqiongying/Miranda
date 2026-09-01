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
  const ENGINE = document.body?.dataset?.engine || "all"; // ma | volume | wuge | all
  const MA_TEMPLATE_IDS = new Set(["buyA", "buyB", "buyC", "sellA", "sellB"]);
  const VOL_TEMPLATE_IDS = new Set(["buyVol", "buyCtrl", "buyCons", "sellVol"]);
  const WUGE_TEMPLATE_IDS = new Set(["buyProbe", "buyProbePull", "buyDragon", "sellProbeFail", "sellDragonTop"]);

  // ---------- UI helpers ----------
  const nav = document.getElementById("siteNav");
  window.addEventListener("scroll", () => {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 20);
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
  if (chips.length && explain) {
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        explain.textContent = CODE_MAP[chip.dataset.code] || "";
      });
    });
  }

  // ---------- Network / market data ----------
  function fetchJsonp(url, timeoutMs = 12000, cbParam = "cb") {
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
      script.src = `${url}${joiner}${cbParam}=${cbName}`;
      document.head.appendChild(script);
    });
  }

  async function fetchCorsJson(url, timeoutMs = 12000) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const resp = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        signal: ctrl?.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      const msg = e?.message || String(e);
      if (/abort/i.test(msg)) throw new Error("行情请求超时");
      if (/load failed|failed to fetch|networkerror|network error/i.test(msg)) {
        throw new Error("Load failed");
      }
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function friendlyNetError(e) {
    const msg = e?.message || String(e);
    if (/load failed|failed to fetch|networkerror|network error|行情接口加载失败|行情请求超时/i.test(msg)) {
      return "行情接口暂时拉不到（常见于手机 Safari / 网络拦截），已可自动换源重试；请再点一次提问。";
    }
    return msg;
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
    if (/^30\d{4}$/.test(code)) return { secid: "0." + code, symbol: "sz" + code, type: "股票", name: code };
    if (/^[48]\d{5}$/.test(code)) return { secid: "0." + code, symbol: "bj" + code, type: "股票", name: code };
    // ETF: 15xxxx / 16xxxx / 18xxxx (SZ), 51xxxx / 56xxxx / 58xxxx (SH)
    if (/^(15|16|18)\d{4}$/.test(code)) return { secid: "0." + code, symbol: "sz" + code, type: "ETF", name: code };
    if (/^(51|56|58)\d{4}$/.test(code)) return { secid: "1." + code, symbol: "sh" + code, type: "ETF", name: code };
    return null;
  }

  async function fetchQuote(info) {
    const url = `https://push2delay.eastmoney.com/api/qt/stock/get?secid=${info.secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170`;
    const quoteData = await fetchJsonp(url);
    if (!quoteData.data) throw new Error("未找到该代码数据，请检查是否输入正确");
    const q = quoteData.data;
    const price = Number(q.f43) / 100;
    const preClose = Number(q.f60) / 100;
    return {
      name: q.f58 || info.name,
      price: Number.isFinite(price) ? price : 0,
      high: Number(q.f44) / 100 || 0,
      low: Number(q.f45) / 100 || 0,
      open: Number(q.f46) / 100 || 0,
      preClose: Number.isFinite(preClose) ? preClose : 0,
      change: Number(q.f169) / 100 || 0,
      changePct: Number(q.f170) / 100 || 0,
    };
  }

  function mapTencentDayRows(symbol, data) {
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

  async function fetchDayKlinesTencent(symbol, baseUrl) {
    const url = `${baseUrl}?param=${symbol},day,,,260,qfq`;
    const data = await fetchCorsJson(url);
    return mapTencentDayRows(symbol, data);
  }

  async function fetchDayKlinesEastmoney(secid) {
    const url =
      "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=" +
      encodeURIComponent(secid) +
      "&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=260";
    const data = await fetchJsonp(url, 18000);
    const rows = data?.data?.klines;
    if (!Array.isArray(rows) || !rows.length) throw new Error("东财 K 线为空");
    return rows.map((line) => {
      const p = String(line).split(",");
      return {
        date: p[0],
        open: parseFloat(p[1]),
        close: parseFloat(p[2]),
        high: parseFloat(p[3]),
        low: parseFloat(p[4]),
        volume: parseFloat(p[5] || 0),
      };
    });
  }

  async function fetchDayKlinesSohu(code) {
    const end = new Date();
    const start = new Date(end.getTime() - 420 * 86400000);
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}${m}${day}`;
    };
    const url =
      "https://q.stock.sohu.com/hisHq?code=cn_" +
      encodeURIComponent(code) +
      "&start=" +
      fmt(start) +
      "&end=" +
      fmt(end) +
      "&stat=1&order=A&period=d&rt=jsonp";
    const data = await fetchJsonp(url, 18000, "callback");
    const block = Array.isArray(data) ? data[0] : null;
    const rows = block?.hq;
    if (!Array.isArray(rows) || !rows.length) throw new Error("搜狐 K 线为空");
    return rows.map((r) => ({
      date: r[0],
      open: parseFloat(r[1]),
      close: parseFloat(r[2]),
      low: parseFloat(r[5]),
      high: parseFloat(r[6]),
      volume: parseFloat(r[7] || 0),
    }));
  }

  async function fetchDayKlines(symbol, secid) {
    if (!symbol && !secid) throw new Error("该代码暂不支持 K 线拉取（如部分板块）");
    const code = String(symbol || "").replace(/^(sh|sz|bj)/i, "") || String(secid || "").split(".").pop();
    const attempts = [];
    if (symbol) {
      attempts.push(() =>
        fetchDayKlinesTencent(symbol, "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get")
      );
      attempts.push(() =>
        fetchDayKlinesTencent(symbol, "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/fqkline/get")
      );
    }
    if (secid) attempts.push(() => fetchDayKlinesEastmoney(secid));
    if (/^\d{6}$/.test(code)) attempts.push(() => fetchDayKlinesSohu(code));

    let lastErr = null;
    for (const run of attempts) {
      try {
        const bars = await run();
        if (bars && bars.length) return bars;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(friendlyNetError(lastErr || new Error("未能获取 K 线数据")));
  }

  async function fetchMinuteClosesEastmoney(secid, minutes = 15, count = 250) {
    const url =
      "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=" +
      encodeURIComponent(secid) +
      "&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56&klt=" +
      minutes +
      "&fqt=1&end=20500101&lmt=" +
      count;
    const data = await fetchJsonp(url, 15000);
    const rows = data?.data?.klines;
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows.map((line) => parseFloat(String(line).split(",")[2]));
  }

  async function fetchMinuteCloses(symbol, minutes = 15, count = 250, secid = null) {
    if (symbol) {
      const bases = [
        "https://web.ifzq.gtimg.cn/appstock/app/kline/mkline",
        "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/kline/mkline",
      ];
      for (const base of bases) {
        try {
          const url = `${base}?param=${symbol},m${minutes},,${count}`;
          const data = await fetchCorsJson(url);
          const node = data?.data?.[symbol];
          const rows = node?.[`m${minutes}`];
          if (rows && rows.length) return rows.map((r) => parseFloat(r[2]));
        } catch (_) {
          /* try next */
        }
      }
    }
    if (secid) {
      try {
        return await fetchMinuteClosesEastmoney(secid, minutes, count);
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function quoteFromKlines(name, klines) {
    const last = klines[klines.length - 1];
    const prev = klines[klines.length - 2] || last;
    const change = last.close - prev.close;
    const changePct = prev.close ? (change / prev.close) * 100 : 0;
    return {
      name: name || "未知",
      price: last.close,
      high: last.high,
      low: last.low,
      open: last.open,
      preClose: prev.close,
      change,
      changePct,
    };
  }

  async function resolveQuoteAndBars(info) {
    let quote = null;
    try {
      quote = await fetchQuote(info);
    } catch (_) {
      quote = null;
    }
    const klines = await fetchDayKlines(info.symbol, info.secid);
    if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) {
      quote = quoteFromKlines(quote?.name || info.name, klines);
    }
    return { quote, klines };
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
      const pack = await resolveQuoteAndBars(info);
      const quote = pack.quote;
      const { name, price, change, changePct, high, low, open, preClose } = quote;

      loading.textContent = "计算日线均线...";
      const klines = pack.klines;
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
      const c15 = await fetchMinuteCloses(info.symbol, 15, 250, info.secid);
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
      error.textContent = friendlyNetError(e);
    } finally {
      loading.hidden = true;
    }
  }

  const analyzeBtn = document.getElementById("analyzeBtn");
  const stockInputEl = document.getElementById("stockInput");
  if (analyzeBtn && stockInputEl) {
    analyzeBtn.addEventListener("click", analyzeStock);
    stockInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") analyzeStock();
    });
    document.querySelectorAll(".tool-hints [data-fill]").forEach((btn) => {
      btn.addEventListener("click", () => {
        stockInputEl.value = btn.dataset.fill;
        analyzeStock();
      });
    });
  }

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
    const opens = klines.map((k) => k.open);
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
      // --- 作手老严录像 · 量能篇（Release Videos-Laoyao）---
      ...(() => {
        const prev5VolMax = Math.max(...vols.slice(-6, -1).filter((v) => v > 0), 0);
        const look60 = vols.slice(-61, -1);
        const peakVol60 = Math.max(...look60.filter((v) => v > 0), 0);
        const doubleOverPrev5 = prev5VolMax > 0 && volLast >= prev5VolMax * 2;
        const tripleVol = volAvg10 > 0 && volLast >= volAvg10 * 2.8;
        const last3 = klines.slice(-3);
        const threeUp =
          last3.length === 3 && last3.every((k, i) => i === 0 || k.close >= last3[i - 1].close);
        const threeUpGain =
          threeUp && last3[0].open > 0 ? (last3[2].close - last3[0].open) / last3[0].open : 0;
        const threeUp10 = threeUp && threeUpGain >= 0.1;
        const win = klines.slice(-12);
        let maxVolBar = win[0];
        win.forEach((k) => {
          if ((k.volume || 0) >= (maxVolBar.volume || 0)) maxVolBar = k;
        });
        const maxVolBodyLow = Math.min(maxVolBar.open, maxVolBar.close);
        const maxVolBodyMid = (maxVolBar.open + maxVolBar.close) / 2;
        const maxVolBodyHigh = Math.max(maxVolBar.open, maxVolBar.close);
        const barRange = quote.high - quote.low;
        const lowerShadow = Math.min(quote.open, quote.price) - quote.low;
        const longLowerShadow = barRange > 0 && lowerShadow / barRange >= 0.5;
        const needle2x =
          barRange > 0 &&
          Math.abs(quote.open - quote.price) > 0 &&
          lowerShadow / Math.max(Math.abs(quote.open - quote.price), quote.price * 0.001) >= 2;
        const nearMa20 = ma20[last] != null && near(quote.price, ma20[last], 0.02);
        const stackVol =
          vols[last] > 0 &&
          vols[last - 1] > 0 &&
          vols[last] >= vols[last - 1] &&
          closes[last] >= closes[last - 1] &&
          closes[last - 1] >= (closes[last - 2] || 0);
        const quarterVsMax =
          (maxVolBar.volume || 0) > 0 && volLast > 0 && volLast <= maxVolBar.volume * 0.28;
        const nearCostLow = near(quote.price, maxVolBodyLow, 0.02) || near(quote.low, maxVolBodyLow, 0.02);
        const nearCostHalf = near(quote.price, maxVolBodyMid, 0.02) || near(quote.low, maxVolBodyMid, 0.02);
        const reclaimCost =
          quote.low <= maxVolBodyLow * 1.005 && quote.price >= maxVolBodyHigh * 0.995;
        const shrinkHalfVsMax =
          (maxVolBar.volume || 0) > 0 && volLast > 0 && volLast <= maxVolBar.volume * 0.55;
        const entityNewHigh = quote.price >= Math.max(...closes.slice(-6, -1)) * 0.998;
        const volExceedsPriorPeak = peakVol60 > 0 && volLast >= peakVol60 * 0.98;
        const stagnantHuge = volLast >= volAvg10 * 1.6 && Math.abs(quote.changePct) <= 0.6;
        // 启动发生在近端（今日或昨日），洗盘则是今日相对最大量收缩
        const launchRecent =
          doubleOverPrev5 ||
          tripleVol ||
          (vols[last - 1] > 0 && prev5VolMax > 0 && vols[last - 1] >= prev5VolMax * 2) ||
          (volAvg10 > 0 && vols[last - 1] >= volAvg10 * 2.8);
        const washToday = shrinkHalfVsMax || quarterVsMax || (volAvg10 > 0 && volLast < volAvg10 * 0.85);
        // 强控盘近似：近几日上涨但量不夸张，今日缩量回踩
        const quietRise =
          closes[last] >= closes[Math.max(0, last - 5)] &&
          volAvg10 > 0 &&
          avg(vols.slice(-6)) <= volAvg10 * 1.15;
        const ctrlPullback = quietRise && washToday && (near(quote.low, ma20[last], 0.025) || nearCostHalf || nearCostLow);
        return {
          doubleOverPrev5,
          tripleVol,
          threeUp10,
          maxVolBodyLow,
          maxVolBodyMid,
          nearCostLow,
          nearCostHalf,
          shrinkHalfVsMax,
          entityNewHigh,
          volExceedsPriorPeak,
          stagnantHuge,
          volLaunchOk: doubleOverPrev5 || threeUp10 || tripleVol,
          longLowerShadow,
          needle2x,
          nearMa20,
          stackVol,
          quarterVsMax,
          reclaimCost,
          launchRecent,
          washToday,
          quietRise,
          ctrlPullback,
          heldAboveDivLow:
            maxVolBodyLow != null ? quote.low >= maxVolBodyLow * 0.985 : false,
        };
      })(),
      // --- 五哥笔记 · 试盘线 / 龙头技术近似 ---
      ...(() => {
        let probeIdx = -1;
        let probeBar = null;
        for (let i = last; i >= Math.max(0, last - 12); i--) {
          const k = klines[i];
          const prevV = i > 0 ? vols[i - 1] : 0;
          const range = k.high - k.low;
          const body = Math.abs(k.close - k.open);
          const upper = k.high - Math.max(k.open, k.close);
          const longUpper = range > 0 && upper / Math.max(k.close, 0.01) >= 0.035 && upper >= body * 0.85;
          const triple = prevV > 0 && (k.volume || 0) >= prevV * 3;
          const priorHigh = Math.max(...highs.slice(Math.max(0, i - 20), i), 0);
          const broke = priorHigh > 0 && k.high >= priorHigh * 0.998;
          if (longUpper && triple && broke) {
            probeIdx = i;
            probeBar = k;
            break;
          }
        }
        const daysSinceProbe = probeIdx >= 0 ? last - probeIdx : null;
        const yest = last >= 1 ? klines[last - 1] : null;
        const yestPrev = last >= 2 ? klines[last - 2] : null;
        const yestPct =
          yest && yestPrev && yestPrev.close > 0
            ? ((yest.close - yestPrev.close) / yestPrev.close) * 100
            : 0;
        const yestNotLimit = yestPct < 9.5;
        const todayRange = quote.high - quote.low;
        const todayUpper = quote.high - Math.max(quote.open, quote.price);
        const todayBody = Math.abs(quote.price - quote.open);
        const todayLongUpper =
          todayRange > 0 && todayUpper / Math.max(quote.price, 0.01) >= 0.035 && todayUpper >= todayBody * 0.85;
        const todayTriple = volPrev > 0 && volLast >= volPrev * 3;
        const todayBrokeHigh = quote.high >= prev20High * 0.998 || quote.high >= prev10High * 0.998;
        const priceUnder80 = quote.price > 0 && quote.price < 80;
        const pctInBand = quote.changePct >= 0 && quote.changePct <= 9.8;
        const probeToday =
          todayLongUpper && todayTriple && todayBrokeHigh && priceUnder80 && pctInBand && yestNotLimit;
        const probePullOk =
          probeBar != null &&
          daysSinceProbe != null &&
          daysSinceProbe >= 1 &&
          daysSinceProbe <= 7 &&
          volLast > 0 &&
          volLast <= probeBar.volume * 0.55 &&
          volLast >= probeBar.volume * 0.25 &&
          quote.low >= probeBar.low * 0.995;
        const breakProbeLine = probeBar != null && quote.price > probeBar.high * 0.998;
        const holdProbeLow = probeBar != null && quote.low >= probeBar.low * 0.995;
        const probeStopYellow = probeBar != null && quote.price <= probeBar.high * 0.97;
        const probeStopRed = probeBar != null && quote.price <= probeBar.high * 0.95;
        const brokeProbeLowHard = probeBar != null && quote.price < probeBar.low * 0.95;
        const dumpAfterProbe =
          probeBar != null &&
          daysSinceProbe != null &&
          daysSinceProbe >= 1 &&
          quote.changePct < -2 &&
          volLast >= volAvg10 * 1.25;
        const longFlatAfterProbe =
          probeBar != null && daysSinceProbe != null && daysSinceProbe >= 8 && recentRange / quote.price < 0.06;

        const win5 = klines.slice(-5);
        const gain5 =
          win5.length && win5[0].open > 0 ? (quote.price - win5[0].open) / win5[0].open : 0;
        const sharpBull = win5.filter((k) => {
          const r = k.high - k.low;
          const b = Math.abs(k.close - k.open);
          return r > 0 && b / r >= 0.55 && k.close >= k.open;
        }).length;
        const shallowWash = recentRange / quote.price <= 0.09 && quote.changePct >= -3.5;
        const volExplosion = volAvg10 > 0 && volLast >= volAvg10 * 2;
        const dragonTech =
          priceUnder80 && gain5 >= 0.06 && sharpBull >= 2 && (volExplosion || shallowWash);

        const twoYin =
          last >= 1 &&
          closes[last] < opens[last] &&
          closes[last - 1] < klines[last - 1].open &&
          (klines[last - 1].open - closes[last - 1]) / Math.max(klines[last - 1].open, 0.01) >= 0.03 &&
          (opens[last] - closes[last]) / Math.max(opens[last], 0.01) >= 0.025;
        const highLongUpper =
          quote.price >= prev20High * 0.97 &&
          todayRange > 0 &&
          todayUpper / todayRange >= 0.45 &&
          quote.changePct <= 1.2;

        return {
          probeToday,
          probeBar,
          daysSinceProbe,
          probePullOk,
          breakProbeLine,
          holdProbeLow,
          probeStopYellow,
          probeStopRed,
          brokeProbeLowHard,
          dumpAfterProbe,
          longFlatAfterProbe,
          priceUnder80,
          pctInBand,
          yestNotLimit,
          dragonTech,
          gain5,
          sharpBull,
          shallowWash,
          volExplosion,
          twoYin,
          highLongUpper,
          probeFail: brokeProbeLowHard || dumpAfterProbe || (longFlatAfterProbe && volLast > volAvg10 * 1.2),
          dragonTopLike: twoYin || highLongUpper,
        };
      })(),
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
      {
        id: "buyVol",
        side: "buy",
        title: "买点 V · 爆量后缩量回踩",
        action: "剧本：近端先有倍量/3倍量（或堆量）分歧，再缩半或地量洗盘，回踩/站回最大量成本区才试。弱建要等缩半后的放量突破，不把「结构还行」当成买点。短洗不可击穿分歧低点。",
        checks: [
          { ok: ctx.launchRecent || ctx.stackVol || ctx.volExceedsPriorPeak, text: "近端已出现启动量（倍量/3倍/堆量/底部超量）" },
          { ok: ctx.washToday, text: "今日处于缩半或地量洗盘阶段（与启动不同日态）" },
          { ok: ctx.nearCostLow || ctx.nearCostHalf || ctx.reclaimCost, text: "价格回到最大量成本下沿/半位，或反包站回" },
          { ok: ctx.heldAboveDivLow || ctx.reclaimCost || ctx.entityNewHigh, text: "未有效击穿分歧成本低点，或已反包/实体新高" },
          { ok: !ctx.stagnantHuge && !ctx.hugeVolNoRise, text: "未见放量滞涨" },
        ],
      },
      {
        id: "buyCtrl",
        side: "buy",
        title: "买点 Ctl · 强控盘缩量回踩",
        action: "剧本：资金强势特征——拉升中量并不大、实体新高后缩量回踩。与爆量换手套路分开，不要用天量标准硬套。",
        checks: [
          { ok: ctx.quietRise || (ctx.entityNewHigh && !ctx.tripleVol), text: "近端抬升且量能不夸张（拉升中量偏小）" },
          { ok: ctx.entityNewHigh || structureOk, text: "实体新高或结构仍偏多" },
          { ok: ctx.washToday || shrinkVol, text: "缩量回踩进行中" },
          { ok: ctx.ctrlPullback || ctx.nearMa20 || ctx.touchedMaToday, text: "回踩均线/成本附近" },
          { ok: !ctx.stagnantHuge && !ctx.failedBreak && !ctx.hugeVolNoRise, text: "无滞涨、无假突破" },
        ],
      },
      {
        id: "buyCons",
        side: "buy",
        title: "买点 H · 横盘起爆观察",
        action: "前有放量连阳，横盘不深调；更理想是区间内涨放回调缩。贴近 MA20 出现长下影/金针测试时观察，确认后再小仓。",
        checks: [
          { ok: ctx.launchRecent || ctx.stackVol || ctx.expandVol, text: "前段有放量/堆量进场痕迹" },
          { ok: ctx.recentRangePct <= 0.12 || ctx.arrangement !== "偏空头", text: "近期波动收敛、非单边深跌" },
          { ok: ctx.nearMa20, text: "价格靠近 MA20 洗盘结束带" },
          { ok: ctx.longLowerShadow || ctx.needle2x || (ctx.washToday && ctx.touchedMaToday), text: "长下影/金针测试或缩量回踩均线" },
          { ok: !ctx.failedBreak && !ctx.stagnantHuge, text: "未见假突破或放量滞涨" },
        ],
      },
      {
        id: "sellVol",
        side: "sell",
        title: "卖点 V · 放量滞涨/破位",
        action: "录像强调：放量不涨先离场；破掉最大量成本底或放量阴破高，短线逻辑失效。",
        checks: [
          { ok: ctx.stagnantHuge || ctx.hugeVolNoRise, text: "放量滞涨 / 巨量不涨" },
          { ok: ctx.fadeFromHigh || quote.changePct <= 0, text: "冲高回落或当日偏弱" },
          {
            ok: (ctx.maxVolBodyLow != null && price < ctx.maxVolBodyLow * 0.995) || ctx.failedBreak,
            text: "跌破最大量成本底或突破失败",
          },
          { ok: ctx.expandVol || ctx.tripleVol, text: "量能仍活跃，不是无声阴跌" },
        ],
      },
      {
        id: "buyProbe",
        side: "buy",
        title: "买点试 · 试盘线候选",
        action: "笔记：非ST、价低于80、涨幅0–9.8%、昨未涨停、量≥昨3倍，且长上影+突破前高。当日只标记候选；真正动手多在缩量回踩后突破试盘线，并带止损。",
        checks: [
          { ok: ctx.priceUnder80, text: "股价低于 80（笔记筛选）" },
          { ok: ctx.pctInBand && ctx.yestNotLimit, text: "涨幅带内且昨日未近似涨停" },
          { ok: ctx.probeToday || (ctx.daysSinceProbe === 0), text: "近端出现试盘线形态（长上影+3倍量+破前高）" },
          { ok: ctx.tripleVol || ctx.probeToday, text: "量能达到约 3 倍量级别" },
          { ok: !ctx.probeFail, text: "未见试盘失败放量破位" },
        ],
      },
      {
        id: "buyProbePull",
        side: "buy",
        title: "买点试回 · 试盘后缩量回踩",
        action: "试盘后 3–7 日缩量至试盘日约 30%–50%，不破试盘低点；有效突破试盘线偏多。线下 3% 黄牌、5% 红牌。",
        checks: [
          { ok: ctx.probeBar != null && ctx.daysSinceProbe >= 1, text: "近端已出现过试盘线" },
          { ok: ctx.probePullOk || (ctx.holdProbeLow && ctx.shrinkVol), text: "缩量回踩且守住试盘低点" },
          { ok: ctx.breakProbeLine || ctx.holdProbeLow, text: "站回/突破试盘线或仍守低点待突破" },
          { ok: !ctx.probeStopRed && !ctx.brokeProbeLowHard, text: "未触发试盘线下方约 5% 红牌" },
          { ok: ctx.priceUnder80 || price < 100, text: "价格仍处相对低位区" },
        ],
      },
      {
        id: "buyDragon",
        side: "buy",
        title: "买点龙 · 强势凌厉近似",
        action: "龙头技术近似：近端涨幅凌厉、阳线实体干净、放量或浅洗。题材正统/人气仍需人工确认，不可只靠日线。",
        checks: [
          { ok: ctx.dragonTech || (ctx.gain5 >= 0.05 && ctx.sharpBull >= 2), text: "近端涨幅与阳线形态偏凌厉" },
          { ok: ctx.volExplosion || ctx.expandVol, text: "量能急剧放大或明显放量" },
          { ok: ctx.shallowWash || ctx.washToday, text: "回撤偏浅 / 点到为止" },
          { ok: ctx.priceUnder80 || price < 120, text: "更偏小盘低价身世区间" },
          { ok: !ctx.dragonTopLike && !ctx.twoYin, text: "未见高位走坏/连续大阴" },
        ],
      },
      {
        id: "sellProbeFail",
        side: "sell",
        title: "卖点试败 · 试盘失败",
        action: "高开后放量砸、破试盘低点，或试盘后久盘再放量下跌：按笔记先认错，红牌离场。",
        checks: [
          { ok: ctx.probeBar != null, text: "近期存在试盘线参照" },
          { ok: ctx.brokeProbeLowHard || ctx.probeStopRed, text: "跌破试盘低点或线下约 5%" },
          { ok: ctx.dumpAfterProbe || ctx.expandVol, text: "下跌伴随放量/抛压" },
          { ok: ctx.probeFail || quote.changePct < 0, text: "试盘逻辑转弱" },
        ],
      },
      {
        id: "sellDragonTop",
        side: "sell",
        title: "卖点龙顶 · 高位走坏",
        action: "笔记见顶预警近似：连续大阴收不回、高位长上影。龙头跌起来也凶，信号出现先减仓。",
        checks: [
          { ok: ctx.twoYin || ctx.highLongUpper, text: "连续转弱大阴或高位长上影" },
          { ok: quote.price >= ctx.prev20High * 0.92 || ctx.gain5 >= 0.12, text: "处于相对高位/大涨之后" },
          { ok: ctx.fadeFromHigh || quote.changePct <= 0, text: "冲高回落或当日转弱" },
          { ok: ctx.dragonTopLike || ctx.hugeVolNoRise, text: "顶部预警或巨量滞涨" },
        ],
      },
    ];

    return templates
      .filter((t) => {
        if (ENGINE === "ma") return MA_TEMPLATE_IDS.has(t.id);
        if (ENGINE === "volume") return VOL_TEMPLATE_IDS.has(t.id);
        if (ENGINE === "wuge") return WUGE_TEMPLATE_IDS.has(t.id);
        return true;
      })
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

    if (ENGINE === "volume") {
      const hardNo =
        (sellBest && sellBest.score >= 75) ||
        ctx.stagnantHuge ||
        ctx.hugeVolNoRise ||
        (ctx.failedBreak && (!buyBest || buyBest.score < 80));
      if (hardNo) {
        if (ctx.stagnantHuge || ctx.hugeVolNoRise) reasons.push("放量滞涨/巨量不涨，量能剧本先回避新开仓。");
        if (ctx.failedBreak) reasons.push("突破失败迹象，先不追。");
        if (sellBest && sellBest.score >= 60) reasons.push(`卖点更匹配：${sellBest.title}（${sellBest.score}%）。`);
        return {
          verdict: "no",
          title: "不建议买入",
          summary: "量能规则偏防守：先观望或处理已有仓，不新增。",
          reasons,
          buyBest,
          sellBest,
        };
      }
      const waitLike =
        !buyBest ||
        buyBest.score < 60 ||
        (sellBest && sellBest.score >= buyBest.score) ||
        (buyBest.id === "buyCons" && buyBest.score < 80);
      if (waitLike) {
        if (!buyBest || buyBest.score < 60) reasons.push("量能买点模板未齐。");
        if (sellBest && buyBest && sellBest.score >= buyBest.score) reasons.push("卖点契合不低于买点，先等。");
        if (buyBest?.id === "buyCons") reasons.push("横盘起爆仍偏观察，等确认更稳。");
        return {
          verdict: "wait",
          title: "暂不建议买入",
          summary: "可以盯着缩半回踩/站回成本或放量突破确认，再动手。",
          reasons,
          buyBest,
          sellBest,
        };
      }
      reasons.push(`量能买点更贴近：${buyBest.title}（${buyBest.score}%）。`);
      if (buyBest.id === "buyVol") reasons.push("爆量后缩量回踩：弱建还要等放量突破。");
      if (buyBest.id === "buyCtrl") reasons.push("强控盘剧本：不要用天量标准硬套。");
      if (buyBest.id === "buyCons") reasons.push("横盘起爆：确认后再小仓。");
      reasons.push("分时右空等同细节仍需人工核对。");
      return {
        verdict: "yes",
        title: buyBest.score >= 80 ? "可小仓试错" : "可分批关注",
        summary: "量能条件相对更好，仍只建议小仓，并与板块情绪交叉验证。",
        reasons,
        buyBest,
        sellBest,
      };
    }

    if (ENGINE === "wuge") {
      const hardNo =
        (sellBest && sellBest.score >= 70) ||
        ctx.probeFail ||
        ctx.brokeProbeLowHard ||
        (ctx.dragonTopLike && (!buyBest || buyBest.score < 80));
      if (hardNo) {
        if (ctx.probeFail || ctx.brokeProbeLowHard) reasons.push("试盘失败/破试盘低点，先按红牌处理。");
        if (ctx.dragonTopLike) reasons.push("高位走坏预警，不追龙头余波。");
        if (sellBest && sellBest.score >= 60) reasons.push(`卖点更匹配：${sellBest.title}（${sellBest.score}%）。`);
        return {
          verdict: "no",
          title: "不建议买入",
          summary: "五哥规则偏防守：止损永远比天大，先观望或处理已有仓。",
          reasons,
          buyBest,
          sellBest,
        };
      }
      const waitLike =
        !buyBest ||
        buyBest.score < 60 ||
        (sellBest && sellBest.score >= buyBest.score) ||
        (buyBest.id === "buyProbe" && buyBest.score < 80) ||
        (buyBest.id === "buyDragon" && buyBest.score < 80);
      if (waitLike) {
        if (!buyBest || buyBest.score < 60) reasons.push("试盘/龙头买点模板未齐。");
        if (buyBest?.id === "buyProbe") reasons.push("试盘线当日多是标记候选，优先等缩量回踩再突破。");
        if (buyBest?.id === "buyDragon") reasons.push("龙头还要人工确认题材与人气，日线只是近似。");
        if (sellBest && buyBest && sellBest.score >= buyBest.score) reasons.push("卖点契合不低于买点，先等。");
        return {
          verdict: "wait",
          title: "暂不建议买入",
          summary: "可以盯试盘后缩量回踩或龙头确认，竞价/盘口仍需人工看。",
          reasons,
          buyBest,
          sellBest,
        };
      }
      reasons.push(`五哥买点更贴近：${buyBest.title}（${buyBest.score}%）。`);
      if (buyBest.id === "buyProbePull") reasons.push("突破试盘线才偏多；线下约3%黄牌、约5%红牌。");
      if (buyBest.id === "buyDragon") reasons.push("技术凌厉≠题材龙头，交叉验证热点。");
      reasons.push("集合竞价与筹码峰细节本站未自动覆盖。");
      return {
        verdict: "yes",
        title: buyBest.score >= 80 ? "可小仓试错" : "可分批关注",
        summary: "五哥条件相对更好，仍只建议小仓，并严格执行止损。",
        reasons,
        buyBest,
        sellBest,
      };
    }

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
      summary: "均线条件相对更好，仍要人工过主营/主线闸门，再按仓位计划执行。",
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
    const map =
      ENGINE === "volume"
        ? ["buyVol", "buyCtrl", "buyCons", "sellVol"]
        : ENGINE === "wuge"
          ? ["buyProbe", "buyProbePull", "buyDragon", "sellProbeFail", "sellDragonTop"]
          : ENGINE === "ma"
            ? ["buyA", "buyB", "buyC", "sellA", "sellB"]
            : ["buyA", "buyB", "buyC", "buyVol", "buyCtrl", "buyCons", "sellA", "sellB", "sellVol"];
    document.querySelectorAll(".template-card").forEach((card, idx) => {
      const id = card.dataset.id || map[idx];
      card.classList.toggle("is-hot", id === hotId);
    });
  }

  const REVIEW_HISTORY_KEY = "miranda_review_history_v1";
  const REVIEW_HISTORY_LIMIT = 12;

  function loadReviewHistory() {
    try {
      const raw = localStorage.getItem(REVIEW_HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function saveReviewHistory(list) {
    try {
      localStorage.setItem(REVIEW_HISTORY_KEY, JSON.stringify(list.slice(0, REVIEW_HISTORY_LIMIT)));
    } catch (_) {
      // ignore quota / private mode failures
    }
  }

  function pushReviewHistory(entry) {
    const code = String(entry.code || "").trim().toUpperCase();
    if (!code) return;
    const name = entry.name || code;
    const next = [
      { code, name, at: Date.now() },
      ...loadReviewHistory().filter((item) => String(item.code).toUpperCase() !== code),
    ];
    saveReviewHistory(next);
    renderReviewHistory();
  }

  function clearReviewHistory() {
    saveReviewHistory([]);
    renderReviewHistory();
  }

  function renderReviewHistory() {
    const row = document.getElementById("reviewHistoryRow");
    const listEl = document.getElementById("reviewHistoryList");
    if (!row || !listEl) return;
    const list = loadReviewHistory();
    if (!list.length) {
      row.hidden = true;
      listEl.innerHTML = "";
      return;
    }
    row.hidden = false;
    listEl.innerHTML = list
      .map(
        (item) =>
          `<button type="button" class="history-chip" data-history-code="${item.code}">${item.code}${
            item.name && item.name !== item.code ? ` ${item.name}` : ""
          }</button>`
      )
      .join("");
    listEl.querySelectorAll("[data-history-code]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("reviewInput").value = btn.dataset.historyCode;
        runReview();
      });
    });
  }

  function extractAskCode(raw) {
    const text = String(raw || "").trim().toUpperCase();
    const m = text.match(/\b((?:SH|SZ|BJ)?\d{6}|BK\d{3,5})\b/);
    return m ? m[1].replace(/^(SH|SZ|BJ)/, "") : text;
  }

  function appendCoachBubble(role, html) {
    const box = document.getElementById("coachMessages");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `coach-bubble ${role}`;
    el.innerHTML = html;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  let reviewInFlight = false;
  async function runReview(opts = {}) {
    const input = document.getElementById("reviewInput");
    const result = document.getElementById("reviewResult");
    const loading = document.getElementById("reviewLoading");
    const error = document.getElementById("reviewError");
    if (!input || !result || !loading || !error) return;
    if (reviewInFlight) return;
    reviewInFlight = true;

    result.hidden = true;
    error.hidden = true;
    const raw = (opts.preset || input.value).trim();
    if (!raw) {
      error.hidden = false;
      error.textContent = "请输入股票代码，或问「代码 + 适不适合买/卖」";
      reviewInFlight = false;
      return;
    }

    const code = extractAskCode(raw);
    const info = getSecId(code);
    if (!info || !info.symbol) {
      error.hidden = false;
      error.textContent = "请输入可复盘的股票 / 指数 / ETF 代码。";
      appendCoachBubble("bot", "没识别到有效代码。试试六位代码，例如 <code>600584</code>。");
      reviewInFlight = false;
      return;
    }

    if (!opts.silentUser) {
      appendCoachBubble("user", raw.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])));
    }

    loading.hidden = false;
    loading.textContent = "拉取行情并对照买卖规则...";
    try {
      const pack = await resolveQuoteAndBars(info);
      const quote = pack.quote;
      loading.textContent = "计算均线、量能与模板匹配...";
      const klines = pack.klines;
      const m15 = await fetchMinuteCloses(info.symbol, 15, 250, info.secid);
      const ctx = buildContext(quote, klines, m15);
      const ranked = matchTemplates(ctx);
      const holdStatus = getHoldStatus();
      const playbook = buildPlaybook(ctx, ranked, holdStatus);
      const gate = playbook.gate;
      result.hidden = false;
      result.innerHTML = renderReviewResult(info, { ...quote, name: quote.name }, ranked, ctx, holdStatus);
      highlightTemplateCards(ranked);
      pushReviewHistory({ code: info.name || code, name: quote.name || info.name || code });

      const buyBest = gate.buyBest;
      const sellBest = gate.sellBest;
      const fit = buyBest ? `${buyBest.title} ${buyBest.score}%` : "买点未成型";
      const sellFit = sellBest ? `${sellBest.title} ${sellBest.score}%` : "卖点未成型";
      const stNote = /ST/i.test(quote.name || "")
        ? `<br/><span style="color:var(--rise)">注意：这是 ST/*ST 风险警示股，规则契合度也不能当安全信号。</span>`
        : "";
      appendCoachBubble(
        "bot",
        `<strong>${quote.name}（${info.name || code}）· ${gate.title}</strong><br/>${gate.summary}<br/>买点契合：${fit}<br/>卖点契合：${sellFit}${stNote}<br/><span style="color:var(--muted)">下方有完整持仓建议与价格带。契合度不是胜率。</span>`
      );
      input.value = "";
    } catch (e) {
      const tip = friendlyNetError(e);
      error.hidden = false;
      error.textContent = tip;
      appendCoachBubble("bot", `这次没跑通：${tip}`);
    } finally {
      loading.hidden = true;
      reviewInFlight = false;
    }
  }

  const coachForm = document.getElementById("coachForm");
  if (coachForm) {
    coachForm.addEventListener("submit", (e) => {
      e.preventDefault();
      runReview();
    });
  } else {
    const reviewBtn = document.getElementById("reviewBtn");
    if (reviewBtn) reviewBtn.addEventListener("click", () => runReview());
    const reviewInput = document.getElementById("reviewInput");
    if (reviewInput) {
      reviewInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") runReview();
      });
    }
  }
  document.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("reviewInput").value = `${btn.dataset.review} 现在适合买入或卖出吗？`;
      runReview();
    });
  });
  const historyClearBtn = document.getElementById("reviewHistoryClear");
  if (historyClearBtn) historyClearBtn.addEventListener("click", clearReviewHistory);
  renderReviewHistory();

  // ---------- Full-market volume picks (coach only) ----------
  function marketListUrl(pn, pz) {
    const fs = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23";
    const fields = "f12,f14,f2,f3,f6,f8,f10,f20";
    return (
      "https://push2delay.eastmoney.com/api/qt/clist/get?pn=" +
      pn +
      "&pz=" +
      pz +
      "&po=1&np=1&fltt=2&invt=2&fid=f3&fs=" +
      encodeURIComponent(fs) +
      "&fields=" +
      fields
    );
  }

  function isBoardAShare(code, name) {
    if (!/^\d{6}$/.test(code)) return false;
    if (/ST|退|^N|^C/i.test(name || "")) return false;
    return /^(60|00|30|68)\d{4}$/.test(code);
  }

  function boardLabel(code) {
    if (/^68\d{4}$/.test(code)) return "科创板";
    if (/^30\d{4}$/.test(code)) return "创业板";
    if (/^60\d{4}$/.test(code)) return "沪市主板";
    return "深市主板";
  }

  function boardBucket(code) {
    if (/^68\d{4}$/.test(code)) return "star";
    if (/^30\d{4}$/.test(code)) return "chinext";
    if (/^60\d{4}$/.test(code)) return "sh";
    return "sz";
  }

  function numOr0(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function coarseMarketScore(row, closed) {
    const code = row.code;
    if (ENGINE === "wuge") {
      const price = numOr0(row.f2);
      const pct = numOr0(row.f3);
      const vr = numOr0(row.f10);
      const mcap = numOr0(row.f20);
      let s = 6;
      if (closed) {
        if (mcap >= 2e9 && mcap <= 4e10) s += 36;
        else if (mcap > 0) s += 14;
        s += parseInt(code.slice(-3), 10) % 17;
        return s;
      }
      if (price > 0 && price < 80) s += 28;
      else if (price > 0 && price < 120) s += 10;
      else return 0;
      if (pct >= 0 && pct <= 9.8) s += 18;
      else return 0;
      if (vr >= 2.8) s += 26;
      else if (vr >= 2) s += 14;
      else if (vr >= 1.5) s += 6;
      if (mcap > 0 && mcap < 5e10) s += 8;
      return s;
    }
    if (closed) {
      const mcap = numOr0(row.f20);
      let s = 8;
      if (mcap >= 5e9 && mcap <= 5e10) s += 42;
      else if (mcap >= 2e9 && mcap <= 1.2e11) s += 28;
      else if (mcap > 0) s += 12;
      s += parseInt(code.slice(-3), 10) % 19;
      return s;
    }
    const pct = numOr0(row.f3);
    const amount = numOr0(row.f6);
    const turnover = numOr0(row.f8);
    const vr = numOr0(row.f10);
    const mcap = numOr0(row.f20);
    let s = 0;
    if (amount > 0) s += Math.min(28, Math.log10(amount + 1) * 3.2);
    if (vr >= 1.8 && vr <= 4.2) s += 22;
    else if (vr >= 1.3 && vr < 1.8) s += 12;
    else if (vr > 4.2 && vr <= 6) s += 8;
    if (pct >= 2 && pct <= 7) s += 18;
    else if (pct > 7 && pct <= 9.8) s += 10;
    else if (pct > 0 && pct < 2) s += 6;
    else if (pct < -3 && pct > -7) s += 8;
    if (turnover >= 3 && turnover <= 12) s += 10;
    if (mcap > 0 && mcap < 8e10) s += 8;
    return s;
  }

  function pickScanCandidates(list, depth, closed) {
    const scored = list
      .map((row) => ({ row, coarse: coarseMarketScore(row, closed) }))
      .sort((a, b) => b.coarse - a.coarse);
    const quotas = {
      sh: Math.ceil(depth * 0.28),
      sz: Math.ceil(depth * 0.28),
      chinext: Math.ceil(depth * 0.24),
      star: Math.ceil(depth * 0.24),
    };
    const picked = [];
    const used = new Set();
    for (const [bucket, q] of Object.entries(quotas)) {
      let n = 0;
      for (const item of scored) {
        if (n >= q) break;
        if (boardBucket(item.row.code) !== bucket) continue;
        if (used.has(item.row.code)) continue;
        picked.push(item);
        used.add(item.row.code);
        n++;
      }
    }
    for (const item of scored) {
      if (picked.length >= depth) break;
      if (used.has(item.row.code)) continue;
      picked.push(item);
      used.add(item.row.code);
    }
    return picked.slice(0, depth);
  }

  async function fetchMarketUniverse(onProgress) {
    const pageSize = 100;
    const first = await fetchJsonp(marketListUrl(1, pageSize), 20000);
    const total = Number(first?.data?.total) || 0;
    const pages = Math.max(1, Math.ceil((total || pageSize) / pageSize));
    const all = [];

    function absorb(diff) {
      if (!Array.isArray(diff)) return;
      for (const row of diff) {
        const code = String(row.f12 || "");
        const name = String(row.f14 || "");
        if (!isBoardAShare(code, name)) continue;
        all.push({
          code,
          name,
          f2: row.f2,
          f3: row.f3,
          f6: row.f6,
          f8: row.f8,
          f10: row.f10,
          f20: row.f20,
        });
      }
    }

    absorb(first?.data?.diff);
    onProgress?.(1, pages, all.length);

    for (let start = 2; start <= pages; start += 6) {
      const batch = [];
      for (let pn = start; pn < start + 6 && pn <= pages; pn++) batch.push(pn);
      const parts = await Promise.all(
        batch.map((pn) => fetchJsonp(marketListUrl(pn, pageSize), 20000).catch(() => null))
      );
      for (const data of parts) absorb(data?.data?.diff);
      onProgress?.(Math.min(start + batch.length - 1, pages), pages, all.length);
    }

    const closed =
      all.length > 0 &&
      all.every((r) => r.f2 === "-" || r.f2 == null || Number(r.f2) === 0);
    return { list: all, closed, totalReported: total || all.length };
  }

  async function mapPool(items, concurrency, worker) {
    const out = new Array(items.length);
    let cursor = 0;
    async function runOne() {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await worker(items[i], i);
      }
    }
    const n = Math.max(1, Math.min(concurrency, items.length || 1));
    await Promise.all(Array.from({ length: n }, () => runOne()));
    return out;
  }

  async function scoreOnePick(item, opts = {}) {
    const fast = opts.fast !== false;
    const info = getSecId(item.code);
    if (!info || !info.symbol) throw new Error("代码无效");
    const pack = await resolveQuoteAndBars(info);
    const quote = item.name ? { ...pack.quote, name: item.name } : pack.quote;
    const klines = pack.klines;
    const m15 = fast ? null : await fetchMinuteCloses(info.symbol, 15, 180, info.secid);
    const ctx = buildContext(quote, klines, m15);
    const ranked = matchTemplates(ctx);
    const gate = decideEntryGate(ctx, ranked);
    const buyBest = gate.buyBest;
    const sellBest = gate.sellBest;
    const fitScore =
      gate.verdict === "yes"
        ? buyBest?.score || 0
        : gate.verdict === "wait"
          ? Math.max(35, Math.min(59, buyBest?.score || 40))
          : Math.min(34, sellBest?.score || buyBest?.score || 20);
    return {
      code: item.code,
      tip: item.tip || boardLabel(item.code),
      name: quote.name,
      price: quote.price,
      changePct: quote.changePct,
      verdict: gate.verdict,
      title: gate.title,
      summary: gate.summary,
      fitScore,
      buyLabel: buyBest ? `${buyBest.title} ${buyBest.score}%` : "买点弱",
      sellLabel: sellBest ? `${sellBest.title} ${sellBest.score}%` : "卖点弱",
      arrangement: ctx.arrangement,
    };
  }

  function verdictRank(v) {
    if (v === "yes") return 0;
    if (v === "wait") return 1;
    return 2;
  }

  function renderPicksBoard(rows, metaNote) {
    const board = document.getElementById("picksBoard");
    if (!board) return;
    const sorted = [...rows].sort(
      (a, b) => verdictRank(a.verdict) - verdictRank(b.verdict) || b.fitScore - a.fitScore
    );
    const watch = sorted.filter((r) => r.verdict === "yes" || r.verdict === "wait");
    const avoid = sorted.filter((r) => r.verdict === "no").slice(0, 6);

    const card = (r) => `
      <button type="button" class="pick-card" data-verdict="${r.verdict}" data-pick-code="${r.code}">
        <div class="pick-top">
          <strong>${r.name}</strong>
          <span>${r.code}</span>
        </div>
        <div class="pick-price ${r.changePct >= 0 ? "up" : "down"}">
          ${r.price.toFixed(2)}
          <em>${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%</em>
        </div>
        <div class="pick-verdict">${r.title}</div>
        <div class="pick-fit">规则契合 ${r.fitScore}%</div>
        <p>${r.tip} · ${r.arrangement}</p>
        <p class="pick-templates">${r.buyLabel} · ${r.sellLabel}</p>
      </button>
    `;

    board.hidden = false;
    board.innerHTML = `
      <div class="picks-group">
        <h3>推荐 / 观察（全市场精评后）</h3>
        <div class="picks-grid">${watch.length ? watch.map(card).join("") : "<p class='empty-picks'>本轮精评后暂无过闸门标的，可加大精评数量或换日再试。</p>"}</div>
      </div>
      ${
        avoid.length
          ? `<div class="picks-group">
        <h3>精评样本中偏回避（节选）</h3>
        <div class="picks-grid">${avoid.map(card).join("")}</div>
      </div>`
          : ""
      }
      <p class="picks-footnote">${metaNote || "列表按规则契合排序，不是胜率。点卡片送入下方问答细问。"}</p>
    `;
    board.querySelectorAll("[data-pick-code]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.pickCode;
        document.getElementById("reviewInput").value = `${code} 现在适合买入或卖出吗？`;
        document.getElementById("ask")?.scrollIntoView({ behavior: "smooth", block: "start" });
        runReview();
      });
    });
  }

  async function runPicksScan() {
    if (ENGINE !== "volume" && ENGINE !== "wuge") return;
    const loading = document.getElementById("picksLoading");
    const error = document.getElementById("picksError");
    const meta = document.getElementById("picksMeta");
    const board = document.getElementById("picksBoard");
    const depthEl = document.getElementById("picksDepth");
    if (!loading || !error || !board) return;

    const depth = Math.max(20, Math.min(120, Number(depthEl?.value) || 60));
    const engineLabel = ENGINE === "wuge" ? "五哥试盘/龙头" : "量能";
    error.hidden = true;
    loading.hidden = false;
    board.hidden = true;
    if (meta) meta.textContent = "拉取全市场列表…";

    try {
      const uni = await fetchMarketUniverse((page, pages, count) => {
        loading.textContent = `全市场列表 ${page}/${pages} 页 · 已收 ${count} 只沪深/创业/科创…`;
      });
      if (!uni.list.length) {
        loading.hidden = true;
        error.hidden = false;
        error.textContent = "行情列表暂不可用，请稍后重试。";
        return;
      }

      let pool = uni.list;
      if (ENGINE === "wuge" && !uni.closed) {
        pool = pool.filter((r) => {
          const price = numOr0(r.f2);
          const pct = numOr0(r.f3);
          if (price > 0 && price >= 80) return false;
          if (pct < 0 || pct > 9.8) return false;
          return true;
        });
      }

      const candidates = pickScanCandidates(pool, depth, uni.closed);
      loading.textContent =
        `池 ${pool.length} 只（接口 ${uni.totalReported}）→ 精评 Top ${candidates.length}` +
        (uni.closed ? " · 休市分层粗筛" : ENGINE === "wuge" ? " · 试盘筛选粗筛" : " · 按量价粗筛");

      let done = 0;
      const deep = await mapPool(candidates, 5, async ({ row, coarse }) => {
        try {
          const scored = await scoreOnePick(
            { code: row.code, name: row.name, tip: boardLabel(row.code) + " · 粗分 " + Math.round(coarse) },
            { fast: true }
          );
          done += 1;
          loading.textContent = `精评${engineLabel}模板 ${done}/${candidates.length}…`;
          return scored;
        } catch (_) {
          done += 1;
          loading.textContent = `精评${engineLabel}模板 ${done}/${candidates.length}…`;
          return null;
        }
      });

      const rows = deep.filter(Boolean);
      const yesN = rows.filter((r) => r.verdict === "yes").length;
      const waitN = rows.filter((r) => r.verdict === "wait").length;
      loading.hidden = true;
      renderPicksBoard(
        rows,
        `全市场扫描 · ${engineLabel} · 池 ${pool.length} · 精评 ${candidates.length} · 可关注 ${yesN} · 等待 ${waitN} · 契合度≠胜率`
      );
      if (meta) {
        meta.textContent = `池 ${pool.length} · 精评 ${candidates.length} · 可关注 ${yesN} · 等待 ${waitN} · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
      }
    } catch (err) {
      loading.hidden = true;
      error.hidden = false;
      error.textContent = "扫描失败：" + (err?.message || String(err));
      if (meta) meta.textContent = "扫描失败，可重试";
    }
  }

  const picksBtn = document.getElementById("picksBtn");
  if (picksBtn) picksBtn.addEventListener("click", runPicksScan);

  // Index chart only if legacy lab exists
  const refreshIdx = document.getElementById("refreshIdx");
  if (refreshIdx && document.getElementById("idxChartCanvas")) {
    document.querySelectorAll("#idxTabs [data-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentIdx = btn.dataset.idx;
        document.querySelectorAll("#idxTabs [data-idx]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        if (idxDataCache[currentIdx]) renderIdxChart(idxDataCache[currentIdx]);
        else fetchIdxData(currentIdx);
      });
    });
    refreshIdx.addEventListener("click", () => {
      delete idxDataCache[currentIdx];
      fetchIdxData(currentIdx);
    });
    setTimeout(() => fetchIdxData("000001"), 400);
  }
})();

