# Formulas mapping tool

Offline lookup: select conditions from `Formulas.doc` tables and see matching products (recommended / not recommended / neutral).

**Full documentation:** [English guide](docs/guide.en.md) · [Russian guide](docs/guide.ru.md) <sup>ru</sup>

## Table of contents

- [What is this?](docs/guide.en.md#what-is-this) <sup>[ru](docs/guide.ru.md#что-это)</sup>
- [How to install](docs/guide.en.md#how-to-install) <sup>[ru](docs/guide.ru.md#как-установить)</sup>
- [How to run](docs/guide.en.md#how-to-run)
  - [With a local server (Python)](docs/guide.en.md#with-a-local-server-python) <sup>[ru](docs/guide.ru.md#с-локальным-сервером-python)</sup>
  - [Without Python / without a server](docs/guide.en.md#without-python--without-a-server) <sup>[ru](docs/guide.ru.md#без-python--без-сервера)</sup>
- [Workflow: Word → CSV → JSON](docs/guide.en.md#workflow-word--csv--json) <sup>[ru](docs/guide.ru.md#процесс-word--csv--json)</sup>
- [How to import from Word](docs/guide.en.md#how-to-import-from-word) <sup>[ru](docs/guide.ru.md#как-импортировать-из-word)</sup>
- [Edit CSV and rebuild JSON](docs/guide.en.md#edit-csv-and-rebuild-json) <sup>[ru](docs/guide.ru.md#правка-csv-и-сборка-json)</sup>
- [CSV format](docs/guide.en.md#csv-format) <sup>[ru](docs/guide.ru.md#формат-csv)</sup>

## Quick start

```bash
pip install -r requirements.txt
python -m http.server 8080
```

Open <http://localhost:8080/web/>.

Or open `web/index.html` via `file://` and load the JSON manually: **Другой файл (не по умолчанию)** → `data/data.json` (browsers block auto-fetch on `file://`).

Rebuild UI data after CSV edits:

```bash
python -m scripts.build_json
```

Import from Word (Windows + Word only):

```bash
python -m scripts.import_formulas --doc Formulas.doc --out data/data.csv
python -m scripts.build_json
```

## Project layout

```text
Formulas.doc          Source Word document (optional local copy)
scripts/              Python: import_formulas, build_json, catalog, csv_io, …
data/data.csv         Editable source of truth
data/data.json        Generated catalog for the UI (do not hand-edit)
web/                  Static UI (+ Excel export)
docs/guide.en.md      User guide (English)
docs/guide.ru.md      Руководство (русский)
tests/                pytest + node tests
```

## Tests

```bash
python -m pytest -v
node --test tests/js/lookup.test.js
```
