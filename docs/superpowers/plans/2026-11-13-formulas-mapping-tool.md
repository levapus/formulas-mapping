# Formulas Mapping Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline HTML+JS lookup tool that maps selected col2/col3 conditions to col1 products (col3/avoid wins), fed by a CSV source of truth imported from `Formulas.doc`.

**Architecture:** Python import script reads Word tables into editable `data/data.csv`; a build step compiles CSV into `data/data.json` (condition catalog + product mappings). Vanilla `web/` page loads JSON, offers typeahead multi-select, merges hits with avoid-over-recommend priority, and groups results by category.

**Tech Stack:** Python 3.12+, pytest, pywin32 (Word COM), vanilla HTML/CSS/JS, Node.js built-in test runner (`node --test`) for lookup logic.

## Global Constraints

- No AI/agent at runtime — deterministic split, normalize, and lookup only
- Col3 / `avoid` always wins over col2 / `recommend` for the same `product` + `category`
- Do not auto-split product (col1) on commas; manual CSV fixes only
- Do not auto-merge semantically similar conditions beyond normalize-key rules; synonyms via `canonical_key` only
- UI copy in Russian; data remains Russian
- Spec: `docs/superpowers/specs/2026-11-13-formulas-mapping-tool-design.md`

---

## File structure

| Path | Responsibility |
|------|----------------|
| `scripts/condition_text.py` | `normalize_key()`, `split_conditions()` |
| `scripts/catalog.py` | Build in-memory catalog / JSON from CSV rows; synonym resolution |
| `scripts/csv_io.py` | Read/write `data.csv` rows |
| `scripts/import_formulas.py` | CLI: Word `.doc` → `data/data.csv` |
| `scripts/build_json.py` | CLI: `data/data.csv` → `data/data.json` |
| `tests/test_condition_text.py` | Normalize + split tests |
| `tests/test_catalog.py` | Dedup, synonyms, JSON shape |
| `tests/fixtures/sample_table.json` | Tiny Word-like table fixture for import unit tests (mocked cells) |
| `tests/fixtures/sample.csv` | Tiny CSV for catalog/build tests |
| `web/lookup.js` | `normalizeKey`, `buildIndex`, `lookupProducts` (browser + Node) |
| `web/app.js` | UI: typeahead, chips, filters, render |
| `web/index.html` | Page shell |
| `web/styles.css` | Minimal layout |
| `tests/js/lookup.test.js` | Node tests for `web/lookup.js` |
| `data/data.csv` | Source of truth (generated + hand-edited) |
| `data/data.json` | Runtime catalog |
| `README.md` | How to import, build, serve, use |

**JSON shape (`data/data.json`):**

```json
{
  "conditions": [
    {
      "key": "луна в напряженном аспекте к марсу",
      "display": "Луна в напряжённом аспекте к Марсу",
      "aliases": ["луна в напряженном аспекте к марсу."],
      "mappings": [
        {"product": "Борщ", "category": "Суп", "polarity": "avoid"}
      ]
    }
  ],
  "categories": ["Напиток", "Суп"]
}
```

---

### Task 1: Scaffold + condition text helpers (normalize & split)

**Files:**
- Create: `scripts/condition_text.py`
- Create: `tests/test_condition_text.py`
- Create: `requirements.txt`
- Create: `pytest.ini` (optional; default pytest is fine)

**Interfaces:**
- Produces:
  - `normalize_key(text: str) -> str`
  - `split_conditions(text: str) -> list[str]`

- [ ] **Step 1: Write failing tests**

Create `tests/test_condition_text.py`:

```python
from scripts.condition_text import normalize_key, split_conditions


def test_normalize_key_yo_case_punctuation_whitespace():
    assert normalize_key("  Уран. ") == normalize_key("уран")
    assert normalize_key("напряжённый") == normalize_key("напряженный")
    assert normalize_key("аспект,") == normalize_key("аспект")
    assert normalize_key("a   b") == normalize_key("a b")


def test_split_numbered_and_newlines():
    text = (
        "1. Луна в гармоничном аспекте к Плутону,\n"
        "2. или Сатурн в квадрате к любой планете"
    )
    parts = split_conditions(text)
    assert len(parts) == 2
    assert parts[0].startswith("Луна")
    assert "Сатурн" in parts[1]


def test_split_skips_empty_and_does_not_comma_split():
    assert split_conditions("") == []
    assert split_conditions("   ") == []
    one = split_conditions("Луна в Близнецах, Стрельце, Рыбах")
    assert len(one) == 1
```

