# Formulas mapping tool

Offline lookup tool: select astrological / dietary **conditions** (columns 2 and 3 of the tables in `Formulas.doc`) and get the matching **products** (column 1).

- Column 2 = conditions where the product is **recommended**.
- Column 3 = conditions where the product is **not recommended** (avoid).
- If a product is both recommended and not recommended for the selected conditions, **avoid wins** (it is not shown as recommended).
- No AI, no network: the UI is static HTML/JS reading `data/data.json`.

## Requirements

| Need | For |
|------|-----|
| Windows + Microsoft Word | **Only** for importing `Formulas.doc` (`pywin32` drives Word via COM) |
| Python 3.12+ | import, JSON build, pytest |
| Node.js 18+ | `node --test` (JS lookup tests; root `package.json` sets `"type": "module"` for ESM) |
| Any modern browser | running the UI |

Without Word you can still build the JSON from the CSV, run the UI and run all tests.

## Project layout

```text
Formulas.doc          Source Word document (optional; may be untracked, see note below)
scripts/              Python: import_formulas, build_json, catalog, csv_io, condition_text
data/data.csv         Editable source of truth (one row per product + condition)
data/data.json        Generated catalog consumed by the UI (do not hand-edit)
web/                  Static UI: index.html, app.js, lookup.js, styles.css
tests/                pytest tests (tests/*.py) and JS tests (tests/js/)
docs/superpowers/     Design spec and implementation plan
```

> **Note:** `Formulas.doc` is not force-added to git. Keep your own copy in the repo root when you want to re-import; otherwise pass `--doc <path>`.

## First-time setup

```bash
python -m venv .venv            # optional
.venv\Scripts\activate          # optional (Windows)
pip install -r requirements.txt
```

`requirements.txt` installs `pytest` and (on Windows only) `pywin32`.

All commands below are run **from the repository root**.

## Import from Formulas.doc

Requires Windows + Word installed. Word is started invisibly and the document is opened read-only.

```bash
python -m scripts.import_formulas --doc Formulas.doc --out data/data.csv
python -m scripts.build_json
```

- `--doc` defaults to `Formulas.doc`, `--out` defaults to `data/data.csv`.
- The first command overwrites `data/data.csv` and prints `Wrote data/data.csv (N rows from M tables)`.
- The second reads `data/data.csv` and writes `data/data.json` (`--csv` / `--out` override the paths) and prints the number of conditions.
- Commit both `data/data.csv` and `data/data.json` afterwards.

How import works: each Word table's first header cell becomes the **category**; each following row has product (col 1), recommend conditions (col 2), avoid conditions (col 3). Condition cells are split **only** on numbered markers (`1.`, `2)`) or, if there are none, on line breaks. Commas are **never** used to split, and products are never auto-split.

## Updating data

### A. Full Word refresh (re-import)

Use when `Formulas.doc` changed substantially.

1. Back up manual work first: `copy data\data.csv data\data.backup.csv` (or rely on git).
2. Re-import and rebuild:
   ```bash
   python -m scripts.import_formulas --doc Formulas.doc --out data/data.csv
   python -m scripts.build_json
   ```
3. Review `git diff data/data.csv`.

**Warning: re-import overwrites `data/data.csv` completely.** Every manual edit is lost, including:

- corrected / split product names or conditions,
- `canonical_key` synonym mappings,
- removed junk rows.

`canonical_key` is blank on freshly imported rows, so synonyms are **not** preserved automatically. To keep them:

1. Before re-importing, save the rows that have a non-empty `canonical_key` (e.g. `git diff`, or the backup copy).
2. After re-importing, re-apply them: find the matching rows by `condition_key` (the normalized text) and paste the same `canonical_key` value back in. Rows whose Word text did not change keep the same `condition_key`, so matching is straightforward.
3. Re-apply manual product splits/renames, then run `python -m scripts.build_json`.

Tip: if you want to keep manual work, prefer merging the new import into the old CSV with your diff tool (`git add -p`) rather than accepting the whole file.

