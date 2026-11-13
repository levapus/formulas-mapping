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
