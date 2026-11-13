# Formulas mapping tool — design

Date: 2026-11-13  
Status: approved for implementation planning  
Source: `Formulas.doc` (Word `.doc`, 12 three-column tables)

## Goal

Build a simple, offline lookup tool with **no AI/agent at runtime**.

- **Input:** one or more conditions from column 2 (Рекомендуется) and/or column 3 (Не рекомендуется)
- **Output:** matching products from column 1, grouped by category
- **Priority:** if the same product is matched as both recommended (col2) and not recommended (col3), **col3 wins** — the product is **not recommended**

## Non-goals

- AI / LLM parsing or semantic matching at runtime
- User accounts, cloud sync, multi-user editing
- In-browser editing of the database (edits happen in CSV)
- Selenium/CI-heavy automation for v1

## Chosen approach

**HTML + JavaScript UI** with a **CSV source of truth** and optional JSON for the browser.

| Piece | Role |
|-------|------|
| `Formulas.doc` | Original Word source |
| Import script (Python) | Parse Word tables → CSV |
| `data.csv` | Editable source of truth |
| `data.json` | Runtime catalog for the page (generated from CSV) |
| `index.html` + `app.js` | Typeahead multi-select UI; offline-friendly |

Rationale: best UX for searchable multi-select; CSV is easy to fix by hand; ~350 rows do not need SQLite.

## Architecture

```
Formulas.doc
    ↓  import script (Python + Word COM)
data.csv          ← human-editable source of truth
    ↓  build step (or equivalent)
data.json         ← browser catalog
    ↓
index.html + app.js
```

Runtime model: inverted index

`condition → [{ product, category, polarity: recommend | avoid }]`

Multi-select conditions → merge hits → conflict rule (avoid wins) → render.

## Data model

### CSV columns (one row per atomic condition mapping)

| Column | Meaning |
|--------|---------|
| `category` | Table group (`Напиток`, `Суп`, `Овощ`, …) |
| `product` | Column 1 text **as-is** (no automatic comma-split) |
| `polarity` | `recommend` (from col2) or `avoid` (from col3) |
| `condition` | One split piece of col2/col3 (display text) |
| `condition_key` | Normalized identity key (see Dedup) |
| `canonical_key` | Optional; if set, this row is an alias of another condition |
| `source_table` | Optional trace (Word table index) |
| `source_row` | Optional trace (row within table) |

### Product groups / categories

Preserve the 12 Word table groups as `category` on every row.

- Lookup searches **all** categories by default
- Results are **grouped by category**
- Optional UI filter narrows results by category (does not change the conflict rule)

### Column 1 (products)

Do **not** auto-split on commas (`Виски, бренди` vs `Вино сухое, сладкое белое` is ambiguous).  
Keep one product string; allow **manual splits** in CSV after import when needed.

## Import rules

Deterministic, no AI.

### Table parsing

1. Open `Formulas.doc` via Word automation (or equivalent table extract)
2. For each of the 12 tables: read 3 columns; treat row 1 as header; use header col1 label as default `category` when sensible
3. Skip empty condition cells

### Splitting col2 / col3 into atomic conditions

1. Split on numbered markers (`1.` `2.` `1)` …) and newlines
2. Trim whitespace; drop empty pieces
3. Do **not** auto-split on commas inside a piece
4. Emit one CSV row per `(category, product, polarity, condition)`

### Dedup and “same meaning, different form”

Avoid duplicate dropdown entries when values differ only in form:

1. Keep **display** `condition` (cleaned original)
2. Compute `condition_key`:
   - Unicode normalize
   - trim; collapse internal whitespace
   - `ё` → `е`
   - lowercase
   - strip trailing punctuation (`.` `,` `;`)
3. Same `condition_key` → one catalog entry; merge product mappings
4. Do **not** auto-merge unrelated rephrasings that only “feel” similar
5. Support optional **manual synonyms**: set `canonical_key` (or equivalent alias column) in CSV so known rephrasings point at one canonical condition

### Full refresh vs small fixes

- **Bulk:** re-run import script when Word source changes substantially
- **Small fixes:** edit CSV (splits, synonyms, product names, categories), regenerate JSON

## Conflict / priority rule

For a given selection of conditions:

1. Collect all product hits (with category + polarity)
2. If the same `product` + `category` appears as both `recommend` and `avoid` → keep **avoid** only
3. Present under **Не рекомендуется**, not under **Рекомендуется**

## UI

Single page; Russian labels are appropriate (source data is Russian).

1. **Condition picker** — typeahead combobox: typing filters known conditions (substring on display text); Enter/click adds a chip; multi-select; chips removable
2. **Optional category filter** — All / per-category; filters results only
3. **Results** — two blocks, each grouped by category:
   - **Не рекомендуется** — col3 hits and recommend+avoid conflicts
   - **Рекомендуется** — col2-only hits
4. Empty selection → Russian prompt to select conditions
5. No hits → Russian “no products” message
6. Data load: bundled `data.json`, and/or file picker for an updated JSON/CSV
7. Load failure → clear on-page error (no silent empty catalog)
8. If the browser blocks loading data via `file://`, open via a tiny local static server (documented in README)

No backend, no AI.

## Error handling summary

| Case | Behavior |
|------|----------|
| Empty col2/col3 | Skip |
| Only one polarity | Normal listing |
| Recommend + avoid for same product | Avoid wins |
| Normalize duplicates | One catalog entry |
| Synonym rows | Resolve to canonical |
| Bad/missing data file | On-page error |
| Word import failure | Script error with clear message |

## Testing

### Import

- Fixture covering numbered lists, empty col3, `ё`/case duplicates, synonym alias
- Smoke import of real `Formulas.doc`; spot-check known rows; sanity-check scale (~357 data rows across tables)

### Lookup (pure JS)

- Single condition → expected products
- Multi-condition with recommend+avoid on same product → avoid only
- Normalize key equality (`Уран.` vs `уран`)
- Category filter does not break priority

### Manual UI

- Typeahead filter; add/remove chips; grouped results; broken file error

## Project layout (planned)

```
mapping/
  Formulas.doc
  scripts/import_formulas.py
  data/data.csv
  data/data.json
  web/index.html
  web/app.js
  docs/superpowers/specs/2026-11-13-formulas-mapping-tool-design.md
```

Exact paths may be adjusted in the implementation plan; responsibilities stay the same.

## Success criteria

- User can multi-select conditions via typeahead and see products without any AI
- Col3 priority is visible and correct on conflicts
- Categories preserved and used for grouping/optional filter
- Re-import from Word plus manual CSV fixes are both viable update paths
- Duplicate conditions that differ only by trivial form are not duplicated in the dropdown
