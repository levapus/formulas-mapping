from __future__ import annotations

from scripts.condition_text import normalize_key


def build_catalog(rows: list[dict[str, str]]) -> dict:
    # key -> {display, aliases:set, mappings: list}
    buckets: dict[str, dict] = {}

    for row in rows:
        polarity = row.get("polarity", "").strip()
        if polarity not in ("recommend", "avoid"):
            continue
        product = row.get("product", "").strip()
        category = row.get("category", "").strip()
        condition = row.get("condition", "").strip()
        if not product or not condition:
            continue

        own_key = row.get("condition_key") or normalize_key(condition)
        if not own_key:
            continue

        target_key = row.get("canonical_key") or own_key
        target_key = normalize_key(target_key) if target_key else own_key

        bucket = buckets.setdefault(
            target_key,
            {"key": target_key, "display": condition, "aliases": set(), "mappings": []},
        )

        # Prefer longer/earlier display from non-alias rows
        if not row.get("canonical_key") and condition:
            if len(condition) >= len(bucket["display"]):
                bucket["display"] = condition

        if row.get("canonical_key") and own_key != target_key:
            bucket["aliases"].add(condition)

        mapping = {
            "product": product,
            "category": category,
            "polarity": polarity,
        }
        if mapping not in bucket["mappings"]:
            bucket["mappings"].append(mapping)

    conditions = []
    categories: set[str] = set()
    for key, bucket in sorted(buckets.items(), key=lambda kv: kv[1]["display"].casefold()):
        for m in bucket["mappings"]:
            if m["category"]:
                categories.add(m["category"])
        conditions.append(
            {
                "key": bucket["key"],
                "display": bucket["display"],
                "aliases": sorted(bucket["aliases"]),
                "mappings": bucket["mappings"],
            }
        )

    return {
        "conditions": conditions,
        "categories": sorted(categories, key=lambda s: s.casefold()),
    }
