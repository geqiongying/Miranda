(() => {
  const params = new URLSearchParams(window.location.search);
  const els = {
    title: document.getElementById("deskTitle"),
    lead: document.getElementById("deskLead"),
    input: document.getElementById("deskCodeInput"),
    loadBtn: document.getElementById("deskLoadBtn"),
    frameMa: document.getElementById("frameMa"),
    frameCoach: document.getElementById("frameCoach"),
    frameWuge: document.getElementById("frameWuge"),
    openMa: document.getElementById("deskOpenMa"),
    openCoach: document.getElementById("deskOpenCoach"),
    openWuge: document.getElementById("deskOpenWuge"),
  };

  function cleanCode(raw) {
    const m = String(raw || "").match(/\d{6}/);
    return m ? m[0] : "";
  }

  function loadDesk(code, name) {
    const c = cleanCode(code);
    if (!c) {
      if (els.lead) els.lead.textContent = "请输入六位股票代码后再打分。";
      return;
    }
    const label = name ? `${name}（${c}）` : c;
    if (els.title) els.title.textContent = label;
    if (els.lead) {
      els.lead.textContent = "下面三栏分别跑均线 / 量能 / 五哥，互不混用。观察分 ≠ 胜率。";
    }
    if (els.input) els.input.value = c;
    const q = encodeURIComponent(c);
    if (els.frameMa) els.frameMa.src = `./ma.html?code=${q}&embed=1#lab`;
    if (els.frameCoach) els.frameCoach.src = `./coach.html?code=${q}&embed=1#ask`;
    if (els.frameWuge) els.frameWuge.src = `./wuge.html?code=${q}&embed=1#ask`;
    if (els.openMa) els.openMa.href = `./ma.html?code=${q}#lab`;
    if (els.openCoach) els.openCoach.href = `./coach.html?code=${q}#ask`;
    if (els.openWuge) els.openWuge.href = `./wuge.html?code=${q}#ask`;
    const url = new URL(window.location.href);
    url.searchParams.set("code", c);
    if (name) url.searchParams.set("name", name);
    else url.searchParams.delete("name");
    history.replaceState(null, "", url.pathname + url.search);
  }

  if (els.loadBtn) {
    els.loadBtn.addEventListener("click", () => loadDesk(els.input?.value || "", ""));
  }
  if (els.input) {
    els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadDesk(els.input.value, "");
    });
  }

  const bootCode = cleanCode(params.get("code"));
  const bootName = params.get("name") || "";
  if (bootCode) loadDesk(bootCode, bootName);
  else if (els.lead) {
    els.lead.textContent = "从板块观察台点股票进来，或在上方输入代码后点「重新打分」。";
  }
})();
