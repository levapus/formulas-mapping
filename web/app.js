const {
  buildIndex,
  listAllProducts,
  lookupProductFlags,
  filterProductRows,
  normalizeKey,
} = globalThis.FormulasLookup;
const catalogFromCsvText = globalThis.FormulasCatalog?.catalogFromCsvText;
const resultsToXlsx = globalThis.FormulasXlsx?.resultsToXlsx;

const els = {
  category: document.getElementById("categoryFilter"),
  status: document.getElementById("status"),
  resultsBody: document.getElementById("resultsBody"),
  resultsEmpty: document.getElementById("resultsEmpty"),
  resultsTable: document.getElementById("resultsTable"),
  viewModeAll: document.getElementById("viewModeAll"),
  viewModeMatched: document.getElementById("viewModeMatched"),
  saveResults: document.getElementById("saveResults"),
  reloadDefault: document.getElementById("reloadDefault"),
  dataSourceLabel: document.getElementById("dataSourceLabel"),
  file: document.getElementById("fileInput"),
  clearConditions: document.getElementById("clearConditions"),
};

const DEFAULT_DATA_PATH = "../data/data.json";
const DEFAULT_DATA_LABEL = "data/data.json";

const SUGGESTION_PAGE_SIZE = 30;
const VIEW_MODE_STORAGE_KEY = "formulas.viewMode";
/** @typedef {"all"|"matched"} ViewMode */
/** @typedef {"recommend"|"avoid"} Polarity */

/** @type {any} */
let catalog = null;
/** @type {Map<string, any>} */
let index = new Map();
/** @type {{category: string, product: string}[]} */
let allProducts = [];
/** @type {Map<string, {display: string, polarity: Polarity}>} */
const selected = new Map();
/** @type {ViewMode} */
let viewMode = loadViewMode();
/** @type {{category: string, product: string, recommend: boolean, avoid: boolean, neutral: boolean}[]} */
let visibleRows = [];

/**
 * @typedef {object} Picker
 * @property {Polarity} polarity
 * @property {HTMLInputElement} input
 * @property {HTMLButtonElement} mic
 * @property {HTMLElement} panel
 * @property {HTMLUListElement} list
 * @property {HTMLButtonElement} prev
 * @property {HTMLButtonElement} next
 * @property {HTMLElement} pageInfo
 * @property {HTMLElement} chips
 * @property {any[]} matches
 * @property {number} page
 */

/** @type {Picker[]} */
const pickers = [
  createPicker("recommend", {
    input: "recommendInput",
    mic: "recommendMic",
    panel: "recommendSuggestionPanel",
    list: "recommendSuggestions",
    prev: "recommendPrev",
    next: "recommendNext",
    pageInfo: "recommendPageInfo",
    chips: "recommendChips",
  }),
  createPicker("avoid", {
    input: "avoidInput",
    mic: "avoidMic",
    panel: "avoidSuggestionPanel",
    list: "avoidSuggestions",
    prev: "avoidPrev",
    next: "avoidNext",
    pageInfo: "avoidPageInfo",
    chips: "avoidChips",
  }),
];

/** @type {Picker|null} */
let activeMicPicker = null;

function createPicker(polarity, ids) {
  return {
    polarity,
    input: document.getElementById(ids.input),
    mic: document.getElementById(ids.mic),
    panel: document.getElementById(ids.panel),
    list: document.getElementById(ids.list),
    prev: document.getElementById(ids.prev),
    next: document.getElementById(ids.next),
    pageInfo: document.getElementById(ids.pageInfo),
    chips: document.getElementById(ids.chips),
    matches: [],
    page: 0,
  };
}

function loadViewMode() {
  try {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved === "all" || saved === "matched") return saved;
  } catch {
    /* ignore storage errors */
  }
  return "all";
}

/** @param {ViewMode} mode */
function setViewMode(mode) {
  viewMode = mode;
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore storage errors */
  }
  els.viewModeAll.setAttribute("aria-pressed", mode === "all" ? "true" : "false");
  els.viewModeMatched.setAttribute(
    "aria-pressed",
    mode === "matched" ? "true" : "false",
  );
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

