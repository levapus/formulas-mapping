(function (global) {
  const FIELDNAMES = [
    "category",
    "product",
    "polarity",
    "condition",
    "condition_key",
    "canonical_key",
    "source_table",
    "source_row",
  ];

  function normalizeKey(text) {
    if (!text) return "";
    let s = text.normalize("NFKC");
    s = s.replaceAll("ё", "е").replaceAll("Ё", "Е");
    s = s.toLocaleLowerCase("ru-RU");
    s = s.replace(/\s+/g, " ").trim();
    s = s.replace(/[\s.,;:!?]+$/u, "");
    return s;
  }

  /** RFC-style CSV parse (handles quotes, commas, CRLF, UTF-8 BOM). */
  function parseCsv(text) {
    let raw = String(text ?? "");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

    const rows = [];
    let row = [];
    let field = "";
    let i = 0;
    let inQuotes = false;

    while (i < raw.length) {
      const ch = raw[i];
      if (inQuotes) {
        if (ch === '"') {
          if (raw[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        i += 1;
        continue;
      }
      if (ch === "\r") {
        i += 1;
        continue;
      }
      if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (!rows.length) return [];

    const header = rows[0].map((h) => h.trim());
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (!cells.length || cells.every((c) => !String(c).trim())) continue;
      /** @type {Record<string, string>} */
      const obj = {};
      for (const name of FIELDNAMES) {
        const idx = header.indexOf(name);
        obj[name] = idx >= 0 ? String(cells[idx] ?? "").trim() : "";
      }
      out.push(obj);
    }
    return out;
  }

  /**
   * Port of scripts/catalog.py build_catalog.
   * @param {Record<string, string>[]} rows
   */
  function buildCatalog(rows) {
    /** @type {Map<string, {key: string, display: string, aliases: Set<string>, mappings: object[]}>} */
    const buckets = new Map();

    for (const row of rows) {
      const polarity = (row.polarity || "").trim();
      if (polarity !== "recommend" && polarity !== "avoid") continue;
      const product = (row.product || "").trim();
      const category = (row.category || "").trim();
      const condition = (row.condition || "").trim();
      if (!product || !condition) continue;

      const ownKey = (row.condition_key || "").trim() || normalizeKey(condition);
      if (!ownKey) continue;

      let targetKey = (row.canonical_key || "").trim() || ownKey;
      targetKey = normalizeKey(targetKey) || ownKey;

      let bucket = buckets.get(targetKey);
      if (!bucket) {
        bucket = {
          key: targetKey,
          display: condition,
          aliases: new Set(),
          mappings: [],
        };
        buckets.set(targetKey, bucket);
      }

      if (!(row.canonical_key || "").trim() && condition) {
        if (condition.length >= bucket.display.length) {
          bucket.display = condition;
        }
      }

      if ((row.canonical_key || "").trim() && ownKey !== targetKey) {
        bucket.aliases.add(condition);
      }

      const mapping = { product, category, polarity };
      if (
        !bucket.mappings.some(
          (m) =>
            m.product === mapping.product &&
            m.category === mapping.category &&
            m.polarity === mapping.polarity,
        )
      ) {
        bucket.mappings.push(mapping);
      }
    }

    /** Match Python sorted(..., key=str.casefold); ties keep insertion order. */
    function cmpCasefold(a, b) {
      const ak = a.toLocaleLowerCase("ru-RU");
      const bk = b.toLocaleLowerCase("ru-RU");
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      return 0;
    }

    const conditions = [];
    const categories = new Set();
    const sortedBuckets = [...buckets.values()].sort((a, b) =>
      cmpCasefold(a.display, b.display),
    );
    for (const bucket of sortedBuckets) {
      for (const m of bucket.mappings) {
        if (m.category) categories.add(m.category);
      }
      conditions.push({
        key: bucket.key,
        display: bucket.display,
        aliases: [...bucket.aliases].sort(cmpCasefold),
        mappings: bucket.mappings,
      });
    }

    return {
      conditions,
      categories: [...categories].sort(cmpCasefold),
    };
  }

  function catalogFromCsvText(text) {
    return buildCatalog(parseCsv(text));
  }

  global.FormulasCatalog = {
    FIELDNAMES,
    normalizeKey,
    parseCsv,
    buildCatalog,
    catalogFromCsvText,
  };
})(globalThis);