- [ ] **Step 2: Run tests — expect fail**

Run: `python -m pytest tests/test_condition_text.py -v`  
Expected: FAIL (`ModuleNotFoundError` or import error)

- [ ] **Step 3: Implement `scripts/condition_text.py`**

```python
from __future__ import annotations

import re
import unicodedata


_TRAILING_PUNCT = re.compile(r"[\s.,;:!?]+$", re.UNICODE)
_NUMBERED = re.compile(
    r"(?:^|\n)\s*\d+[\.\)]\s*",
    re.UNICODE,
)


def normalize_key(text: str) -> str:
    if not text:
        return ""
    s = unicodedata.normalize("NFKC", text)
    s = s.replace("ё", "е").replace("Ё", "Е")
    s = s.casefold()
    s = re.sub(r"\s+", " ", s, flags=re.UNICODE).strip()
    s = _TRAILING_PUNCT.sub("", s)
    return s


def split_conditions(text: str) -> list[str]:
    if text is None:
        return []
    raw = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return []

    # If numbered markers exist, split on them; else split on newlines only.
    if re.search(r"(?:^|\n)\s*\d+[\.\)]\s*", raw):
        parts = _NUMBERED.split(raw)
    else:
        parts = raw.split("\n")

    out: list[str] = []
    for part in parts:
        piece = part.strip()
        piece = _TRAILING_PUNCT.sub("", piece).strip()
        # Drop leftover leading "или"/"or" noise only if the whole piece is empty after
        if piece:
            out.append(piece)
    return out
```

Add empty `scripts/__init__.py` so imports work, or run pytest with `pythonpath = .` in `pytest.ini`:

```ini
[pytest]
pythonpath = .
```

`requirements.txt`:

```text
pytest>=8.0
pywin32>=306; platform_system=="Windows"
```

- [ ] **Step 4: Run tests — expect pass**

Run: `python -m pytest tests/test_condition_text.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add requirements.txt pytest.ini scripts/__init__.py scripts/condition_text.py tests/test_condition_text.py
git commit -m "feat: add condition normalize and split helpers"
```

---

### Task 2: CSV I/O + catalog build (dedup, synonyms → JSON)

**Files:**
- Create: `scripts/csv_io.py`
- Create: `scripts/catalog.py`
- Create: `scripts/build_json.py`
- Create: `tests/test_catalog.py`
- Create: `tests/fixtures/sample.csv`

**Interfaces:**
- Consumes: `normalize_key` from `scripts.condition_text`
- Produces:
  - `read_csv(path) -> list[dict]`
  - `write_csv(path, rows) -> None`
  - `build_catalog(rows: list[dict]) -> dict` matching JSON shape above
  - CSV columns: `category,product,polarity,condition,condition_key,canonical_key,source_table,source_row`

- [ ] **Step 1: Write fixture + failing tests**

`tests/fixtures/sample.csv`:

```csv
category,product,polarity,condition,condition_key,canonical_key,source_table,source_row
Суп,Борщ,avoid,Луна в напряжённом аспекте к Марсу,,,3,2
Суп,Борщ,recommend,Луна в гармоничном аспекте к Марсу,,,3,2
Суп,Гороховый,avoid,Луна в напряженном аспекте к Марсу.,,,3,3
Напиток,Какао,avoid,Дубликат для синонима,,,1,3
Напиток,Какао,avoid,Alias phrase,,луна в напряженном аспекте к марсу,1,3
```

`tests/test_catalog.py`:

```python
from pathlib import Path

from scripts.catalog import build_catalog
from scripts.csv_io import read_csv


FIXTURE = Path(__file__).parent / "fixtures" / "sample.csv"


def test_build_catalog_dedups_normalize_and_merges_mappings():
    rows = read_csv(FIXTURE)
    catalog = build_catalog(rows)
    conditions = catalog["conditions"]
    # "напряжённом" and "напряженном" + trailing dot → one key
    matches = [c for c in conditions if "напряженном аспекте к марсу" in c["key"]]
    assert len(matches) == 1
    c = matches[0]
    products = {(m["product"], m["polarity"]) for m in c["mappings"]}
    assert ("Борщ", "avoid") in products
    assert ("Гороховый", "avoid") in products


def test_synonym_canonical_key_merges_into_canonical():
    rows = read_csv(FIXTURE)
    catalog = build_catalog(rows)
    by_key = {c["key"]: c for c in catalog["conditions"]}
    # Alias row must not create its own top-level condition for "alias phrase"
    assert "alias phrase" not in by_key
    canon = by_key["луна в напряженном аспекте к марсу"]
    assert any(m["product"] == "Какао" for m in canon["mappings"])
    assert "alias phrase" in [a.casefold() for a in canon.get("aliases", [])] or any(
        "alias" in a.casefold() for a in canon.get("aliases", [])
    )


def test_categories_sorted_unique():
    catalog = build_catalog(read_csv(FIXTURE))
    assert catalog["categories"] == ["Напиток", "Суп"]
```

- [ ] **Step 2: Run tests — expect fail**

Run: `python -m pytest tests/test_catalog.py -v`  
Expected: FAIL (import errors)

- [ ] **Step 3: Implement CSV I/O and catalog**

`scripts/csv_io.py`:

```python
from __future__ import annotations

import csv
from pathlib import Path

FIELDNAMES = [
    "category",
    "product",
    "polarity",
    "condition",
    "condition_key",
    "canonical_key",
    "source_table",
    "source_row",
]


def read_csv(path: str | Path) -> list[dict[str, str]]:
    path = Path(path)
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            rows.append({k: (row.get(k) or "").strip() for k in FIELDNAMES})
        return rows


def write_csv(path: str | Path, rows: list[dict[str, str]]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in FIELDNAMES})
```

`scripts/catalog.py`:

```python
from __future__ import annotations

from scripts.condition_text import normalize_key


def build_catalog(rows: list[dict[str, str]]) -> dict:
    # key -> {display, aliases:set, mappings: list}
    buckets: dict[str, dict] = {}

    for row in rows:
        polarity = row.get("polarity", "").strip()
        if polarity not in ("recommend", "avoid"):
            continue
        product = row.get("product", "").strip()
        category = row.get("category", "").strip()
        condition = row.get("condition", "").strip()
        if not product or not condition:
            continue

        own_key = row.get("condition_key") or normalize_key(condition)
        if not own_key:
            continue

        target_key = row.get("canonical_key") or own_key
        target_key = normalize_key(target_key) if target_key else own_key

        bucket = buckets.setdefault(
            target_key,
            {"key": target_key, "display": condition, "aliases": set(), "mappings": []},
        )

        # Prefer longer/earlier display from non-alias rows
        if not row.get("canonical_key") and condition:
            if len(condition) >= len(bucket["display"]):
                bucket["display"] = condition

        if row.get("canonical_key") and own_key != target_key:
            bucket["aliases"].add(condition)

        mapping = {
            "product": product,
            "category": category,
            "polarity": polarity,
        }
        if mapping not in bucket["mappings"]:
            bucket["mappings"].append(mapping)

    conditions = []
    categories: set[str] = set()
    for key, bucket in sorted(buckets.items(), key=lambda kv: kv[1]["display"].casefold()):
        for m in bucket["mappings"]:
            if m["category"]:
                categories.add(m["category"])
        conditions.append(
            {
                "key": bucket["key"],
                "display": bucket["display"],
                "aliases": sorted(bucket["aliases"]),
                "mappings": bucket["mappings"],
            }
        )

    return {
        "conditions": conditions,
        "categories": sorted(categories, key=lambda s: s.casefold()),
    }
```

`scripts/build_json.py`:

```python
from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.catalog import build_catalog
from scripts.csv_io import read_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Build data.json from data.csv")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path("data/data.csv"),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/data.json"),
    )
    args = parser.parse_args()
    catalog = build_catalog(read_csv(args.csv))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.out} ({len(catalog['conditions'])} conditions)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests — expect pass**

Run: `python -m pytest tests/test_catalog.py -v`  
Expected: PASS  
If synonym assertion is too strict on alias display text, adjust the test to check `normalize_key("Alias phrase")` membership via aliases list content from the fixture.

- [ ] **Step 5: Commit**

```bash
git add scripts/csv_io.py scripts/catalog.py scripts/build_json.py tests/test_catalog.py tests/fixtures/sample.csv
git commit -m "feat: build condition catalog JSON from CSV"
```

---

### Task 3: Pure JS lookup (normalize, index, avoid-wins)

**Files:**
- Create: `web/lookup.js`
- Create: `tests/js/lookup.test.js`
- Create: `package.json` (optional name only; use `node --test`)

**Interfaces:**
- Produces (ES module):
  - `normalizeKey(text: string): string`
  - `buildIndex(catalog): Map<string, ConditionRecord>`
  - `lookupProducts(index, selectedKeys: string[], categoryFilter: string|null): { avoid: Grouped[], recommend: Grouped[] }`
  - Grouped: `{ category: string, products: string[] }`

- [ ] **Step 1: Write failing Node tests**

`tests/js/lookup.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKey, buildIndex, lookupProducts } from "../../web/lookup.js";

test("normalizeKey matches Python rules for yo/case/punct", () => {
  assert.equal(normalizeKey("  Уран. "), normalizeKey("уран"));
  assert.equal(normalizeKey("напряжённый"), normalizeKey("напряженный"));
});

test("avoid wins over recommend for same product+category", () => {
  const catalog = {
    conditions: [
      {
        key: normalizeKey("cond A"),
        display: "cond A",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "recommend" },
        ],
      },
      {
        key: normalizeKey("cond B"),
        display: "cond B",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "avoid" },
        ],
      },
    ],
    categories: ["Суп"],
  };
  const index = buildIndex(catalog);
  const result = lookupProducts(
    index,
    [normalizeKey("cond A"), normalizeKey("cond B")],
    null,
  );
  assert.deepEqual(result.recommend, []);
  assert.equal(result.avoid.length, 1);
  assert.deepEqual(result.avoid[0], { category: "Суп", products: ["Борщ"] });
});

test("category filter narrows results only", () => {
  const catalog = {
    conditions: [
      {
        key: "k1",
        display: "k1",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "avoid" },
          { product: "Какао", category: "Напиток", polarity: "avoid" },
        ],
      },
    ],
    categories: ["Напиток", "Суп"],
  };
  const result = lookupProducts(buildIndex(catalog), ["k1"], "Суп");
  assert.deepEqual(result.avoid, [{ category: "Суп", products: ["Борщ"] }]);
  assert.deepEqual(result.recommend, []);
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `node --test tests/js/lookup.test.js`  
Expected: FAIL (cannot find module)

- [ ] **Step 3: Implement `web/lookup.js`**