/** @param {Picker} picker */
function hidePickerPanel(picker) {
  picker.panel.hidden = true;
}

function hideAllSuggestionPanels() {
  for (const picker of pickers) hidePickerPanel(picker);
}

function setDataSourceLabel(label) {
  if (els.dataSourceLabel) {
    els.dataSourceLabel.textContent = `Источник: ${label}`;
  }
}

async function loadDefault() {
  try {
    const res = await fetch(DEFAULT_DATA_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applyCatalog(await res.json(), DEFAULT_DATA_LABEL);
  } catch (err) {
    setDataSourceLabel("не загружено (нужен сервер или другой файл)");
    setStatus(
      `Не удалось загрузить ${DEFAULT_DATA_LABEL}. Откройте через python -m http.server 8080 или укажите другой JSON слева.`,
      true,
    );
    console.error(err);
  }
}

function applyCatalog(data, sourceLabel = DEFAULT_DATA_LABEL) {
  if (!data || !Array.isArray(data.conditions)) {
    throw new Error("Некорректный формат data.json");
  }
  catalog = data;
  index = buildIndex(catalog);
  allProducts = listAllProducts(catalog);
  selected.clear();
  for (const picker of pickers) picker.input.value = "";
  els.category.innerHTML = `<option value="">Все</option>`;
  for (const c of catalog.categories || []) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    els.category.appendChild(opt);
  }
  setDataSourceLabel(sourceLabel);
  render();
  setStatus(
    `Загружено из ${sourceLabel}: ${catalog.conditions.length} условий, ${allProducts.length} продуктов`,
  );
}

function conditionMatchesCategory(cond, categoryFilter) {
  if (!categoryFilter) return true;
  return (cond.mappings || []).some((m) => m.category === categoryFilter);
}

/** @param {Polarity} polarity */
function conditionHasPolarity(cond, categoryFilter, polarity) {
  return (cond.mappings || []).some(
    (m) =>
      (!categoryFilter || m.category === categoryFilter) &&
      m.polarity === polarity,
  );
}

function pruneSelectedForCategory() {
  const categoryFilter = els.category.value || null;
  if (!categoryFilter) return;
  for (const key of [...selected.keys()]) {
    const cond = index.get(key);
    const meta = selected.get(key);
    if (
      !cond ||
      !meta ||
      !conditionHasPolarity(cond, categoryFilter, meta.polarity)
    ) {
      selected.delete(key);
    }
  }
}

/** @param {Picker} picker */
function filteredSuggestions(picker, query) {
  const q = normalizeKey(query);
  const categoryFilter = els.category.value || null;
  if (!catalog) return [];

  const matches = [];
  for (const c of catalog.conditions) {
    if (selected.has(c.key)) continue;
    if (!conditionMatchesCategory(c, categoryFilter)) continue;
    if (!conditionHasPolarity(c, categoryFilter, picker.polarity)) continue;
    if (q) {
      const hit =
        c.key.includes(q) ||
        normalizeKey(c.display).includes(q) ||
        (c.aliases || []).some((a) => normalizeKey(a).includes(q));
      if (!hit) continue;
    }
    matches.push(c);
  }

  matches.sort((a, b) => a.display.localeCompare(b.display, "ru"));
  return matches;
}

/** @param {Picker} picker */
function suggestionPageCount(picker) {
  if (!picker.matches.length) return 0;
  return Math.ceil(picker.matches.length / SUGGESTION_PAGE_SIZE);
}

/** @param {Picker} picker */
function resetSuggestionPaging(picker) {
  picker.matches = filteredSuggestions(picker, picker.input.value);
  picker.page = 0;
}

