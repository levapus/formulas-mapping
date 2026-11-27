# Formulas mapping tool

Offline lookup: select conditions from `Formulas.doc` tables and see matching products (recommended / not recommended / neutral).

**Полная документация:** [руководство](docs/guide.ru.md) <sup>[en](docs/guide.en.md)</sup>

## Содержание

- [Что это?](docs/guide.ru.md#что-это) <sup>[en](docs/guide.en.md#what-is-this)</sup>
- [Как установить](docs/guide.ru.md#как-установить) <sup>[en](docs/guide.en.md#how-to-install)</sup>
- [Как запустить](docs/guide.ru.md#как-запустить)
  - [С локальным сервером (Python)](docs/guide.ru.md#с-локальным-сервером-python) <sup>[en](docs/guide.en.md#with-a-local-server-python)</sup>
  - [Без Python / без сервера](docs/guide.ru.md#без-python--без-сервера) <sup>[en](docs/guide.en.md#without-python--without-a-server)</sup>
- [Процесс: Word → CSV → JSON](docs/guide.ru.md#процесс-word--csv--json) <sup>[en](docs/guide.en.md#workflow-word--csv--json)</sup>
- [Как импортировать из Word](docs/guide.ru.md#как-импортировать-из-word) <sup>[en](docs/guide.en.md#how-to-import-from-word)</sup>
- [Правка CSV и сборка JSON](docs/guide.ru.md#правка-csv-и-сборка-json) <sup>[en](docs/guide.en.md#edit-csv-and-rebuild-json)</sup>
- [Формат CSV](docs/guide.ru.md#формат-csv) <sup>[en](docs/guide.en.md#csv-format)</sup>

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
