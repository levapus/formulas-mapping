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