/** @param {Picker} picker */
function paintSuggestions(picker) {
  picker.list.innerHTML = "";
  if (document.activeElement !== picker.input) {
    hidePickerPanel(picker);
    return;
  }

  if (!picker.matches.length) {
    const empty = document.createElement("li");
    empty.className = "suggestions-empty";
    empty.textContent = els.category.value
      ? "Нет условий для выбранной категории"
      : "Нет условий";
    empty.addEventListener("mousedown", (e) => e.preventDefault());
    picker.list.appendChild(empty);
    picker.pageInfo.textContent = "0 из 0";
    picker.prev.disabled = true;
    picker.next.disabled = true;
    picker.panel.hidden = false;
    return;
  }

  const totalPages = suggestionPageCount(picker);
  if (picker.page >= totalPages) picker.page = Math.max(0, totalPages - 1);

  const start = picker.page * SUGGESTION_PAGE_SIZE;
  const items = picker.matches.slice(start, start + SUGGESTION_PAGE_SIZE);
  for (const c of items) {
    const li = document.createElement("li");
    li.textContent = c.display;
    li.dataset.key = c.key;
    li.className =
      picker.polarity === "avoid" ? "suggest-avoid" : "suggest-recommend";
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      addCondition(picker, c.key, c.display);
    });
    picker.list.appendChild(li);
  }

  const from = start + 1;
  const to = start + items.length;
  picker.pageInfo.textContent = `${from}–${to} из ${picker.matches.length} · стр. ${picker.page + 1}/${totalPages}`;
  picker.prev.disabled = picker.page <= 0;
  picker.next.disabled = picker.page >= totalPages - 1;

  picker.panel.hidden = false;
  picker.list.scrollTop = 0;
}

/** @param {Picker} picker */
function renderSuggestions(picker) {
  resetSuggestionPaging(picker);
  paintSuggestions(picker);
}

/** @param {Picker} picker */
function goSuggestionPage(picker, delta) {
  const totalPages = suggestionPageCount(picker);
  if (!totalPages) return;
  picker.page = Math.min(Math.max(0, picker.page + delta), totalPages - 1);
  paintSuggestions(picker);
  picker.input.focus();
}

/** @param {Picker} picker */
function addCondition(picker, key, display) {
  selected.set(key, { display, polarity: picker.polarity });
  picker.input.value = "";
  hidePickerPanel(picker);
  render({ showSuggestions: false });
  picker.input.blur();
}

function renderChips() {
  for (const picker of pickers) {
    if (!picker.chips) continue;
    picker.chips.innerHTML = "";
    for (const [key, meta] of selected) {
      if (meta.polarity !== picker.polarity) continue;
      const chip = document.createElement("span");
      chip.className = `chip chip-${picker.polarity}`;
      chip.textContent = meta.display;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "Удалить");
      btn.textContent = "×";
      btn.addEventListener("click", () => {
        selected.delete(key);
        render();
      });
      chip.appendChild(btn);
      picker.chips.appendChild(chip);
    }
  }
  if (els.clearConditions) {
    els.clearConditions.disabled = selected.size === 0;
  }
}

function clearAllConditions() {
  if (!selected.size) return;
  selected.clear();
  for (const picker of pickers) {
    if (picker.input) picker.input.value = "";
  }
  hideAllSuggestionPanels();
  render({ showSuggestions: false });
}

function checkCell(checked, tone) {
  const td = document.createElement("td");
  td.className = `check-cell check-${tone}`;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.tabIndex = -1;
  input.setAttribute("aria-disabled", "true");
  // Keep interactive look (colored) while blocking toggles.
  input.addEventListener("click", (e) => e.preventDefault());
  td.appendChild(input);
  return td;
}

