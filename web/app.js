import { buildIndex, lookupProducts, normalizeKey } from "./lookup.js";

const els = {
  input: document.getElementById("conditionInput"),
  suggestions: document.getElementById("suggestions"),
  chips: document.getElementById("chips"),
  category: document.getElementById("categoryFilter"),
  status: document.getElementById("status"),
  avoid: document.getElementById("avoidResults"),
  recommend: document.getElementById("recommendResults"),
  file: document.getElementById("fileInput"),
};

/** @type {any} */
let catalog = null;
/** @type {Map<string, any>} */
let index = new Map();
/** @type {Map<string, string>} key -> display */
const selected = new Map();

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

async function loadDefault() {
  try {
    const res = await fetch("../data/data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applyCatalog(await res.json());
  } catch (err) {
    setStatus(
      "Не удалось загрузить data.json. Откройте страницу через локальный сервер из корня репозитория (python -m http.server 8080) или выберите файл вручную.",
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
  return catalog.conditions
    .filter((c) => {
      if (selected.has(c.key)) return false;
      if (!q) return true;
      if (c.key.includes(q)) return true;
      if (normalizeKey(c.display).includes(q)) return true;
      return (c.aliases || []).some((a) => normalizeKey(a).includes(q));
    })
    .slice(0, 30);
}

function renderSuggestions() {
  const items = filteredSuggestions(els.input.value);
  els.suggestions.innerHTML = "";
  if (!items.length || document.activeElement !== els.input) {
    els.suggestions.hidden = true;
    return;
  }
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
  els.suggestions.hidden = false;
}

function addCondition(key, display) {
  selected.set(key, display);
  els.input.value = "";
  els.suggestions.hidden = true;
  render();
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

function render() {
  renderChips();
  renderSuggestions();
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
  els.suggestions.hidden = true;
});
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const first = els.suggestions.querySelector("li");
    if (first) addCondition(first.dataset.key, first.textContent);
  }
  if (e.key === "Escape") els.suggestions.hidden = true;
});
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