```js
export function normalizeKey(text) {
  if (!text) return "";
  let s = text.normalize("NFKC");
  s = s.replaceAll("ё", "е").replaceAll("Ё", "Е");
  s = s.toLocaleLowerCase("ru-RU");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[\s.,;:!?]+$/u, "");
  return s;
}

export function buildIndex(catalog) {
  const map = new Map();
  for (const cond of catalog.conditions || []) {
    map.set(cond.key, cond);
    for (const alias of cond.aliases || []) {
      const ak = normalizeKey(alias);
      if (ak && !map.has(ak)) map.set(ak, cond);
    }
  }
  return map;
}

function groupByCategory(items) {
  const byCat = new Map();
  for (const { category, product } of items) {
    if (!byCat.has(category)) byCat.set(category, []);
    const list = byCat.get(category);
    if (!list.includes(product)) list.push(product);
  }
  return [...byCat.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([category, products]) => ({
      category,
      products: products.sort((a, b) => a.localeCompare(b, "ru")),
    }));
}

export function lookupProducts(index, selectedKeys, categoryFilter) {
  /** @type {Map<string, "recommend"|"avoid">} */
  const best = new Map(); // `${category}\0${product}` -> polarity

  for (const key of selectedKeys) {
    const cond = index.get(key);
    if (!cond) continue;
    for (const m of cond.mappings) {
      if (categoryFilter && m.category !== categoryFilter) continue;
      const id = `${m.category}\0${m.product}`;
      const prev = best.get(id);
      if (m.polarity === "avoid" || !prev) {
        best.set(id, m.polarity === "avoid" ? "avoid" : "recommend");
      } else if (prev === "recommend" && m.polarity === "avoid") {
        best.set(id, "avoid");
      }
      // if prev avoid, stay avoid
      if (prev === "avoid") best.set(id, "avoid");
    }
  }

  const avoid = [];
  const recommend = [];
  for (const [id, polarity] of best) {
    const [category, product] = id.split("\0");
    (polarity === "avoid" ? avoid : recommend).push({ category, product });
  }
  return {
    avoid: groupByCategory(avoid),
    recommend: groupByCategory(recommend),
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `node --test tests/js/lookup.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/lookup.js tests/js/lookup.test.js
git commit -m "feat: add JS lookup with avoid-over-recommend priority"
```

---

### Task 4: Word import → CSV

**Files:**
- Create: `scripts/import_formulas.py`
- Create: `tests/test_import_rows.py`
- Modify: none of Word in unit tests — test pure `rows_from_tables()` helper

**Interfaces:**
- Consumes: `split_conditions`, `normalize_key`, `write_csv`
- Produces:
  - `rows_from_tables(tables: list[list[list[str]]]) -> list[dict]`
  - CLI `python -m scripts.import_formulas --doc Formulas.doc --out data/data.csv`

- [ ] **Step 1: Write failing tests for table→rows (no Word)**

```python
from scripts.import_formulas import rows_from_tables


def test_rows_from_tables_skips_header_and_empty_col3():
    tables = [
        [
            ["Суп", "Рекомендуется", "Не рекомендуется"],
            [
                "Борщ",
                "Луна в гармоничном аспекте к Марсу",
                "Луна в напряжённом аспекте к Марсу",
            ],
            [
                "Кисель",
                "1. Если Луна в Козероге\n2. Если Марс в Раке",
                "",
            ],
        ]
    ]
    rows = rows_from_tables(tables)
    assert any(r["product"] == "Борщ" and r["polarity"] == "recommend" for r in rows)
    assert any(r["product"] == "Борщ" and r["polarity"] == "avoid" for r in rows)
    kisel = [r for r in rows if r["product"] == "Кисель"]
    assert len(kisel) == 2
    assert all(r["polarity"] == "recommend" for r in kisel)
    assert all(r["category"] == "Суп" for r in rows)
```

- [ ] **Step 2: Run — expect fail**

Run: `python -m pytest tests/test_import_rows.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement import module**

`scripts/import_formulas.py`:

