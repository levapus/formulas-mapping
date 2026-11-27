import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "../../web/catalog.js";

const { parseCsv, buildCatalog, catalogFromCsvText, normalizeKey } =
  globalThis.FormulasCatalog;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = readFileSync(
  resolve(root, "tests/fixtures/sample.csv"),
  "utf8",
);

test("normalizeKey matches lookup yo/case rules", () => {
  assert.equal(normalizeKey("  Уран. "), normalizeKey("уран"));
  assert.equal(normalizeKey("напряжённый"), normalizeKey("напряженный"));
});

test("parseCsv reads BOM and quoted commas", () => {
  const rows = parseCsv(
    '\uFEFFcategory,product,polarity,condition,condition_key,canonical_key,source_table,source_row\n' +
      'Суп,"Борщ, домашний",avoid,Cond,,,1,2\n',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].product, "Борщ, домашний");
  assert.equal(rows[0].polarity, "avoid");
});

test("buildCatalog dedups normalize and merges mappings like Python", () => {
  const catalog = catalogFromCsvText(fixture);
  const matches = catalog.conditions.filter((c) =>
    c.key.includes("напряженном аспекте к марсу"),
  );
  assert.equal(matches.length, 1);
  const products = new Set(
    matches[0].mappings.map((m) => `${m.product}|${m.polarity}`),
  );
  assert.ok(products.has("Борщ|avoid"));
  assert.ok(products.has("Гороховый|avoid"));
});

test("canonical_key synonyms merge into main condition", () => {
  const catalog = catalogFromCsvText(fixture);
  const byKey = Object.fromEntries(catalog.conditions.map((c) => [c.key, c]));
  assert.equal(byKey["alias phrase"], undefined);
  const canon = byKey["луна в напряженном аспекте к марсу"];
  assert.ok(canon);
  assert.ok(canon.mappings.some((m) => m.product === "Какао"));
  assert.ok(
    canon.aliases.some((a) => a.toLocaleLowerCase("ru-RU").includes("alias")),
  );
  assert.deepEqual(catalog.categories, ["Напиток", "Суп"]);
});

test("buildCatalog ignores bad polarity and empty product/condition", () => {
  const rows = parseCsv(
    "category,product,polarity,condition,condition_key,canonical_key,source_table,source_row\n" +
      "Суп,Борщ,maybe,X,,,,\n" +
      "Суп,,avoid,Z,,,,\n" +
      "Суп,Борщ,avoid,,,,,;\n",
  );
  assert.deepEqual(buildCatalog(rows), { conditions: [], categories: [] });
});
