# Formulas mapping tool — User guide (English)

Offline tool: pick astrological / dietary **conditions** and see which **products** are recommended, not recommended, or neutral.

- [What is this?](#what-is-this)
- [How to install](#how-to-install)
- [How to run](#how-to-run)
  - [With a local server (Python)](#with-a-local-server-python)
  - [Without Python / without a server](#without-python--without-a-server)
- [Workflow: Word → CSV → JSON](#workflow-word--csv--json)
- [How to import from Word](#how-to-import-from-word)
- [Edit CSV and rebuild JSON](#edit-csv-and-rebuild-json)
  - [Add a mapping](#add-a-mapping)
  - [Edit / update a row](#edit--update-a-row)
  - [Delete a row](#delete-a-row)
  - [Transform CSV → JSON](#transform-csv--json)
- [CSV format](#csv-format)
- [UI overview](#ui-overview)
- [Tests](#tests)
- [Known quirks](#known-quirks)

---

## What is this?

The source document `Formulas.doc` contains tables of products and conditions:

| Word column | Meaning in the app |
|-------------|--------------------|
| Column 1 | Product name |
| Column 2 | Conditions when the product is **recommended** |
| Column 3 | Conditions when the product is **not recommended** (avoid) |

The tool turns those tables into searchable data and a browser UI:

1. Select a **category** (optional).
2. Pick conditions under **Рекомендуется** (green) and/or **Не рекомендуется** (red).
3. See a results table with checkboxes for recommend / avoid / neutral.
4. Optionally export the visible table as Excel (`.xlsx`).

Rules:

- If a product is both recommended and avoided for the selected conditions, **avoid wins**.
- No AI and no required network for normal use: static HTML/JS + `data/data.json`.

Related files:

| Path | Role |
|------|------|
| `Formulas.doc` | Optional Word source (keep your own copy to re-import) |
| `data/data.csv` | Editable source of truth |
| `data/data.json` | Generated catalog for the UI (**do not hand-edit**) |
| `web/` | Static UI |
| `scripts/` | Import, CSV I/O, catalog build |

---

## How to install

**Requirements**

| Need | For |
|------|-----|
| Python 3.12+ | Import, JSON build, pytest |
| Windows + Microsoft Word | **Only** for importing `Formulas.doc` (`pywin32` / COM) |
| Node.js 18+ | Optional: JS unit tests |
| Modern browser | UI |

From the repository root:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

`requirements.txt` installs `pytest` and (on Windows only) `pywin32`.

Without Word you can still edit the CSV, build JSON, run the UI, and run tests.

---

## How to run

All commands below are run **from the repository root**.

### With a local server (Python)

```bash
python -m http.server 8080
```

Open [http://localhost:8080/web/](http://localhost:8080/web/).

The page auto-loads `../data/data.json`. Start the server from the **repo root**, not from `web/`.

### Without Python / without a server

1. Double-click `web/index.html` (or open it in the browser).
2. In the left pane, use **Загрузить данные** and choose `data/data.json`.

Browsers block automatic `fetch` on `file://`, so the manual file picker is required. After a successful load, the status line shows how many conditions/products were loaded and the category list fills in.

You can also use any other static file server (Node `npx serve`, IIS, nginx, etc.) pointed at the repo root, then open `/web/`.

---

## Workflow: Word → CSV → JSON

```text
Formulas.doc  ──(import_formulas)──►  data/data.csv  ──(build_json)──►  data/data.json  ──►  web UI
     Word COM                         editable rows                    catalog for UI
```

1. **Word (`Formulas.doc`)**  
   Tables: first header cell = category; each data row = product + recommend text + avoid text.

2. **Import (`python -m scripts.import_formulas`)**  
   Reads tables via Word COM, splits condition cells, writes one CSV row per product–condition–polarity mapping into `data/data.csv`.

3. **Build (`python -m scripts.build_json`)**  
   Reads the CSV, normalizes keys, merges synonyms (`canonical_key`), deduplicates mappings, writes `data/data.json`.

4. **UI (`web/`)**  
   Loads the JSON, lets you filter by category and conditions, shows the product table, exports Excel.

Day-to-day edits usually skip Word: change the CSV, then run `build_json` only.

---

## How to import from Word

Requires **Windows + Microsoft Word**. Word is started invisibly; the document is opened read-only.

```bash
python -m scripts.import_formulas --doc Formulas.doc --out data/data.csv
python -m scripts.build_json
```

- `--doc` defaults to `Formulas.doc`, `--out` defaults to `data/data.csv`.
- Import **overwrites** `data/data.csv` completely.
- Then `build_json` writes `data/data.json` and prints the number of conditions.
- Commit both `data/data.csv` and `data/data.json` after a successful refresh.

How cells are split:

- Condition cells split **only** on numbered markers (`1.`, `2)`) or, if there are none, on line breaks.
- Commas are **never** used to split.
- Product names are never auto-split.

**Full Word refresh checklist**

1. Back up manual CSV work (`copy data\data.csv data\data.backup.csv` or use git).
2. Run import + `build_json`.
3. Review `git diff data/data.csv`.
4. Re-apply anything lost: `canonical_key` synonyms, manual product splits, deleted junk rows.

`canonical_key` is blank on freshly imported rows. To restore synonyms: match rows by `condition_key` and paste the previous `canonical_key` values back, then run `build_json` again.

---

## Edit CSV and rebuild JSON

Edit `data/data.csv` in Excel, LibreOffice, or a text editor. Save as **UTF-8** (the file uses a BOM; Python reads it with `utf-8-sig`).

### Add a mapping

Add a new row with at least:

- `category`, `product`, `polarity` (`recommend` or `avoid`), `condition`

You may leave `condition_key` empty (it is recomputed when blank). Leave `canonical_key` empty unless this row is a synonym of another condition. `source_table` / `source_row` are optional traceability fields.

### Edit / update a row

- Fix typos in `product`, `category`, or `condition`.
- Optionally clear `condition_key` so it is recomputed from the new `condition` text.
- **Merge synonyms:** on the variant row, set `canonical_key` to the **normalized key of the main condition** (usually copy the main row’s `condition_key`). The variant text becomes a searchable alias in the UI. Leave `canonical_key` blank on the main row.
- **Split a product:** duplicate the row(s) and change `product` on each copy.
- **Split a multi-condition cell:** replace one row with several rows, one condition each.

### Delete a row

Delete the CSV line. Rows with empty `product` or `condition`, or a `polarity` other than `recommend` / `avoid`, are ignored by the builder.

### Transform CSV → JSON

After any CSV change:

```bash
python -m scripts.build_json
```

Optional paths:

```bash
python -m scripts.build_json --csv data/data.csv --out data/data.json
```

Reload the UI (or use **Загрузить данные** again) to pick up the new JSON.

---

## CSV format

One row = one mapping: product + category + polarity + one condition.

| Column | Required | Meaning |
|--------|----------|---------|
| `category` | yes | Table header from Word (e.g. `Напиток`, `Суп`, `Орех`) |
| `product` | yes | Product name (Word column 1) |
| `polarity` | yes | `recommend` (Word col 2) or `avoid` (Word col 3) |
| `condition` | yes | Condition text as shown in the UI |
| `condition_key` | no | Normalized identity of `condition`; recomputed if blank |
| `canonical_key` | no | If set, this row is a synonym of the condition with that key |
| `source_table` | no | 1-based Word table number |
| `source_row` | no | 1-based Word row number |

**Normalization** (for keys): Unicode NFKC, casefold, `ё`→`е`, collapse whitespace, strip trailing punctuation.

**Builder behavior:**

- Same normalized `condition_key` → one condition in JSON (aliases merged).
- Identical product / category / polarity mappings are deduplicated.
- UI search matches condition display text, key, and aliases.

Example (header + two rows):

```csv
category,product,polarity,condition,condition_key,canonical_key,source_table,source_row
Суп,Борщ,avoid,Луна в напряжённом аспекте к Марсу,,,3,2
Суп,Борщ,recommend,Луна в гармоничном аспекте к Марсу,,,3,2
```

---

## UI overview

Left pane:

- **Данные** — defaults to `data/data.json` (auto-load with a local server; **Загрузить по умолчанию** reloads it). Use **Другой файл (не по умолчанию)** only to pick a non-default JSON (required on `file://`).
- **Таблица** — *Все продукты* vs *Только совпадения*
- **Сохранить результаты (Excel)** — download the visible table as `.xlsx`

Main pane:

- Category filter
- Two condition pickers: **Рекомендуется** / **Не рекомендуется** (search, optional mic in Chrome, paging)
- Results table with colored checkboxes
- Status line with counts

---

## Tests

```bash
python -m pytest -v
node --test tests/js/lookup.test.js
```

Run both before committing data or script changes.

---

## Known quirks

- **`Продукт` vs `продукт`:** two spellings in Word become two categories; unify in CSV and rebuild (re-import brings the split back).
- **Placeholder `Нет`:** imported as a real condition; delete those CSV rows if they are noise.
- **Inline numbering** (e.g. `Если …, 2. Если …` mid-line) is not auto-split; fix in CSV.
- **`file://`:** use **Загрузить данные**.
- **Re-import overwrites** all manual CSV edits.
- `Formulas.doc` may be untracked; `_formulas_*` extracts are gitignored.