```python
from __future__ import annotations

import argparse
from pathlib import Path

from scripts.condition_text import normalize_key, split_conditions
from scripts.csv_io import write_csv


def rows_from_tables(tables: list[list[list[str]]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for table_index, table in enumerate(tables, start=1):
        if not table:
            continue
        header = table[0]
        category = (header[0] if header else "").strip() or f"table-{table_index}"
        for row_index, row in enumerate(table[1:], start=2):
            while len(row) < 3:
                row.append("")
            product = (row[0] or "").strip()
            if not product:
                continue
            for polarity, cell in (("recommend", row[1]), ("avoid", row[2])):
                for piece in split_conditions(cell or ""):
                    rows.append(
                        {
                            "category": category,
                            "product": product,
                            "polarity": polarity,
                            "condition": piece,
                            "condition_key": normalize_key(piece),
                            "canonical_key": "",
                            "source_table": str(table_index),
                            "source_row": str(row_index),
                        }
                    )
    return rows


def extract_tables_via_word(doc_path: Path) -> list[list[list[str]]]:
    import win32com.client  # Windows + Word required

    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    tables: list[list[list[str]]] = []
    try:
        doc = word.Documents.Open(str(doc_path.resolve()), ReadOnly=True)
        try:
            for table in doc.Tables:
                rows = []
                for ri in range(1, table.Rows.Count + 1):
                    cols = []
                    for ci in range(1, min(table.Columns.Count, 3) + 1):
                        text = table.Cell(ri, ci).Range.Text
                        text = (
                            text.replace("\r\x07", "")
                            .replace("\x07", "")
                            .replace("\r", "\n")
                            .strip()
                        )
                        cols.append(text)
                    rows.append(cols)
                tables.append(rows)
        finally:
            doc.Close(False)
    finally:
        word.Quit()
    return tables


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--doc", type=Path, default=Path("Formulas.doc"))
    parser.add_argument("--out", type=Path, default=Path("data/data.csv"))
    args = parser.parse_args()
    if not args.doc.exists():
        raise SystemExit(f"Missing doc: {args.doc}")
    tables = extract_tables_via_word(args.doc)
    rows = rows_from_tables(tables)
    write_csv(args.out, rows)
    print(f"Wrote {args.out} ({len(rows)} rows from {len(tables)} tables)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run unit tests — pass; smoke Word import**

Run: `python -m pytest tests/test_import_rows.py -v`  
Expected: PASS

Run (Windows + Word installed):  
`python -m scripts.import_formulas --doc Formulas.doc --out data/data.csv`  
Expected: CSV created; row count ≫ 357 (many split conditions). Spot-check Борщ / Какао.

Then: `python -m scripts.build_json`  
Expected: `data/data.json` written.

- [ ] **Step 5: Commit**

```bash
git add scripts/import_formulas.py tests/test_import_rows.py data/data.csv data/data.json
git commit -m "feat: import Formulas.doc tables into CSV and JSON"
```

Note: If `Formulas.doc` should stay untracked, still commit generated `data/data.csv` and `data/data.json` so the web app works without Word.

---

### Task 5: HTML UI (typeahead, chips, results)

**Files:**
- Create: `web/index.html`
- Create: `web/styles.css`
- Create: `web/app.js`

**Interfaces:**
- Consumes: `../data/data.json` (serve from repo root) OR relative `./data.json` copy — **serve repo root** so paths are `/web/index.html` + `/data/data.json`
- Consumes: `lookup.js` functions

- [ ] **Step 1: Create `web/index.html`**

```html
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Формулы — подбор продуктов</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>Подбор продуктов по условиям</h1>
      <p class="hint">Введите условие и выберите из списка. Колонка «не рекомендуется» имеет приоритет.</p>

      <label class="block">
        Категория
        <select id="categoryFilter">
          <option value="">Все</option>
        </select>
      </label>

      <label class="block">
        Условие
        <input id="conditionInput" type="search" autocomplete="off" placeholder="Начните вводить…" />
      </label>
      <ul id="suggestions" class="suggestions" hidden></ul>
      <div id="chips" class="chips"></div>

      <p id="status" class="status"></p>

      <section>
        <h2>Не рекомендуется</h2>
        <div id="avoidResults"></div>
      </section>
      <section>
        <h2>Рекомендуется</h2>
        <div id="recommendResults"></div>
      </section>

      <label class="block">
        Загрузить data.json
        <input id="fileInput" type="file" accept="application/json,.json" />
      </label>
    </main>
    <script type="module" src="app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create minimal `web/styles.css`**

