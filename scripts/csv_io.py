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
