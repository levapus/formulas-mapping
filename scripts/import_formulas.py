from __future__ import annotations

import argparse
from pathlib import Path

from scripts.condition_text import normalize_key, split_conditions
from scripts.csv_io import write_csv

try:
    import win32com.client  # Windows + Word required for extraction only
except ImportError:  # pragma: no cover - non-Windows / pywin32 missing
    win32com = None


def rows_from_tables(tables: list[list[list[str]]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for table_index, table in enumerate(tables, start=1):
        if not table:
            continue
        header = table[0]
        category = (header[0] if header else "").strip() or f"table-{table_index}"
        for row_index, row in enumerate(table[1:], start=2):
            cells = list(row) + [""] * (3 - len(row))
            product = (cells[0] or "").strip()
            if not product:
                continue
            for polarity, cell in (("recommend", cells[1]), ("avoid", cells[2])):
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


def _cell_text(cell) -> str:
    text = cell.Range.Text
    return (
        text.replace("\r\x07", "")
        .replace("\x07", "")
        .replace("\r", "\n")
        .strip()
    )


def extract_tables_via_word(doc_path: Path) -> list[list[list[str]]]:
    if win32com is None:
        raise RuntimeError("pywin32 is required: pip install -r requirements.txt")
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    tables: list[list[list[str]]] = []
    try:
        doc = word.Documents.Open(str(doc_path.resolve()), ReadOnly=True)
        try:
            for table in doc.Tables:
                rows = []
                # Iterate real cells per row: tolerates merged/irregular tables
                for ri in range(1, table.Rows.Count + 1):
                    cols = []
                    for ci in range(1, 4):
                        try:
                            cols.append(_cell_text(table.Cell(ri, ci)))
                        except Exception:
                            cols.append("")
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
