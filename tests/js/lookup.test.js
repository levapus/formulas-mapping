import assert from "node:assert/strict";
import test from "node:test";
import "../../web/lookup.js";
import "../../web/xlsx-export.js";

const {
  normalizeKey,
  buildIndex,
  listAllProducts,
  lookupProducts,
  lookupProductFlags,
  filterProductRows,
  resultsToCsv,
} = globalThis.FormulasLookup;
const { resultsToXlsx } = globalThis.FormulasXlsx;

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

test("filterProductRows keeps neutrals only in all mode", () => {
  const rows = [
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
      recommend: false,
      avoid: true,
      neutral: false,
    },
  ];
  assert.deepEqual(filterProductRows(rows, "all"), rows);
  assert.deepEqual(filterProductRows(rows, "matched"), [
    rows[0],
    rows[2],
  ]);
});

test("resultsToCsv exports Excel-friendly UTF-8 BOM CSV", () => {
  const csv = resultsToCsv(
    [
      {
        category: "Суп",
        product: 'Борщ, "домашний"',
        recommend: false,
        avoid: true,
        neutral: false,
      },
    ],
    { conditions: ["cond A", "cond B"] },
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /category,product,recommend,avoid,neutral,status,conditions/);
  assert.match(csv, /"Борщ, ""домашний"""/);
  assert.match(csv, /0,1,0,не рекомендуется,cond A; cond B/);
});

test("resultsToXlsx builds a ZIP-based .xlsx workbook", () => {
  const buffer = resultsToXlsx(
    [
      {
        category: "Суп",
        product: "Борщ",
        recommend: true,
        avoid: false,
        neutral: false,
      },
    ],
    { conditions: ["cond A"] },
  );
  const bytes = new Uint8Array(buffer);
  // ZIP local file header signature "PK\x03\x04"
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
  assert.ok(buffer.byteLength > 100);
});