```css
:root {
  --bg: #f7f4ef;
  --ink: #1c1a17;
  --muted: #5c574f;
  --line: #d9d2c5;
  --avoid: #7a1f1f;
  --ok: #1f5c3a;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Segoe UI", "Helvetica Neue", sans-serif;
  background: linear-gradient(180deg, #efe8dc, var(--bg));
  color: var(--ink);
}
main { max-width: 52rem; margin: 0 auto; padding: 1.5rem; }
.hint, .status { color: var(--muted); }
.block { display: block; margin: 0.75rem 0; }
input, select {
  display: block; width: 100%; margin-top: 0.35rem;
  padding: 0.55rem 0.65rem; border: 1px solid var(--line); border-radius: 6px;
}
.suggestions {
  list-style: none; margin: 0; padding: 0; border: 1px solid var(--line);
  background: #fff; max-height: 14rem; overflow: auto;
}
.suggestions li { padding: 0.45rem 0.65rem; cursor: pointer; }
.suggestions li:hover, .suggestions li.active { background: #f0ebe3; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0; }
.chip {
  background: #fff; border: 1px solid var(--line); border-radius: 999px;
  padding: 0.25rem 0.6rem; display: inline-flex; gap: 0.35rem; align-items: center;
}
.chip button { border: 0; background: transparent; cursor: pointer; }
.group { margin: 0.5rem 0 1rem; }
.group h3 { margin: 0 0 0.35rem; font-size: 1rem; }
#avoidResults h3 { color: var(--avoid); }
#recommendResults h3 { color: var(--ok); }
.error { color: var(--avoid); }
```

- [ ] **Step 3: Implement `web/app.js`**

```js
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
    await applyCatalog(await res.json());
  } catch (err) {
    setStatus(
      "Не удалось загрузить data.json. Откройте страницу через локальный сервер из корня репозитория или выберите файл вручную.",
      true,
    );
    console.error(err);
  }
}

async function applyCatalog(data) {
  catalog = data;
  index = buildIndex(catalog);
  els.category.innerHTML = `<option value="">Все</option>`;
  for (const c of catalog.categories || []) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    els.category.appendChild(opt);
  }
  setStatus(`Загружено условий: ${catalog.conditions.length}`);
  render();
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
    await applyCatalog(JSON.parse(await file.text()));
  } catch (err) {
    setStatus("Ошибка чтения JSON", true);
    console.error(err);
  }
});

loadDefault();
```

- [ ] **Step 4: Manual UI check**

From repo root:

```bash
python -m http.server 8080
```

Open `http://localhost:8080/web/`  
Expected: conditions load; typeahead filters; chips add/remove; avoid listed above recommend; conflict product only under avoid; category filter works; broken file shows error.

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/styles.css web/app.js
git commit -m "feat: add typeahead UI for condition-to-product lookup"
```

---

### Task 6: README + final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# Formulas mapping tool

Offline lookup: select astrological/dietary **conditions** (col2/col3) → get **products** (col1).  
If a product is both recommended and not recommended, **not recommended wins**.

## Requirements

- Windows + Microsoft Word (only for importing `Formulas.doc`)
- Python 3.12+ (`pip install -r requirements.txt`)
- Node.js 18+ (for `node --test`)
- Any modern browser

## Update data

Full refresh from Word:

```bash
python -m scripts.import_formulas --doc Formulas.doc --out data/data.csv
python -m scripts.build_json
```

Small fixes: edit `data/data.csv` (splits, `canonical_key` synonyms, product names), then `python -m scripts.build_json`.

## Run UI

```bash
python -m http.server 8080
```

Open http://localhost:8080/web/

## Tests

```bash
python -m pytest -v
node --test tests/js/lookup.test.js
```
```

- [ ] **Step 2: Run full test suite**

```bash
python -m pytest -v
node --test tests/js/lookup.test.js
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README for import, build, and UI usage"
```

---

## Spec coverage checklist (plan self-review)

| Spec requirement | Task |
|------------------|------|
| Input col2/col3 → output col1 | 3, 5 |
| Col3 priority | 3, 5 |
| Typeahead = C+B mix, multi-select | 5 |
| Categories kept; all groups; optional filter | 2, 4, 5 |
| CSV source + Word import + manual fixes | 2, 4, 6 |
| Normalize dedup + manual synonyms | 1, 2 |
| No auto-split products on commas | 4 |
| Split numbered/newlines only | 1, 4 |
| Offline HTML, no AI | 5 |
| Tests for import/lookup/normalize | 1–4, 6 |
| file:// / local server note | 5, 6 |

No TBD placeholders. Function names aligned across tasks: `normalize_key` / `normalizeKey`, `build_catalog`, `buildIndex`, `lookupProducts`, `rows_from_tables`.
