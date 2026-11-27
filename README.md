# Formulas mapping tool

Offline lookup: select conditions from `Formulas.doc` tables and see matching products (recommended / not recommended / neutral).

**Full documentation**

| Language | Guide |
|----------|--------|
| English | [docs/guide.en.md](docs/guide.en.md) |
| Русский | [docs/guide.ru.md](docs/guide.ru.md) |

## Table of contents (guides)

Both guides cover the same topics:

| Topic | English | Русский |
|-------|---------|---------|
| What is this | [What is this?](docs/guide.en.md#what-is-this) | [Что это?](docs/guide.ru.md#что-это) |
| How to install | [How to install](docs/guide.en.md#how-to-install) | [Как установить](docs/guide.ru.md#как-установить) |
| Run with server | [With a local server (Python)](docs/guide.en.md#with-a-local-server-python) | [С локальным сервером (Python)](docs/guide.ru.md#с-локальным-сервером-python) |
| Run without server | [Without Python / without a server](docs/guide.en.md#without-python--without-a-server) | [Без Python / без сервера](docs/guide.ru.md#без-python--без-сервера) |
| Word → CSV → JSON workflow | [Workflow: Word → CSV → JSON](docs/guide.en.md#workflow-word--csv--json) | [Процесс: Word → CSV → JSON](docs/guide.ru.md#процесс-word--csv--json) |
| Import from Word | [How to import from Word](docs/guide.en.md#how-to-import-from-word) | [Как импортировать из Word](docs/guide.ru.md#как-импортировать-из-word) |
| Add / edit / delete CSV → JSON | [Edit CSV and rebuild JSON](docs/guide.en.md#edit-csv-and-rebuild-json) | [Правка CSV и сборка JSON](docs/guide.ru.md#правка-csv-и-сборка-json) |
| CSV format | [CSV format](docs/guide.en.md#csv-format) | [Формат CSV](docs/guide.ru.md#формат-csv) |

## Quick start

```bash
pip install -r requirements.txt
python -m http.server 8080
```

Open <http://localhost:8080/web/>.

Or open `web/index.html` and use **Загрузить данные** → `data/data.json`.

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
