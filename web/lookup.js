(function (global) {
  function normalizeKey(text) {
    if (!text) return "";
    let s = text.normalize("NFKC");
    s = s.replaceAll("ё", "е").replaceAll("Ё", "Е");
    s = s.toLocaleLowerCase("ru-RU");
    s = s.replace(/\s+/g, " ").trim();
    s = s.replace(/[\s.,;:!?]+$/u, "");
    return s;
  }

  function buildIndex(catalog) {
    const map = new Map();
    for (const cond of catalog.conditions || []) {
      map.set(cond.key, cond);
      for (const alias of cond.aliases || []) {
        const ak = normalizeKey(alias);
        if (ak && !map.has(ak)) map.set(ak, cond);
      }
    }
    return map;
  }

  function groupByCategory(items) {
    const byCat = new Map();
    for (const { category, product } of items) {
      if (!byCat.has(category)) byCat.set(category, []);
      const list = byCat.get(category);
      if (!list.includes(product)) list.push(product);
    }
    return [...byCat.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([category, products]) => ({
        category,
        products: products.sort((a, b) => a.localeCompare(b, "ru")),
      }));
  }

  function listAllProducts(catalog) {
    /** @type {Map<string, {category: string, product: string}>} */
    const map = new Map();
    for (const cond of catalog.conditions || []) {
      for (const m of cond.mappings || []) {
        if (!m.category || !m.product) continue;
        const id = `${m.category}\0${m.product}`;
        if (!map.has(id)) {
          map.set(id, { category: m.category, product: m.product });
        }
      }
    }
    return [...map.values()].sort((a, b) => {
      const byCat = a.category.localeCompare(b.category, "ru");
      if (byCat !== 0) return byCat;
      return a.product.localeCompare(b.product, "ru");
    });
  }

  /**
   * Full product catalog with recommend/avoid/neutral flags from selected conditions.
   * Neutral = neither recommend nor avoid for the current selection.
   */
  function lookupProductFlags(allProducts, index, selectedKeys, categoryFilter) {
    /** @type {Map<string, {recommend: boolean, avoid: boolean}>} */
    const flagged = new Map();

    for (const key of selectedKeys) {
      const cond = index.get(key);
      if (!cond) continue;
      for (const m of cond.mappings) {
        if (categoryFilter && m.category !== categoryFilter) continue;
        const id = `${m.category}\0${m.product}`;
        let flags = flagged.get(id);
        if (!flags) {
          flags = { recommend: false, avoid: false };
          flagged.set(id, flags);
        }
        if (m.polarity === "recommend") flags.recommend = true;
        if (m.polarity === "avoid") flags.avoid = true;
      }
    }

    const rows = [];
    for (const p of allProducts) {
      if (categoryFilter && p.category !== categoryFilter) continue;
      const id = `${p.category}\0${p.product}`;
      const flags = flagged.get(id);
      const recommend = Boolean(flags?.recommend);
      const avoid = Boolean(flags?.avoid);
      rows.push({
        category: p.category,
        product: p.product,
        recommend,
        avoid,
        neutral: !recommend && !avoid,
      });
    }
    return rows;
  }

  function lookupProducts(index, selectedKeys, categoryFilter) {
    // Build a temporary product list from the flagged hits only (legacy API).
    const flaggedOnly = [];
    const seen = new Map();
    for (const key of selectedKeys) {
      const cond = index.get(key);
      if (!cond) continue;
      for (const m of cond.mappings) {
        if (categoryFilter && m.category !== categoryFilter) continue;
        const id = `${m.category}\0${m.product}`;
        if (!seen.has(id)) {
          seen.set(id, { category: m.category, product: m.product });
          flaggedOnly.push(seen.get(id));
        }
      }
    }
    const flags = lookupProductFlags(
      flaggedOnly,
      index,
      selectedKeys,
      categoryFilter,
    );
    const avoid = [];
    const recommend = [];
    for (const row of flags) {
      // Avoid wins when both are set.
      if (row.avoid) avoid.push({ category: row.category, product: row.product });
      else if (row.recommend) {
        recommend.push({ category: row.category, product: row.product });
      }
    }
    return {
      avoid: groupByCategory(avoid),
      recommend: groupByCategory(recommend),
    };
  }

  global.FormulasLookup = {
    normalizeKey,
    buildIndex,
    listAllProducts,
    lookupProductFlags,
    lookupProducts,
  };
})(globalThis);
