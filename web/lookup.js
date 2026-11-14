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

  function lookupProducts(index, selectedKeys, categoryFilter) {
    /** @type {Map<string, "recommend"|"avoid">} */
    const best = new Map();

    for (const key of selectedKeys) {
      const cond = index.get(key);
      if (!cond) continue;
      for (const m of cond.mappings) {
        if (categoryFilter && m.category !== categoryFilter) continue;
        const id = `${m.category}\0${m.product}`;
        const prev = best.get(id);
        if (m.polarity === "avoid" || !prev) {
          best.set(id, m.polarity === "avoid" ? "avoid" : "recommend");
        } else if (prev === "recommend" && m.polarity === "avoid") {
          best.set(id, "avoid");
        }
        if (prev === "avoid") best.set(id, "avoid");
      }
    }

    const avoid = [];
    const recommend = [];
    for (const [id, polarity] of best) {
      const [category, product] = id.split("\0");
      (polarity === "avoid" ? avoid : recommend).push({ category, product });
    }
    return {
      avoid: groupByCategory(avoid),
      recommend: groupByCategory(recommend),
    };
  }

  global.FormulasLookup = {
    normalizeKey,
    buildIndex,
    lookupProducts,
  };
})(globalThis);