function renderResultsTable(rows) {
  els.resultsBody.innerHTML = "";
  if (!rows.length) {
    els.resultsTable.hidden = true;
    els.resultsEmpty.hidden = false;
    if (!catalog) {
      els.resultsEmpty.textContent = "Загрузите data.json";
    } else if (viewMode === "matched") {
      els.resultsEmpty.textContent = selected.size
        ? "Нет совпадений для выбранных условий"
        : "Выберите условия, чтобы увидеть совпадения";
    } else {
      els.resultsEmpty.textContent = "Нет продуктов в выбранной категории";
    }
    return;
  }
  els.resultsTable.hidden = false;
  els.resultsEmpty.hidden = true;

  let lastCategory = null;
  for (const row of rows) {
    if (row.category !== lastCategory) {
      lastCategory = row.category;
      const groupRow = document.createElement("tr");
      groupRow.className = "category-row";
      const th = document.createElement("td");
      th.colSpan = 4;
      th.textContent = row.category;
      groupRow.appendChild(th);
      els.resultsBody.appendChild(groupRow);
    }
    const tr = document.createElement("tr");
    if (row.avoid) tr.classList.add("row-avoid");
    else if (row.recommend) tr.classList.add("row-recommend");
    else tr.classList.add("row-neutral");
    const name = document.createElement("td");
    name.className = "product-cell";
    name.textContent = row.product;
    tr.appendChild(name);
    tr.appendChild(checkCell(row.recommend, "recommend"));
    tr.appendChild(checkCell(row.avoid, "avoid"));
    tr.appendChild(checkCell(row.neutral, "neutral"));
    els.resultsBody.appendChild(tr);
  }
}

function render({ showSuggestions = true } = {}) {
  pruneSelectedForCategory();
  renderChips();
  if (showSuggestions) {
    for (const picker of pickers) {
      if (document.activeElement === picker.input) renderSuggestions(picker);
      else hidePickerPanel(picker);
    }
  } else {
    hideAllSuggestionPanels();
  }

  const filter = els.category.value || null;
  const allRows = lookupProductFlags(
    allProducts,
    index,
    [...selected.keys()],
    filter,
  );
  const rows = filterProductRows(allRows, viewMode);
  visibleRows = rows;
  renderResultsTable(rows);
  els.saveResults.disabled = rows.length === 0;

  if (!catalog) return;
  const recommended = allRows.filter((r) => r.recommend).length;
  const avoided = allRows.filter((r) => r.avoid).length;
  const neutral = allRows.filter((r) => r.neutral).length;
  const modeLabel = viewMode === "matched" ? "совпадения" : "все";
  if (!selected.size) {
    setStatus(
      viewMode === "matched"
        ? "Режим «только совпадения». Выберите условия."
        : `Все продукты (${rows.length}), все нейтральны. Выберите условия.`,
    );
  } else {
    setStatus(
      `Условий: ${selected.size} · в таблице: ${rows.length} (${modeLabel}) · рек.: ${recommended} · избегать: ${avoided} · нейтр.: ${neutral}`,
    );
  }
}

/** @param {Picker} picker */
function applySpokenQuery(picker, text) {
  picker.input.value = (text || "").trim();
  picker.input.focus();
  renderSuggestions(picker);
}

/** @param {Picker|null} picker */
function setMicListening(picker, on) {
  for (const p of pickers) {
    const listening = on && p === picker;
    p.mic.classList.toggle("listening", listening);
    p.mic.setAttribute("aria-pressed", listening ? "true" : "false");
    p.mic.title = listening
      ? "Слушаю… нажмите ещё раз, чтобы остановить"
      : "Голосовой ввод (например: Луна)";
  }
  activeMicPicker = on ? picker : null;
}

const SpeechRecognitionCtor =
  globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
/** @type {InstanceType<typeof SpeechRecognition>|null} */
let recognition = null;
if (SpeechRecognitionCtor) {
  recognition = new SpeechRecognitionCtor();
  recognition.lang = "ru-RU";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener("start", () => {
    if (activeMicPicker) setMicListening(activeMicPicker, true);
  });
  recognition.addEventListener("end", () => setMicListening(null, false));
  recognition.addEventListener("error", (event) => {
    setMicListening(null, false);
    if (event.error === "not-allowed") {
      setStatus("Нет доступа к микрофону — разрешите его в настройках браузера.", true);
    } else if (event.error !== "aborted" && event.error !== "no-speech") {
      setStatus(`Ошибка голосового ввода: ${event.error}`, true);
    }
  });
  recognition.addEventListener("result", (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (activeMicPicker) applySpokenQuery(activeMicPicker, transcript);
  });
} else {
  for (const picker of pickers) {
    if (!picker.mic) continue;
    picker.mic.disabled = true;
    picker.mic.title = "Голосовой ввод недоступен (нужен Chrome)";
  }
}

