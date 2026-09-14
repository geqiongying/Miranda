(() => {
  // 板块口径对齐 notes/2026年9月14日学习.pdf（化工 / 资源 / 液冷 / 光通信 / 存储）
  const SECTORS = [
    {
      id: "fertilizer",
      name: "化肥",
      thesis: "吃的线：磷 / 氮 / 钾龙头。讲话口径可做超短，复合肥略过；价格有限价，弹性偶发。",
      preferredHorizon: "short",
      boards: ["BK1435", "BK1432", "BK1434"],
      core: [
        { code: "600096", tip: "磷肥龙头 · 矿化一体" },
        { code: "600426", tip: "氮肥 / 尿素 · 煤化工交叉" },
        { code: "000792", tip: "钾肥龙头 · 察尔汗盐湖" },
      ],
    },
    {
      id: "refining",
      name: "大炼化",
      thesis: "穿的线上游：炼化一体化偏中长线；无中长思维勿碰。优先龙头，卫星化学作丙烯补充。",
      preferredHorizon: "mid",
      boards: ["BK1274"],
      core: [
        { code: "600346", tip: "大炼化优先观察" },
        { code: "002493", tip: "芳烃 / 烯烃" },
        { code: "000301", tip: "盛虹 · 差异化路线" },
        { code: "002648", tip: "丙烯 / 乙二醇蓝筹" },
      ],
    },
    {
      id: "fiberchem",
      name: "化纤",
      thesis: "涤纶长丝 / 氨纶等：中长线；讲话点名桐昆、华峰，江南高纤偏弹性。",
      preferredHorizon: "mid",
      boards: ["BK1413", "BK0471"],
      core: [
        { code: "601233", tip: "涤纶长丝龙头" },
        { code: "002064", tip: "氨纶龙头 · 非万华" },
        { code: "600527", tip: "小票弹性观察" },
      ],
    },
    {
      id: "coalchem",
      name: "煤化工",
      thesis: "盯油价黄金点约 85 美元（约 75–95）。宝丰偏基本面，华鲁次之，金牛偏高弹性。",
      preferredHorizon: "mid",
      boards: ["BK1419", "BK0492"],
      core: [
        { code: "600989", tip: "基本面优先" },
        { code: "600426", tip: "煤化工 + 氮肥" },
        { code: "600722", tip: "高弹性 · 波动大" },
      ],
    },
    {
      id: "coal",
      name: "煤炭资源",
      thesis: "讲话捎带：后续或单独讲资源类；现阶段先盯兖矿能源。",
      preferredHorizon: "mid",
      boards: ["BK0437", "BK1250"],
      core: [{ code: "600188", tip: "煤炭蓝筹样本" }],
    },
    {
      id: "liquidcool",
      name: "液冷",
      thesis: "PUE 政策把液冷从可选项推成刚需；当下以冷板为主。看 CDU、冷板、快接头、氟化液、泵。已涨多的勿追高。",
      preferredHorizon: "both",
      boards: ["BK1138"],
      core: [
        { code: "002837", tip: "CDU / 系统级一线" },
        { code: "301018", tip: "CDU · 国产 / 华为链" },
        { code: "300990", tip: "CDU · 机架式" },
        { code: "300499", tip: "CDU / 浸没静默观察" },
        { code: "300602", tip: "微通道冷板" },
        { code: "301128", tip: "冷板 + 快接头 · 华为链" },
        { code: "002126", tip: "冷板相关" },
        { code: "002179", tip: "UQD 快接头龙头" },
        { code: "002475", tip: "快接头供应链" },
        { code: "600160", tip: "氟化液大厂" },
        { code: "300037", tip: "半导体冷却液" },
        { code: "605020", tip: "电子氟化液后来者" },
        { code: "002536", tip: "液冷水泵 · 订单可见" },
        { code: "603757", tip: "屏蔽泵竞争者" },
        { code: "300547", tip: "管路 / 软管" },
      ],
    },
    {
      id: "opticfiber",
      name: "光纤",
      thesis: "光通信路基：AI 机柜光纤用量抬升；龙头长飞最纯，亨通 / 烽火可看，注意估值与扩产时间差。",
      preferredHorizon: "mid",
      boards: ["BK1660"],
      core: [
        { code: "601869", tip: "光棒工艺最全 · 最纯" },
        { code: "600487", tip: "光纤龙头之一 · 散户多" },
        { code: "600498", tip: "烽火 · 业务较杂" },
      ],
    },
    {
      id: "optical",
      name: "光模块 / 光芯片",
      thesis: "顺着整条链看：模块赚规模钱，光芯片 / DSP 才是发动机。A 股高端 DSP 讲话口径先放弃；CPO 不是可插拔模块。",
      preferredHorizon: "both",
      boards: ["BK1136", "BK1128"],
      core: [
        { code: "300308", tip: "光模块海外链 · 光老大" },
        { code: "300502", tip: "光模块海外链" },
        { code: "000988", tip: "华工 · 偏国内亦有出口" },
        { code: "002281", tip: "光迅 · IDM 全产业链" },
        { code: "002384", tip: "东山精密 · 模块五家之一" },
        { code: "688498", tip: "国产光芯片领军（源杰）" },
        { code: "002428", tip: "磷化铟衬底 · 云南锗业" },
      ],
    },
    {
      id: "memory",
      name: "存储",
      thesis: "AI 换爹后的周期+成长：讲话更看原厂 / 接口芯片，跳过模组与纯设计大仓位；HBM 仍是短板。",
      preferredHorizon: "both",
      boards: ["BK1137"],
      core: [
        { code: "688825", tip: "长鑫 · DRAM 原厂（勿盲目大仓）" },
        { code: "688008", tip: "澜起 · 内存接口双寡头" },
        { code: "603986", tip: "设计全品类 · 讲话建议跳过大仓" },
        { code: "000021", tip: "封测 · 美光/长鑫相关" },
        { code: "600667", tip: "封测 · 海力士链" },
        { code: "600584", tip: "封测龙头之一" },
        { code: "002156", tip: "封测 · HBM 封装突破中" },
        { code: "688525", tip: "模组弹性大 · 利润逻辑变弱" },
        { code: "301308", tip: "模组龙头 · 同上谨慎" },
      ],
    },
  ];

  const BOARD_EXPAND_LIMIT = 14;
  const SCAN_POOL_CAP = 120;

  function fetchJsonp(url, timeoutMs = 14000) {
    return new Promise((resolve, reject) => {
      const cbName = `__miranda_board_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
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

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function isCleanName(name) {
    return name && !/ST|退|^N|^C/i.test(name);
  }

  function boardListUrl(bk, pn = 1, pz = 50) {
    const fields = "f12,f14,f2,f3,f8,f9,f10,f20,f21,f23,f115";
    return (
      "https://push2delay.eastmoney.com/api/qt/clist/get?pn=" +
      pn +
      "&pz=" +
      pz +
      "&po=1&np=1&fltt=2&invt=2&fid=f3&fs=" +
      encodeURIComponent("b:" + bk) +
      "&fields=" +
      fields
    );
  }

  function quoteUrl(secid) {
    return (
      "https://push2delay.eastmoney.com/api/qt/stock/get?secid=" +
      secid +
      "&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170,f162,f167,f116,f117"
    );
  }

  function toSecId(code) {
    if (/^[6]\d{5}$/.test(code)) return "1." + code;
    if (/^(00|30)\d{4}$/.test(code)) return "0." + code;
    return null;
  }

  function parseListRow(row, sectorId, tip) {
    const code = String(row.f12 || "");
    const name = String(row.f14 || "");
    if (!/^\d{6}$/.test(code) || !isCleanName(name)) return null;
    if (!/^(60|00|30|68)\d{4}$/.test(code)) return null;
    return {
      code,
      name,
      tip: tip || "",
      sectorId,
      price: num(row.f2),
      changePct: num(row.f3),
      turnover: num(row.f8),
      peDynamic: num(row.f9),
      volumeRatio: num(row.f10),
      mcap: num(row.f20),
      floatMcap: num(row.f21),
      pb: num(row.f23),
      peTtm: num(row.f115),
    };
  }

  async function fetchBoardRows(bk) {
    const data = await fetchJsonp(boardListUrl(bk, 1, 60), 18000);
    const diff = data?.data?.diff;
    if (!Array.isArray(diff)) return [];
    return diff;
  }

  async function fetchQuoteRow(code) {
    const secid = toSecId(code);
    if (!secid) return null;
    try {
      const data = await fetchJsonp(quoteUrl(secid), 12000);
      const q = data?.data;
      if (!q) return null;
      const price = num(q.f43) / 100;
      return {
        code,
        name: q.f58 || code,
        price: price > 0 ? price : 0,
        changePct: num(q.f170) / 100,
        turnover: 0,
        peDynamic: num(q.f162),
        volumeRatio: 0,
        mcap: num(q.f116),
        floatMcap: num(q.f117),
        pb: num(q.f167),
        peTtm: num(q.f162),
      };
    } catch (_) {
      return null;
    }
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

  function passesShort(s) {
    if (!s.price || s.price <= 0) return false;
    if (s.mcap > 0 && s.mcap < 1e10) return false;
    if (s.peTtm > 0 && s.peTtm > 80) return false;
    if (s.pb > 0 && s.pb > 8) return false;
    if (s.changePct < 0.5 || Math.abs(s.changePct) > 7) return false;
    if (s.turnover > 0 && (s.turnover < 1 || s.turnover > 12)) return false;
    if (s.volumeRatio > 0 && (s.volumeRatio < 1 || s.volumeRatio > 3.5)) return false;
    return true;
  }

  function passesMid(s) {
    if (!s.price || s.price <= 0) return false;
    if (s.mcap > 0 && s.mcap < 3e10) return false;
    if (s.peTtm > 0 && s.peTtm > 35) return false;
    if (s.pb > 0 && s.pb > 4) return false;
    if (s.changePct < -7 || Math.abs(s.changePct) > 7) return false;
    if (s.turnover > 8) return false;
    if (s.volumeRatio > 3) return false;
    return true;
  }

  function sectorBiasBonus(s, horizon) {
    const sector = SECTORS.find((x) => x.id === s.sectorId);
    const bias = sector?.preferredHorizon || "both";
    if (bias === "both" || bias === horizon) {
      return {
        bonus: bias === horizon ? 8 : 4,
        note: bias === horizon ? "板块口径偏" + (horizon === "short" ? "短期" : "中期") : "板块短/中均可观察",
      };
    }
    return { bonus: 0, note: "" };
  }

  function scoreShort(s) {
    let score = 0;
    const signals = [];
    const yi = s.mcap / 1e8;
    if (yi >= 500) {
      score += 16;
      signals.push("市值流动性较好");
    } else if (yi >= 200) {
      score += 13;
      signals.push("中大市值");
    } else {
      score += 9;
      signals.push("市值达标");
    }
    if (s.changePct >= 1 && s.changePct <= 4) {
      score += 25;
      signals.push("趋势温和走强");
    } else if (s.changePct > 4 && s.changePct <= 6) {
      score += 18;
      signals.push("趋势较强，注意追高");
    } else {
      score += 12;
      signals.push("趋势刚启动/偏弱");
    }
    if (s.volumeRatio >= 1.1 && s.volumeRatio <= 2) {
      score += 22;
      signals.push("量能放大适中");
    } else if (s.volumeRatio > 2 && s.volumeRatio <= 3) {
      score += 15;
      signals.push("量能偏强");
    } else {
      score += 10;
      signals.push("量能信息有限");
    }
    if (s.turnover >= 2 && s.turnover <= 6) {
      score += 18;
      signals.push("换手活跃");
    } else if (s.turnover > 0 && s.turnover <= 10) {
      score += 12;
      signals.push("换手偏高/偏低");
    } else {
      score += 7;
      signals.push("换手待观察");
    }
    if (s.peTtm > 0 && s.peTtm <= 45) {
      score += 12;
      signals.push("估值未过热");
    } else if (s.peTtm > 0 && s.peTtm <= 65) {
      score += 8;
      signals.push("估值偏高");
    } else {
      score += 4;
      signals.push("估值信息弱");
    }
    if (s.pb > 0 && s.pb <= 5) {
      score += 7;
      signals.push("PB可接受");
    } else {
      score += 4;
      signals.push("PB偏高/缺失");
    }
    const bias = sectorBiasBonus(s, "short");
    if (bias.bonus) {
      score += bias.bonus;
      signals.push(bias.note);
    }
    if (s.tip) signals.push(s.tip);
    return { score, signals };
  }

  function scoreMid(s) {
    let score = 0;
    const signals = [];
    const yi = s.mcap / 1e8;
    if (yi >= 1000) {
      score += 25;
      signals.push("超大市值");
    } else if (yi >= 500) {
      score += 21;
      signals.push("大市值");
    } else if (yi >= 300) {
      score += 17;
      signals.push("中大市值");
    } else {
      score += 12;
      signals.push("市值达标");
    }
    if (s.peTtm >= 8 && s.peTtm <= 25) {
      score += 20;
      signals.push("PE适中");
    } else if (s.peTtm > 0 && s.peTtm < 8) {
      score += 14;
      signals.push("PE较低，需查周期");
    } else {
      score += 10;
      signals.push("PE偏高或缺失");
    }
    if (s.pb > 0 && s.pb <= 2) {
      score += 15;
      signals.push("PB较稳");
    } else if (s.pb <= 3) {
      score += 11;
      signals.push("PB可接受");
    } else {
      score += 7;
      signals.push("PB偏高");
    }
    const absChg = Math.abs(s.changePct);
    if (absChg <= 2) {
      score += 15;
      signals.push("当日波动温和");
    } else if (absChg <= 4) {
      score += 11;
      signals.push("当日波动可控");
    } else {
      score += 6;
      signals.push("当日波动偏大");
    }
    if (s.turnover >= 0.5 && s.turnover <= 3) {
      score += 13;
      signals.push("换手适中");
    } else if (s.turnover <= 5) {
      score += 9;
      signals.push("换手略高");
    } else {
      score += 5;
      signals.push("换手偏高/缺失");
    }
    if (s.volumeRatio >= 0.7 && s.volumeRatio <= 1.8) {
      score += 12;
      signals.push("量比平稳");
    } else if (s.volumeRatio <= 2.5) {
      score += 8;
      signals.push("量比略高");
    } else {
      score += 4;
      signals.push("量比偏高/缺失");
    }
    const bias = sectorBiasBonus(s, "mid");
    if (bias.bonus) {
      score += bias.bonus;
      signals.push(bias.note);
    }
    if (s.tip) signals.push(s.tip);
    return { score, signals };
  }

  const state = {
    sectorPools: {},
    universe: [],
  };

  const els = {
    sectorBoard: document.getElementById("sectorBoard"),
    sectorStatus: document.getElementById("sectorStatus"),
    loadSectorsBtn: document.getElementById("loadSectorsBtn"),
    scanBtn: document.getElementById("boardScanBtn"),
    scanStatus: document.getElementById("boardScanStatus"),
    scanError: document.getElementById("boardScanError"),
    shortList: document.getElementById("shortRankList"),
    midList: document.getElementById("midRankList"),
    scanMeta: document.getElementById("boardScanMeta"),
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSectorCards() {
    if (!els.sectorBoard) return;
    els.sectorBoard.innerHTML = SECTORS.map((sector) => {
      const pool = state.sectorPools[sector.id] || [];
      const coreCodes = new Set((sector.core || []).map((c) => c.code));
      const rows = pool.slice(0, 12);
      const body = rows.length
        ? rows
            .map((s) => {
              const badge = coreCodes.has(s.code) ? '<em class="core-tag">核心</em>' : "";
              const chg = (s.changePct >= 0 ? "+" : "") + s.changePct.toFixed(2) + "%";
              const cls = s.changePct >= 0 ? "up" : "down";
              return (
                '<li class="sector-stock">' +
                "<div><strong>" +
                escapeHtml(s.name) +
                "</strong> " +
                badge +
                '<span class="muted"> ' +
                escapeHtml(s.code) +
                (s.tip ? " · " + escapeHtml(s.tip) : "") +
                "</span></div>" +
                '<div class="sector-px ' +
                cls +
                '">' +
                (s.price ? s.price.toFixed(2) : "--") +
                " <em>" +
                chg +
                "</em></div>" +
                "</li>"
              );
            })
            .join("")
        : '<li class="empty-picks">尚未加载成分，点击上方「加载板块推荐池」。</li>';
      return (
        '<article class="sector-card" id="sector-' +
        sector.id +
        '">' +
        '<div class="sector-head">' +
        "<div>" +
        '<p class="portal-kicker">' +
        escapeHtml(sector.id) +
        "</p>" +
        "<h3>" +
        escapeHtml(sector.name) +
        "</h3>" +
        "</div>" +
        '<span class="sector-count">' +
        pool.length +
        " 只</span>" +
        "</div>" +
        '<p class="sector-thesis">' +
        escapeHtml(sector.thesis) +
        "</p>" +
        '<ul class="sector-list">' +
        body +
        "</ul>" +
        "</article>"
      );
    }).join("");
  }

  async function buildSectorPool(sector) {
    const byCode = new Map();
    for (const item of sector.core || []) {
      const quote = await fetchQuoteRow(item.code);
      if (!quote || !isCleanName(quote.name)) continue;
      byCode.set(item.code, {
        ...quote,
        tip: item.tip || "",
        sectorId: sector.id,
        peTtm: quote.peTtm || quote.peDynamic || 0,
      });
    }
    for (const bk of sector.boards || []) {
      try {
        const rows = await fetchBoardRows(bk);
        for (const row of rows.slice(0, BOARD_EXPAND_LIMIT)) {
          const parsed = parseListRow(row, sector.id, "");
          if (!parsed) continue;
          if (!byCode.has(parsed.code)) byCode.set(parsed.code, parsed);
          else {
            const prev = byCode.get(parsed.code);
            byCode.set(parsed.code, {
              ...prev,
              ...parsed,
              tip: prev.tip || "",
              name: parsed.name || prev.name,
            });
          }
        }
      } catch (_) {
        /* board optional */
      }
    }
    return Array.from(byCode.values());
  }

  async function loadAllSectors() {
    if (!els.loadSectorsBtn) return;
    els.loadSectorsBtn.disabled = true;
    if (els.sectorStatus) els.sectorStatus.textContent = "正在拉取各板块推荐池…";
    try {
      for (let i = 0; i < SECTORS.length; i++) {
        const sector = SECTORS[i];
        if (els.sectorStatus) {
          els.sectorStatus.textContent = `加载板块 ${i + 1}/${SECTORS.length}：${sector.name}`;
        }
        state.sectorPools[sector.id] = await buildSectorPool(sector);
        renderSectorCards();
      }
      const universeMap = new Map();
      Object.values(state.sectorPools).forEach((list) => {
        list.forEach((s) => {
          if (!universeMap.has(s.code)) universeMap.set(s.code, s);
        });
      });
      state.universe = Array.from(universeMap.values()).slice(0, SCAN_POOL_CAP);
      if (els.sectorStatus) {
        els.sectorStatus.textContent =
          "板块池已就绪 · 合计去重 " + state.universe.length + " 只（可点下方全员筛选）";
      }
      if (els.scanMeta) {
        els.scanMeta.textContent = "池内 " + state.universe.length + " 只待筛选";
      }
    } catch (err) {
      if (els.sectorStatus) els.sectorStatus.textContent = "加载失败：" + (err?.message || String(err));
    }
    els.loadSectorsBtn.disabled = false;
  }

  function renderRankList(target, rows, emptyText) {
    if (!target) return;
    if (!rows.length) {
      target.innerHTML = '<p class="empty-picks">' + escapeHtml(emptyText) + "</p>";
      return;
    }
    target.innerHTML = rows
      .map((r, idx) => {
        const sector = SECTORS.find((s) => s.id === r.sectorId);
        const chg = (r.changePct >= 0 ? "+" : "") + r.changePct.toFixed(2) + "%";
        const cls = r.changePct >= 0 ? "up" : "down";
        return (
          '<article class="pick-card board-rank-card">' +
          '<div class="pick-top">' +
          "<div>" +
          '<p class="pick-code">' +
          (idx + 1) +
          ". " +
          escapeHtml(r.code) +
          " · " +
          escapeHtml(r.name) +
          "</p>" +
          '<h3 class="pick-title">' +
          escapeHtml(sector?.name || "板块池") +
          (r.tip ? " · " + escapeHtml(r.tip) : "") +
          "</h3>" +
          "</div>" +
          '<span class="pick-fit">' +
          r.score +
          "</span>" +
          "</div>" +
          '<p class="pick-meta ' +
          cls +
          '">' +
          (r.price ? r.price.toFixed(2) : "--") +
          " · " +
          chg +
          " · 量比 " +
          (r.volumeRatio ? r.volumeRatio.toFixed(2) : "--") +
          "</p>" +
          '<p class="pick-why">' +
          escapeHtml((r.signals || []).slice(0, 3).join("；")) +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  async function runPoolScan() {
    if (!els.scanBtn) return;
    if (!state.universe.length) {
      if (els.scanError) {
        els.scanError.hidden = false;
        els.scanError.textContent = "请先加载板块推荐池。";
      }
      return;
    }
    els.scanBtn.disabled = true;
    if (els.scanError) els.scanError.hidden = true;
    if (els.scanStatus) {
      els.scanStatus.hidden = false;
      els.scanStatus.textContent = "正在刷新池内行情并打分…";
    }

    try {
      const refreshed = await mapPool(state.universe, 6, async (item) => {
        // Prefer board fields already present; refresh quote for core accuracy when price missing.
        if (item.price > 0 && (item.volumeRatio > 0 || item.turnover > 0 || item.mcap > 0)) {
          return item;
        }
        const q = await fetchQuoteRow(item.code);
        if (!q) return item;
        return {
          ...item,
          ...q,
          tip: item.tip,
          sectorId: item.sectorId,
          peTtm: q.peTtm || q.peDynamic || item.peTtm || 0,
        };
      });

      const shortRows = refreshed
        .filter(passesShort)
        .map((s) => {
          const scored = scoreShort(s);
          return { ...s, ...scored, horizon: "short" };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      const midRows = refreshed
        .filter(passesMid)
        .map((s) => {
          const scored = scoreMid(s);
          return { ...s, ...scored, horizon: "mid" };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      renderRankList(els.shortList, shortRows, "短期画像下暂无过线标的。");
      renderRankList(els.midList, midRows, "中期画像下暂无过线标的。");
      if (els.scanStatus) els.scanStatus.hidden = true;
      if (els.scanMeta) {
        els.scanMeta.textContent =
          "池内 " +
          refreshed.length +
          " · 短期 " +
          shortRows.length +
          " · 中期 " +
          midRows.length +
          " · 观察分≠胜率";
      }
    } catch (err) {
      if (els.scanStatus) els.scanStatus.hidden = true;
      if (els.scanError) {
        els.scanError.hidden = false;
        els.scanError.textContent = "筛选失败：" + (err?.message || String(err));
      }
    }
    els.scanBtn.disabled = false;
  }

  renderSectorCards();
  if (els.loadSectorsBtn) els.loadSectorsBtn.addEventListener("click", loadAllSectors);
  if (els.scanBtn) els.scanBtn.addEventListener("click", runPoolScan);

  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
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
  }
})();
