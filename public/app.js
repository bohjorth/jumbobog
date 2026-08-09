(function () {
  "use strict";

  const CONDITION_LABELS = [
    [0, "0 – Defekt"], [1, "1 – Meget dårlig"], [2, "2 – Dårlig"],
    [3, "3 – Under middel"], [4, "4 – Middel"], [5, "5 – Jævn"],
    [6, "6 – Pæn"], [7, "7 – God"], [8, "8 – Flot"],
    [9, "9 – Næsten som ny"], [10, "10 – Som ny"],
  ];

  const SOURCES = [
    ["Wikipedia – Jumbobøger nr. 1-100 osv.", "https://da.wikipedia.org/wiki/Jumbobog"],
    ["Jan Wennebergs detaljerede oversigt (oplag, år, pris)", "https://www.wenneberg.dk/Comics/Jumbo/oversigt.htm"],
    ["ComicWiki – Jumbobog", "https://comicwiki.dk/wiki/Jumbobog"],
    ["Faraos Cigarer – antikvariske Jumbobøger (kun manuelt opslag)", "https://www.faraos.dk/antikvarisk/disney/jumboboeger"],
  ];

  function conditionColor(v) {
    if (v === null || v === undefined || v === "") return "var(--line)";
    const t = Number(v) / 10;
    const stops = [[0.0, [139, 47, 39]], [0.5, [216, 155, 46]], [1.0, [47, 110, 104]]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = (t - a[0]) / span;
    const c = a[1].map((v0, i) => Math.round(v0 + (b[1][i] - v0) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }

  let TOTAL_BOOKS = 552;
  let GROUPS = [];
  let state = { entries: {}, extras: [] };
  let ui = { search: "", onlyOwned: false, openGroups: new Set(), showImport: false, showSources: false };

  let saveTimers = {};
  function scheduleSaveTitle(num) {
    clearTimeout(saveTimers["t" + num]);
    saveTimers["t" + num] = setTimeout(async () => {
      setSaving(true);
      await fetch(`/api/entries/${num}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: state.entries[num].title }),
      }).catch(() => {});
      setSaving(false);
    }, 400);
  }
  function scheduleSaveCopy(num, copyId) {
    clearTimeout(saveTimers["c" + num + "-" + copyId]);
    saveTimers["c" + num + "-" + copyId] = setTimeout(async () => {
      setSaving(true);
      const copy = state.entries[num].copies.find((c) => c.id === copyId);
      if (copy) {
        await fetch(`/api/entries/${num}/copies/${copyId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oplaeg: copy.oplaeg, edition: copy.edition, condition: copy.condition, notes: copy.notes }),
        }).catch(() => {});
      }
      setSaving(false);
    }, 400);
  }
  function scheduleSaveExtra(id) {
    clearTimeout(saveTimers["x" + id]);
    saveTimers["x" + id] = setTimeout(async () => {
      setSaving(true);
      const x = state.extras.find((e) => e.id === id);
      if (x) {
        await fetch(`/api/extras/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: x.label, title: x.title, edition: x.edition, condition: x.condition, owned: x.owned, notes: x.notes }),
        }).catch(() => {});
      }
      setSaving(false);
    }, 400);
  }

  let savingEl;
  function setSaving(v) { if (savingEl) savingEl.textContent = v ? "Gemmer…" : "Gemt"; }

  function groupKey([a, b]) { return a + "-" + b; }
  function computeGroups(total) {
    const groups = []; let start = 1;
    while (start <= total) { const end = Math.min(start + 99, total); groups.push([start, end]); start = end + 1; }
    return groups;
  }

  function matchesSearch(num, e) {
    const q = ui.search.trim().toLowerCase();
    if (!q) return true;
    if (String(num).includes(q)) return true;
    if (e.title && e.title.toLowerCase().includes(q)) return true;
    return false;
  }

  function ownedTotal() {
    let c = 0;
    for (const k in state.entries) if (state.entries[k].copies.length > 0) c++;
    return c + state.extras.filter((x) => x.owned).length;
  }
  function copiesTotal() {
    let c = 0;
    for (const k in state.entries) c += state.entries[k].copies.length;
    return c + state.extras.filter((x) => x.owned).length;
  }

  /* ---------------- root layout (built once) ---------------- */
  const root = document.getElementById("app");
  let headerBox, spineBox, controlsBox, panelsBox, groupsBox;

  async function init() {
    const res = await fetch("/api/state");
    const data = await res.json();
    state.entries = data.entries;
    state.extras = data.extras;
    TOTAL_BOOKS = data.totalBooks || 552;
    GROUPS = computeGroups(TOTAL_BOOKS);
    ui.openGroups.add(groupKey(GROUPS[0]));

    root.innerHTML = "";
    headerBox = el("header", { class: "header" });
    spineBox = el("div", { class: "spine-wrap" });
    controlsBox = el("div", { class: "controls" });
    panelsBox = el("div");
    groupsBox = el("div", { class: "groups" });
    root.appendChild(headerBox);
    root.appendChild(spineBox);
    root.appendChild(controlsBox);
    root.appendChild(panelsBox);
    root.appendChild(groupsBox);

    renderHeader();
    renderSpine();
    renderControls();
    renderPanels();
    renderGroups();
  }

  /* ---------------- header ---------------- */
  function renderHeader() {
    headerBox.innerHTML = "";
    const left = el("div", {}, [
      el("div", { class: "eyebrow", text: "SAMLEROVERSIGT" }),
      el("h1", { class: "h1", text: "Jumbobog-samlingen" }),
    ]);
    const badge = el("div", { class: "tally-badge" }, [
      el("span", { class: "tally-num", text: String(ownedTotal()) }),
      el("span", { class: "tally-den", text: `/${TOTAL_BOOKS + state.extras.length}` }),
    ]);
    const sub = el("div", { class: "tally-sub", text: `${copiesTotal()} eksemplar(er) i alt` });
    savingEl = el("div", { class: "save-state", text: "Gemt" });
    const right = el("div", { class: "header-right" }, [badge, sub, savingEl]);
    headerBox.appendChild(left);
    headerBox.appendChild(right);
  }

  /* ---------------- spine strip ---------------- */
  const barRefs = {};
  function renderSpine() {
    spineBox.innerHTML = "";
    const strip = el("div", { class: "spine-strip" });
    for (let n = 1; n <= TOTAL_BOOKS; n++) {
      const e = state.entries[n];
      const bar = el("div", { class: "spine-bar" });
      updateBar(bar, e);
      barRefs[n] = bar;
      bar.title = `Nr. ${n}${e.title ? " – " + e.title : ""}${e.copies.length ? ` (${e.copies.length} stk.)` : ""}`;
      strip.appendChild(bar);
    }
    spineBox.appendChild(strip);
    spineBox.appendChild(el("div", { class: "spine-caption", text: "Ryggen på din reol — hver streg er ét nummer. Farven viser standen på de bøger, du ejer." }));
  }
  function updateBar(bar, e) {
    const owned = e.copies.length > 0;
    const best = owned ? e.copies.reduce((m, c) => (c.condition !== "" && Number(c.condition) > m ? Number(c.condition) : m), -1) : -1;
    const color = owned ? conditionColor(best >= 0 ? best : null) : "var(--spine-empty)";
    bar.style.background = color;
    bar.style.opacity = owned ? "1" : "0.55";
  }

  /* ---------------- controls ---------------- */
  function renderControls() {
    controlsBox.innerHTML = "";
    const search = el("input", {
      class: "search-input", placeholder: "Søg på nummer eller titel…", value: ui.search,
      oninput: (ev) => { ui.search = ev.target.value; autoExpandForSearch(); renderGroups(); },
    });
    const ownedLabel = el("label", { class: "checkbox-label" });
    const ownedCb = el("input", { type: "checkbox" });
    ownedCb.checked = ui.onlyOwned;
    ownedCb.addEventListener("change", (ev) => { ui.onlyOwned = ev.target.checked; renderGroups(); });
    ownedLabel.appendChild(ownedCb);
    ownedLabel.appendChild(document.createTextNode("Vis kun ejede"));

    const importBtn = el("button", { class: "ghost-btn", text: ui.showImport ? "Luk import" : "Importér titler", onclick: () => { ui.showImport = !ui.showImport; renderPanels(); } });
    const sourcesBtn = el("button", { class: "ghost-btn", text: ui.showSources ? "Skjul kilder" : "Kilder", onclick: () => { ui.showSources = !ui.showSources; renderPanels(); } });

    controlsBox.appendChild(search);
    controlsBox.appendChild(ownedLabel);
    controlsBox.appendChild(importBtn);
    controlsBox.appendChild(sourcesBtn);
  }

  function autoExpandForSearch() {
    if (!ui.search.trim()) return;
    for (const [from, to] of GROUPS) {
      for (let n = from; n <= to; n++) {
        if (matchesSearch(n, state.entries[n])) { ui.openGroups.add(groupKey([from, to])); break; }
      }
    }
  }

  /* ---------------- panels (import / sources) ---------------- */
  function renderPanels() {
    panelsBox.innerHTML = "";
    if (ui.showSources) panelsBox.appendChild(buildSourcesPanel());
    if (ui.showImport) panelsBox.appendChild(buildImportPanel());
  }

  function buildSourcesPanel() {
    const panel = el("div", { class: "panel" });
    panel.appendChild(el("div", { class: "panel-help", text: "Gode steder at slå numre og titler op:" }));
    const list = el("ul", { class: "source-list" });
    SOURCES.forEach(([label, url]) => {
      const li = el("li");
      const a = el("a", { href: url, target: "_blank", rel: "noreferrer", text: label });
      li.appendChild(a);
      list.appendChild(li);
    });
    panel.appendChild(list);
    return panel;
  }

  function buildImportPanel() {
    const panel = el("div", { class: "panel" });
    panel.appendChild(el("div", {
      class: "panel-help",
      text: "Kopiér en linje pr. bog i formatet \"nummer titel\" (fx \"127 Anders And på afveje\") og indsæt herunder. Kun linjer der starter med et gyldigt nummer bliver brugt, og eksisterende titler bliver overskrevet.",
    }));
    const textarea = el("textarea", { rows: 6, placeholder: "127 Anders And på afveje\n128 Onkel Joakim og den gyldne gås\n…" });
    const footer = el("div", { class: "panel-footer" });
    const count = el("span", { class: "import-count", text: "0 linje(r) genkendt" });
    const applyBtn = el("button", { class: "primary-btn", text: "Indsæt" });
    applyBtn.disabled = true;

    function parse(text) {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const out = [];
      for (const line of lines) {
        const m = line.match(/^(\d{1,4})[.:\-\s]+\s*(.+)$/);
        if (m) {
          const num = parseInt(m[1], 10);
          const title = m[2].trim();
          if (num >= 1 && num <= TOTAL_BOOKS && title) out.push({ num, title });
        }
      }
      return out;
    }

    let preview = [];
    textarea.addEventListener("input", () => {
      preview = parse(textarea.value);
      count.textContent = `${preview.length} linje(r) genkendt`;
      applyBtn.disabled = preview.length === 0;
      applyBtn.textContent = preview.length ? `Indsæt (${preview.length})` : "Indsæt";
    });

    applyBtn.addEventListener("click", async () => {
      if (!preview.length) return;
      preview.forEach(({ num, title }) => { state.entries[num].title = title; });
      renderSpine();
      renderGroups();
      setSaving(true);
      await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: preview }),
      }).catch(() => {});
      setSaving(false);
      textarea.value = "";
      preview = [];
      count.textContent = "0 linje(r) genkendt";
      applyBtn.disabled = true;
      applyBtn.textContent = "Indsæt";
    });

    footer.appendChild(count);
    footer.appendChild(applyBtn);
    panel.appendChild(textarea);
    panel.appendChild(footer);
    return panel;
  }

  /* ---------------- groups & rows ---------------- */
  function renderGroups() {
    groupsBox.innerHTML = "";
    GROUPS.forEach(([from, to]) => groupsBox.appendChild(buildGroupCard(from, to)));
    groupsBox.appendChild(buildExtrasCard());
  }

  function groupStats(from, to) {
    let owned = 0;
    for (let n = from; n <= to; n++) if (state.entries[n].copies.length > 0) owned++;
    return { owned, total: to - from + 1 };
  }

  function buildGroupCard(from, to) {
    const key = groupKey([from, to]);
    const isOpen = ui.openGroups.has(key);
    const card = el("div", { class: "group-card" });
    const stats = groupStats(from, to);
    const header = el("button", { class: "group-header" }, [
      el("span", { class: "group-arrow", text: isOpen ? "▾" : "▸" }),
      el("span", { class: "group-title", text: `Nr. ${from}–${to}` }),
      el("span", { class: "group-count", text: `${stats.owned} / ${stats.total} ejet` }),
    ]);
    header.addEventListener("click", () => {
      isOpen ? ui.openGroups.delete(key) : ui.openGroups.add(key);
      renderGroups();
    });
    card.appendChild(header);
    if (isOpen) card.appendChild(buildTable(from, to));
    return card;
  }

  function buildTable(from, to) {
    const wrap = el("div", { class: "book-list" });
    let any = false;
    for (let n = from; n <= to; n++) {
      const e = state.entries[n];
      if (!matchesSearch(n, e)) continue;
      if (ui.onlyOwned && e.copies.length === 0) continue;
      any = true;
      wrap.appendChild(buildBookCard(n, e));
    }
    if (!any) wrap.appendChild(el("div", { class: "empty-row", text: "Ingen numre matcher i denne gruppe." }));
    return wrap;
  }

  function buildBookCard(num, e) {
    const owned = e.copies.length > 0;
    const card = el("div", { class: "book-card" + (owned ? " owned" : "") });

    const numBadge = el("div", { class: "book-num-badge", text: "#" + num });
    const titleInput = el("input", { class: "text-input title-input", placeholder: "Titel / oplæg…", value: e.title });
    titleInput.addEventListener("input", (ev) => {
      e.title = ev.target.value;
      barRefs[num].title = `Nr. ${num}${e.title ? " – " + e.title : ""}${e.copies.length ? ` (${e.copies.length} stk.)` : ""}`;
      scheduleSaveTitle(num);
    });

    const addBtn = el("button", { class: "add-copy-btn", text: "+ Eksemplar" });
    const copiesBox = el("div", { class: "copies-list" });

    function renderCopies() {
      copiesBox.innerHTML = "";
      if (e.copies.length === 0) return;
      e.copies.forEach((copy) => copiesBox.appendChild(buildCopyRow(num, e, copy, refreshCard)));
    }
    function refreshCard() {
      card.classList.toggle("owned", e.copies.length > 0);
      updateBar(barRefs[num], e);
      barRefs[num].title = `Nr. ${num}${e.title ? " – " + e.title : ""}${e.copies.length ? ` (${e.copies.length} stk.)` : ""}`;
      countBadge.textContent = e.copies.length ? `${e.copies.length} stk.` : "0 stk.";
      renderHeader();
    }

    const countBadge = el("span", { class: "copy-count", text: e.copies.length ? `${e.copies.length} stk.` : "0 stk." });

    addBtn.addEventListener("click", async () => {
      setSaving(true);
      const res = await fetch(`/api/entries/${num}/copies`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oplaeg: "", edition: "", condition: "", notes: "" }),
      });
      const copy = await res.json();
      e.copies.push(copy);
      setSaving(false);
      renderCopies();
      refreshCard();
    });

    const head = el("div", { class: "book-card-head" }, [numBadge, titleInput, countBadge, addBtn]);
    card.appendChild(head);
    card.appendChild(copiesBox);
    renderCopies();
    return card;
  }

  function buildCopyRow(num, e, copy, onChange) {
    const row = el("div", { class: "copy-row" });

    const oplaegInput = el("input", { class: "text-input", placeholder: "Oplæg (hvis anderledes end ovenfor)", value: copy.oplaeg || "" });
    const editionInput = el("input", { class: "text-input", placeholder: "fx 3. oplag, 2007", value: copy.edition || "" });
    const select = el("select", { class: "select-input" });
    select.appendChild(el("option", { value: "", text: "–" }));
    CONDITION_LABELS.forEach(([v, label]) => {
      const opt = el("option", { value: String(v), text: label });
      if (String(copy.condition) === String(v)) opt.selected = true;
      select.appendChild(opt);
    });
    select.style.borderColor = conditionColor(copy.condition === "" ? null : copy.condition);
    const removeBtn = el("button", { class: "remove-btn", text: "×", title: "Fjern eksemplar" });

    oplaegInput.addEventListener("input", (ev) => { copy.oplaeg = ev.target.value; scheduleSaveCopy(num, copy.id); });
    editionInput.addEventListener("input", (ev) => { copy.edition = ev.target.value; scheduleSaveCopy(num, copy.id); });
    select.addEventListener("change", (ev) => {
      copy.condition = ev.target.value;
      select.style.borderColor = conditionColor(copy.condition === "" ? null : copy.condition);
      updateBar(barRefs[num], e);
      scheduleSaveCopy(num, copy.id);
    });
    removeBtn.addEventListener("click", async () => {
      e.copies = e.copies.filter((c) => c.id !== copy.id);
      updateBar(barRefs[num], e);
      renderHeader();
      renderGroups();
      await fetch(`/api/entries/${num}/copies/${copy.id}`, { method: "DELETE" }).catch(() => {});
    });

    row.appendChild(oplaegInput);
    row.appendChild(editionInput);
    row.appendChild(select);
    row.appendChild(removeBtn);
    return row;
  }

  /* ---------------- extras ---------------- */
  function buildExtrasCard() {
    const card = el("div", { class: "group-card" });
    const header = el("div", { class: "group-header" }, [
      el("span", { class: "group-arrow", text: "·" }),
      el("span", { class: "group-title", text: "Andre udgivelser (uden nummer)" }),
      el("span", { class: "group-count", text: `${state.extras.length} stk.` }),
    ]);
    card.appendChild(header);

    if (state.extras.length === 0) {
      card.appendChild(el("div", { class: "empty-row", text: "Ekstrabøger, jubilæumsbøger og temabøger uden løbenummer kan tilføjes her." }));
    } else {
      const wrap = el("div");
      const head = el("div", { class: "jb-head", style: "grid-template-columns:28px 90px 1fr 1fr 150px 28px;" }, [
        el("div"), el("div", { text: "Mærkat" }), el("div", { text: "Titel" }),
        el("div", { text: "Udgave / oplag" }), el("div", { text: "Stand" }), el("div"),
      ]);
      wrap.appendChild(head);
      state.extras.forEach((x) => wrap.appendChild(buildExtraRow(x)));
      card.appendChild(wrap);
    }

    const addBtn = el("button", { class: "add-extra-btn", text: "+ Tilføj bog uden nummer" });
    addBtn.addEventListener("click", async () => {
      setSaving(true);
      const res = await fetch("/api/extras", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "", title: "", edition: "", condition: "", owned: true, notes: "" }),
      });
      const extra = await res.json();
      state.extras.push(extra);
      setSaving(false);
      renderGroups();
      renderHeader();
    });
    card.appendChild(addBtn);
    return card;
  }

  function buildExtraRow(x) {
    const row = el("div", { class: "jb-row-extra" + (x.owned ? " owned" : "") });
    row.style.gridTemplateColumns = "28px 90px 1fr 1fr 150px 28px";

    const cb = el("input", { type: "checkbox" });
    cb.checked = x.owned;
    const labelInput = el("input", { class: "text-input", placeholder: "fx Ekstra", value: x.label });
    const titleInput = el("input", { class: "text-input", placeholder: "Titel…", value: x.title });
    const editionInput = el("input", { class: "text-input", placeholder: "fx 1. oplag", value: x.edition });
    const select = el("select", { class: "select-input" });
    select.appendChild(el("option", { value: "", text: "–" }));
    CONDITION_LABELS.forEach(([v, label]) => {
      const opt = el("option", { value: String(v), text: label });
      if (String(x.condition) === String(v)) opt.selected = true;
      select.appendChild(opt);
    });
    const removeBtn = el("button", { class: "remove-btn", text: "×", title: "Fjern" });

    cb.addEventListener("change", (ev) => { x.owned = ev.target.checked; row.classList.toggle("owned", x.owned); renderHeader(); scheduleSaveExtra(x.id); });
    labelInput.addEventListener("input", (ev) => { x.label = ev.target.value; scheduleSaveExtra(x.id); });
    titleInput.addEventListener("input", (ev) => { x.title = ev.target.value; scheduleSaveExtra(x.id); });
    editionInput.addEventListener("input", (ev) => { x.edition = ev.target.value; scheduleSaveExtra(x.id); });
    select.addEventListener("change", (ev) => { x.condition = ev.target.value; scheduleSaveExtra(x.id); });
    removeBtn.addEventListener("click", async () => {
      state.extras = state.extras.filter((e) => e.id !== x.id);
      renderGroups();
      renderHeader();
      await fetch(`/api/extras/${x.id}`, { method: "DELETE" }).catch(() => {});
    });

    row.appendChild(el("div", {}, [cb]));
    row.appendChild(el("div", {}, [labelInput]));
    row.appendChild(el("div", {}, [titleInput]));
    row.appendChild(el("div", {}, [editionInput]));
    row.appendChild(el("div", {}, [select]));
    row.appendChild(removeBtn);
    return row;
  }

  init();
})();
