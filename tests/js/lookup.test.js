import assert from "node:assert/strict";
import test from "node:test";
import "../../web/lookup.js";

const {
  normalizeKey,
  buildIndex,
  listAllProducts,
  lookupProducts,
  lookupProductFlags,
} = globalThis.FormulasLookup;

test("normalizeKey matches Python rules for yo/case/punct", () => {
  assert.equal(normalizeKey("  Уран. "), normalizeKey("уран"));
  assert.equal(normalizeKey("напряжённый"), normalizeKey("напряженный"));
});

test("avoid wins over recommend for same product+category", () => {
  const catalog = {
    conditions: [
      {
        key: normalizeKey("cond A"),
        display: "cond A",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "recommend" },
        ],
      },
      {
        key: normalizeKey("cond B"),
        display: "cond B",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "avoid" },
        ],
      },
    ],
    categories: ["Суп"],
  };
  const index = buildIndex(catalog);
  const result = lookupProducts(
    index,
    [normalizeKey("cond A"), normalizeKey("cond B")],
    null,
  );
  assert.deepEqual(result.recommend, []);
  assert.equal(result.avoid.length, 1);
  assert.deepEqual(result.avoid[0], { category: "Суп", products: ["Борщ"] });
});

test("category filter narrows results only", () => {
  const catalog = {
    conditions: [
      {
        key: "k1",
        display: "k1",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "avoid" },
          { product: "Какао", category: "Напиток", polarity: "avoid" },
        ],
      },
    ],
    categories: ["Напиток", "Суп"],
  };
  const result = lookupProducts(buildIndex(catalog), ["k1"], "Суп");
  assert.deepEqual(result.avoid, [{ category: "Суп", products: ["Борщ"] }]);
  assert.deepEqual(result.recommend, []);
});

test("listAllProducts returns every unique category+product", () => {
  const catalog = {
    conditions: [
      {
        key: "a",
        display: "a",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "recommend" },
          { product: "Борщ", category: "Суп", polarity: "avoid" },
          { product: "Какао", category: "Напиток", polarity: "recommend" },
        ],
      },
    ],
    categories: ["Напиток", "Суп"],
  };
  assert.deepEqual(listAllProducts(catalog), [
    { category: "Напиток", product: "Какао" },
    { category: "Суп", product: "Борщ" },
  ]);
});

test("lookupProductFlags marks hits on full catalog; others unchecked", () => {
  const catalog = {
    conditions: [
      {
        key: normalizeKey("cond A"),
        display: "cond A",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "recommend" },
        ],
      },
      {
        key: normalizeKey("cond B"),
        display: "cond B",
        aliases: [],
        mappings: [
          { product: "Борщ", category: "Суп", polarity: "avoid" },
          { product: "Какао", category: "Напиток", polarity: "recommend" },
        ],
      },
      {
        key: "unused",
        display: "unused",
        aliases: [],
        mappings: [
          { product: "Хрен", category: "Овощ", polarity: "avoid" },
        ],
      },
    ],
    categories: ["Напиток", "Овощ", "Суп"],
  };
  const all = listAllProducts(catalog);
  const rows = lookupProductFlags(
    all,
    buildIndex(catalog),
    [normalizeKey("cond A"), normalizeKey("cond B")],
    null,
  );
  assert.deepEqual(rows, [
    {
      category: "Напиток",
      product: "Какао",
      recommend: true,
      avoid: false,
      neutral: false,
    },
    {
      category: "Овощ",
      product: "Хрен",
      recommend: false,
      avoid: false,
      neutral: true,
    },
    {
      category: "Суп",
      product: "Борщ",
      recommend: true,
      avoid: true,
      neutral: false,
    },
  ]);
});