/** @param {Picker} picker */
function wirePicker(picker) {
  if (!picker.input || !picker.panel || !picker.list || !picker.prev || !picker.next) {
    console.error("Condition picker DOM is incomplete", picker.polarity);
    return;
  }
  if (picker.mic) {
    picker.mic.addEventListener("mousedown", (e) => e.preventDefault());
    picker.mic.addEventListener("click", () => {
      if (!recognition) {
        setStatus("Голосовой ввод недоступен в этом браузере (нужен Chrome).", true);
        return;
      }
      if (picker.mic.classList.contains("listening")) {
        recognition.stop();
        return;
      }
      activeMicPicker = picker;
      try {
        recognition.start();
      } catch (err) {
        console.error(err);
        setStatus("Не удалось запустить микрофон.", true);
      }
    });
  }

  picker.input.addEventListener("input", () => renderSuggestions(picker));
  picker.input.addEventListener("focus", () => {
    for (const other of pickers) {
      if (other !== picker) hidePickerPanel(other);
    }
    renderSuggestions(picker);
  });
  picker.input.addEventListener("click", () => {
    if (picker.panel.hidden) renderSuggestions(picker);
  });
  picker.input.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement === picker.input) return;
      if (picker.panel.contains(document.activeElement)) return;
      hidePickerPanel(picker);
    }, 0);
  });
  picker.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = picker.list.querySelector("li[data-key]");
      if (first) addCondition(picker, first.dataset.key, first.textContent);
    }
    if (e.key === "Escape") hidePickerPanel(picker);
    if (e.key === "ArrowLeft" && e.altKey) {
      e.preventDefault();
      goSuggestionPage(picker, -1);
    }
    if (e.key === "ArrowRight" && e.altKey) {
      e.preventDefault();
      goSuggestionPage(picker, 1);
    }
  });
  picker.prev.addEventListener("mousedown", (e) => e.preventDefault());
  picker.next.addEventListener("mousedown", (e) => e.preventDefault());
  picker.prev.addEventListener("click", () => goSuggestionPage(picker, -1));
  picker.next.addEventListener("click", () => goSuggestionPage(picker, 1));
}

for (const picker of pickers) wirePicker(picker);

els.category?.addEventListener("change", () => {
  pruneSelectedForCategory();
  render();
});
els.viewModeAll?.addEventListener("click", () => {
  setViewMode("all");
  render({ showSuggestions: false });
});
els.viewModeMatched?.addEventListener("click", () => {
  setViewMode("matched");
  render({ showSuggestions: false });
});
if (els.viewModeAll && els.viewModeMatched) setViewMode(viewMode);

function downloadResultsExcel() {
  if (!visibleRows.length) {
    setStatus("Нет результатов для сохранения", true);
    return;
  }
  if (typeof resultsToXlsx !== "function") {
    setStatus("Экспорт Excel недоступен (не загружен xlsx-export.js)", true);
    return;
  }
  const buffer = resultsToXlsx(visibleRows, {
    conditions: [...selected.values()].map((m) => m.display),
  });
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `formulas-results-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Сохранено: ${visibleRows.length} строк → ${a.download}`);
}

els.saveResults?.addEventListener("click", downloadResultsExcel);
els.clearConditions?.addEventListener("click", clearAllConditions);
els.reloadDefault?.addEventListener("click", () => {
  if (els.file) els.file.value = "";
  loadDefault();
});
function isCsvFile(file) {
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".csv") || file.type === "text/csv";
}

els.file?.addEventListener("change", async () => {
  const file = els.file.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    if (isCsvFile(file)) {
      if (typeof catalogFromCsvText !== "function") {
        throw new Error("catalog.js не загружен");
      }
      applyCatalog(catalogFromCsvText(text), file.name);
    } else {
      applyCatalog(JSON.parse(text), file.name);
    }
  } catch (err) {
    setStatus("Ошибка чтения JSON/CSV", true);
    console.error(err);
  }
});

loadDefault();