### B. Small CSV fixes (no Word needed)

Edit `data/data.csv` in Excel / LibreOffice / a text editor (save as **UTF-8**; the file is written with a BOM and read with `utf-8-sig`, both work), then rebuild only the JSON:

```bash
python -m scripts.build_json
```

Common edits:

- **Fix a typo / wording** in `product`, `category` or `condition`. Optionally clear `condition_key` (it is recomputed when empty).
- **Merge synonyms (different wording, same condition):** put the *normalized key of the main condition* in `canonical_key` of the variant row. Example: the row with `condition = Напряженный аспект Луны с Ураном` and `canonical_key = напряженный аспект луны с ураном` is merged into the main condition; its text becomes an alias searchable in the UI. Leave `canonical_key` empty for the main row. The key is normalized (casefold, `ё`→`е`, NFKC, whitespace collapsed, trailing punctuation dropped), so copy it from the main row's `condition_key` column.
- **Split a product manually:** duplicate the row(s), set a different `product` on each copy (the tool never splits product names automatically).
- **Split a multi-condition cell manually:** replace the single row with several rows, one condition each.
- **Delete a row** to drop a mapping. Rows with an empty `product` or `condition`, or a `polarity` other than `recommend` / `avoid`, are ignored.

## Run the UI

```bash
python -m http.server 8080
```

Open <http://localhost:8080/web/>. Start the server **from the repository root** (the page loads `../data/data.json`).

Type to search conditions (typeahead matches display text and aliases), pick several conditions, optionally filter by category. The suggestion list shows 30 matches per page with **Назад** / **Вперёд** pagination. Products recommended and not recommended are shown separately; avoid takes priority over recommend.

**Without a server:** double-click `web/index.html`, then click **Загрузить data.json** and choose `data/data.json`. After a successful load the status line shows `Загружено условий: …` and the category list fills in. (Browsers block auto-`fetch` on `file://`, so the manual picker is required.)

## Tests

```bash
python -m pytest -v
node --test tests/js/lookup.test.js
```

Run both before committing data or script changes. pytest covers normalization/splitting, catalog build and Word-row import (with fixtures, no Word required); node covers the JS lookup and avoid-priority logic.

## CSV columns

| Column | Meaning |
|--------|---------|
| `category` | Table header from Word (e.g. Напиток, Суп, Орех) |
| `product` | Product name (Word col 1) |
| `polarity` | `recommend` (Word col 2) or `avoid` (Word col 3) |
| `condition` | One condition text, as shown in the UI |
| `condition_key` | Normalized `condition` (identity for dedup); recomputed if blank |
| `canonical_key` | Optional: key of the main condition this row is a synonym of; blank otherwise |
| `source_table` | 1-based Word table number (traceability) |
| `source_row` | 1-based Word row number (traceability) |

Identical conditions (same normalized key) are merged automatically; identical product/category/polarity mappings are deduplicated.

## Known quirks

- **`Продукт` vs `продукт` categories:** the source document uses both spellings (capital and lowercase) as table headers, so they appear as two separate categories in the filter. Unify the `category` column in the CSV (e.g. change `продукт` → `Продукт`) and rebuild if you want one. Note a re-import brings the split back.
- **Placeholder «Нет» conditions:** some cells just contain `Нет` ("none"). These import as a literal condition named `Нет` that matches every product with such a placeholder. Remove those rows from `data/data.csv` if they are noise (re-import will bring them back).
- **Cells with inline numbering:** a cell like `Если …, 2. Если …` (number not at a line start) is not split; fix manually in the CSV (see "Split a multi-condition cell manually").
- **`file://`:** page scripts load, but auto-`fetch` of `data.json` does not — use **Загрузить data.json** (or the local server for auto-load).
- **`Formulas.doc` and `_formulas_*` extracts** are local artifacts; `_formulas_*` are git-ignored, `Formulas.doc` is intentionally not force-added.
- **Python caches / `.superpowers/`** are git-ignored.
