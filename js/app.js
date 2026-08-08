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
