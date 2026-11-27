#!/usr/bin/env node
/**
 * Build data/data.json from data/data.csv (JS port of scripts/build_json.py).
 *
 * Usage (from repo root):
 *   node scripts/build_json.mjs
 *   node scripts/build_json.mjs --csv data/data.csv --out data/data.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

await import(pathToFileURL(resolve(root, "web/catalog.js")).href);
const { catalogFromCsvText } = globalThis.FormulasCatalog;

function parseArgs(argv) {
  let csv = resolve(root, "data/data.csv");
  let out = resolve(root, "data/data.json");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--csv" && argv[i + 1]) {
      csv = resolve(root, argv[++i]);
    } else if (argv[i] === "--out" && argv[i + 1]) {
      out = resolve(root, argv[++i]);
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(
        "Usage: node scripts/build_json.mjs [--csv data/data.csv] [--out data/data.json]",
      );
      process.exit(0);
    }
  }
  return { csv, out };
}

const { csv, out } = parseArgs(process.argv.slice(2));
const text = readFileSync(csv, "utf8");
const catalog = catalogFromCsvText(text);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Wrote ${out} (${catalog.conditions.length} conditions)`);
