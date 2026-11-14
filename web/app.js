const { buildIndex, lookupProducts, normalizeKey } = globalThis.FormulasLookup;

const els = {
  input: document.getElementById("conditionInput"),
  suggestionPanel: document.getElementById("suggestionPanel"),
  suggestions: document.getElementById("suggestions"),
  suggestionPrev: document.getElementById("suggestionPrev"),
  suggestionNext: document.getElementById("suggestionNext"),
  suggestionPageInfo: document.getElementById("suggestionPageInfo"),
  chips: document.getElementById("chips"),
  category: document.getElementById("categoryFilter"),
  status: document.getElementById("status"),
  avoid: document.getElementById("avoidResults"),
  recommend: document.getElementById("recommendResults"),
  file: document.getElementById("fileInput"),
};

const SUGGESTION_PAGE_SIZE = 30;

/** @type {any} */
let catalog = null;
/** @type {Map<string, any>} */
let index = new Map();
/** @type {Map<string, string>} key -> display */
const selected = new Map();
/** @type {any[]} */
let suggestionMatches = [];
/** 0-based page index */
let suggestionPage = 0;

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

function hideSuggestionPanel() {
  els.suggestionPanel.hidden = true;
}

async function loadDefault() {
  try {
    const res = await fetch("../data/data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applyCatalog(await res.json());
  } catch (err) {
    setStatus(
      "Автозагрузка data.json недоступна (откройте через python -m http.server 8080 или выберите файл ниже: Загрузить data.json).",
      true,
    );
    console.error(err);
  }
}

function applyCatalog(data) {
  if (!data || !Array.isArray(data.conditions)) {
    throw new Error("Некорректный формат data.json");
  }
  catalog = data;
  index = buildIndex(catalog);
  selected.clear();
  els.category.innerHTML = `<option value="">Все</option>`;
  for (const c of catalog.categories || []) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    els.category.appendChild(opt);
  }
  render();
  setStatus(`Загружено условий: ${catalog.conditions.length}`);
}

function filteredSuggestions(query) {
  const q = normalizeKey(query);
  if (!catalog) return [];
  return catalog.conditions.filter((c) => {
    if (selected.has(c.key)) return false;
    if (!q) return true;
    if (c.key.includes(q)) return true;
    if (normalizeKey(c.display).includes(q)) return true;
    return (c.aliases || []).some((a) => normalizeKey(a).includes(q));
  });
}

function suggestionPageCount() {
  if (!suggestionMatches.length) return 0;
  return Math.ceil(suggestionMatches.length / SUGGESTION_PAGE_SIZE);
}

function resetSuggestionPaging() {
  suggestionMatches = filteredSuggestions(els.input.value);
  suggestionPage = 0;
}

function paintSuggestions() {
  els.suggestions.innerHTML = "";
  if (!suggestionMatches.length || document.activeElement !== els.input) {
    hideSuggestionPanel();
    return;
  }

  const totalPages = suggestionPageCount();
  if (suggestionPage >= totalPages) suggestionPage = Math.max(0, totalPages - 1);

  const start = suggestionPage * SUGGESTION_PAGE_SIZE;
  const items = suggestionMatches.slice(start, start + SUGGESTION_PAGE_SIZE);
  for (const c of items) {
    const li = document.createElement("li");
    li.textContent = c.display;
    li.dataset.key = c.key;
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      addCondition(c.key, c.display);
    });
    els.suggestions.appendChild(li);
  }

  const from = start + 1;
  const to = start + items.length;
  els.suggestionPageInfo.textContent = `${from}–${to} из ${suggestionMatches.length} · стр. ${suggestionPage + 1}/${totalPages}`;
  els.suggestionPrev.disabled = suggestionPage <= 0;
  els.suggestionNext.disabled = suggestionPage >= totalPages - 1;

  els.suggestionPanel.hidden = false;
  els.suggestions.scrollTop = 0;
}

function renderSuggestions() {
  resetSuggestionPaging();
  paintSuggestions();
}

function goSuggestionPage(delta) {
  const totalPages = suggestionPageCount();
  if (!totalPages) return;
  suggestionPage = Math.min(Math.max(0, suggestionPage + delta), totalPages - 1);
  paintSuggestions();
  els.input.focus();
}

function addCondition(key, display) {
  selected.set(key, display);
  els.input.value = "";
  hideSuggestionPanel();
  // Stay closed until the user types or re-focuses the input.
  render({ showSuggestions: false });
}

function renderChips() {
  els.chips.innerHTML = "";
  for (const [key, display] of selected) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = display;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Удалить");
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      selected.delete(key);
      render();
    });
    chip.appendChild(btn);
    els.chips.appendChild(chip);
  }
}

function renderGroups(container, groups) {
  container.innerHTML = "";
  if (!groups.length) {
    container.textContent = "—";
    return;
  }
  for (const g of groups) {
    const div = document.createElement("div");
    div.className = "group";
    const h = document.createElement("h3");
    h.textContent = g.category;
    const ul = document.createElement("ul");
    for (const p of g.products) {
      const li = document.createElement("li");
      li.textContent = p;
      ul.appendChild(li);
    }
    div.appendChild(h);
    div.appendChild(ul);
    container.appendChild(div);
  }
}

function render({ showSuggestions = true } = {}) {
  renderChips();
  if (showSuggestions) renderSuggestions();
  else hideSuggestionPanel();
  if (!selected.size) {
    els.avoid.innerHTML = "";
    els.recommend.innerHTML = "";
    if (catalog) setStatus("Выберите одно или несколько условий");
    return;
  }
  const filter = els.category.value || null;
  const result = lookupProducts(index, [...selected.keys()], filter);
  renderGroups(els.avoid, result.avoid);
  renderGroups(els.recommend, result.recommend);
  if (!result.avoid.length && !result.recommend.length) {
    setStatus("Нет продуктов для выбранных условий");
  } else {
    setStatus(`Выбрано условий: ${selected.size}`);
  }
}

els.input.addEventListener("input", renderSuggestions);
els.input.addEventListener("focus", renderSuggestions);
els.input.addEventListener("blur", () => {
  // Delay so Prev/Next mousedown can run before blur hides the panel.
  setTimeout(() => {
    if (!els.suggestionPanel.contains(document.activeElement)) {
      hideSuggestionPanel();
    }
  }, 0);
});
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const first = els.suggestions.querySelector("li[data-key]");
    if (first) addCondition(first.dataset.key, first.textContent);
  }
  if (e.key === "Escape") hideSuggestionPanel();
  if (e.key === "ArrowLeft" && e.altKey) {
    e.preventDefault();
    goSuggestionPage(-1);
  }
  if (e.key === "ArrowRight" && e.altKey) {
    e.preventDefault();
    goSuggestionPage(1);
  }
});
els.suggestionPrev.addEventListener("mousedown", (e) => e.preventDefault());
els.suggestionNext.addEventListener("mousedown", (e) => e.preventDefault());
els.suggestionPrev.addEventListener("click", () => goSuggestionPage(-1));
els.suggestionNext.addEventListener("click", () => goSuggestionPage(1));
els.category.addEventListener("change", render);
els.file.addEventListener("change", async () => {
  const file = els.file.files?.[0];
  if (!file) return;
  try {
    applyCatalog(JSON.parse(await file.text()));
  } catch (err) {
    setStatus("Ошибка чтения JSON", true);
    console.error(err);
  }
});

loadDefault();
