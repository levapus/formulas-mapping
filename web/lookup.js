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

  function lookupProductFlags(index, selectedKeys, categoryFilter) {
    /** @type {Map<string, {category: string, product: string, recommend: boolean, avoid: boolean}>} */
    const rows = new Map();

    for (const key of selectedKeys) {
      const cond = index.get(key);
      if (!cond) continue;
      for (const m of cond.mappings) {
        if (categoryFilter && m.category !== categoryFilter) continue;
        const id = `${m.category}\0${m.product}`;
        let row = rows.get(id);
        if (!row) {
          row = {
            category: m.category,
            product: m.product,
            recommend: false,
            avoid: false,
          };
          rows.set(id, row);
        }
        if (m.polarity === "recommend") row.recommend = true;
        if (m.polarity === "avoid") row.avoid = true;
      }
    }

    return [...rows.values()].sort((a, b) => {
      const byCat = a.category.localeCompare(b.category, "ru");
      if (byCat !== 0) return byCat;
      return a.product.localeCompare(b.product, "ru");
    });
  }

  function lookupProducts(index, selectedKeys, categoryFilter) {
    const flags = lookupProductFlags(index, selectedKeys, categoryFilter);
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
    lookupProductFlags,
    lookupProducts,
  };
})(globalThis);
