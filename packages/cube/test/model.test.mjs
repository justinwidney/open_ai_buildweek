import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Dependency-free structural checks on the Cube data model. This does NOT need a
// running Cube server or a database — it guards the one contract the README flags
// as easy to break by hand: every cube's `sql_table` must name a real
// @control-ai/db table, and every view must reference a cube that exists. A
// full semantic validation still requires `cube` running against seeded Postgres.

const here = dirname(fileURLToPath(import.meta.url));
const cubesDir = join(here, "..", "model", "cubes");
const viewsDir = join(here, "..", "model", "views");

// The output tables @control-ai/db actually owns (packages/db/src/schema.ts).
// `jobs` is intentionally worker-internal and not modeled as a cube.
const DB_TABLES = new Set(["runs", "run_months", "decisions", "flow_line_items", "balance_snapshots"]);

// The canonical vocabulary lives in @control-ai/shared/sim. This package is
// YAML plus a CommonJS config with no build step and no TypeScript, so it
// cannot import those constants — it reads them out of the source text
// instead. That is deliberately crude, and it is still the only mechanism
// that catches the failure that matters here: a `view_key` added in the
// engine and the shared package but never documented in this model, leaving
// whoever writes the next query filtering on a value they cannot discover.
const sharedVocabularyPath = join(here, "..", "..", "shared", "src", "sim", "vocabulary.ts");
const sharedStatusPath = join(here, "..", "..", "shared", "src", "sim", "status.ts");

/** Pulls the string literals out of an `export const NAME = [...] as const;` declaration. */
function readConstTuple(sourcePath, name) {
  const source = readFileSync(sourcePath, "utf8");
  const declaration = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(source);
  assert.ok(declaration, `${name} not found in ${sourcePath} — was it renamed?`);
  return [...declaration[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function readModelFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), "utf8") }));
}

function matchAll(text, regex) {
  return [...text.matchAll(regex)].map((m) => m[1]);
}

const cubeFiles = readModelFiles(cubesDir);

// Each cube file declares its cube name as the first `name:` under `cubes:`.
const cubeNameByFile = cubeFiles.map((f) => ({ file: f.file, name: matchAll(f.text, /name:\s*([a-z_][\w]*)/gi)[0] }));

describe("cube model structure", () => {
  it("every cube's sql_table names a real @control-ai/db table", () => {
    for (const { file, text } of cubeFiles) {
      const tables = matchAll(text, /sql_table:\s*([a-z_][\w]*)/gi);
      assert.ok(tables.length > 0, `${file} declares no sql_table`);
      for (const table of tables) {
        assert.ok(DB_TABLES.has(table), `${file} references unknown table "${table}" — did a db schema rename get mirrored here?`);
      }
    }
  });

  it("every db output table has a cube modeling it", () => {
    const modeledTables = new Set(cubeFiles.flatMap((f) => matchAll(f.text, /sql_table:\s*([a-z_][\w]*)/gi)));
    for (const table of DB_TABLES) {
      assert.ok(modeledTables.has(table), `no cube models the "${table}" table`);
    }
  });

  it("every view's join_path references a cube that exists", () => {
    const definedCubes = new Set(cubeNameByFile.map((c) => c.name));
    for (const { file, text } of readModelFiles(viewsDir)) {
      const joinPaths = matchAll(text, /join_path:\s*([\w.]+)/gi);
      assert.ok(joinPaths.length > 0, `${file} declares no join_path`);
      for (const path of joinPaths) {
        const baseCube = path.split(".")[0];
        assert.ok(definedCubes.has(baseCube), `${file} join_path "${path}" references unknown cube "${baseCube}"`);
      }
    }
  });

  it("exposes the life_projection view named in the README", () => {
    const viewText = readModelFiles(viewsDir)
      .map((f) => f.text)
      .join("\n");
    assert.match(viewText, /name:\s*life_projection/);
  });
});

describe("cube model documents the shared vocabulary", () => {
  const textOf = (file) => readFileSync(join(cubesDir, file), "utf8");

  it("flow_line_items lists every flow domain", () => {
    const text = textOf("flow_line_items.yml");
    for (const domain of readConstTuple(sharedVocabularyPath, "FLOW_DOMAINS")) {
      assert.ok(text.includes(domain), `flow_line_items.yml does not document the "${domain}" domain from FLOW_DOMAINS`);
    }
  });

  it("flow_line_items lists every view key, for all three domains", () => {
    const text = textOf("flow_line_items.yml");
    const keys = [
      ...readConstTuple(sharedVocabularyPath, "INCOME_VIEW_KEYS"),
      ...readConstTuple(sharedVocabularyPath, "EXPENSE_VIEW_KEYS"),
      ...readConstTuple(sharedVocabularyPath, "DEBT_VIEW_KEYS"),
    ];
    assert.ok(keys.length >= 15, "expected the full view-key vocabulary to be parsed");
    for (const key of keys) {
      assert.ok(text.includes(key), `flow_line_items.yml does not document the "${key}" view key — a query filtering on it would find nothing`);
    }
  });

  it("balance_snapshots lists every balance domain and metric key", () => {
    const text = textOf("balance_snapshots.yml");
    for (const domain of readConstTuple(sharedVocabularyPath, "BALANCE_DOMAINS")) {
      assert.ok(text.includes(domain), `balance_snapshots.yml does not document the "${domain}" domain`);
    }
    for (const metric of readConstTuple(sharedVocabularyPath, "BALANCE_METRIC_KEYS")) {
      assert.ok(text.includes(metric), `balance_snapshots.yml does not document the "${metric}" metric key`);
    }
  });

  it("runs lists every run status", () => {
    const text = textOf("runs.yml");
    for (const status of readConstTuple(sharedStatusPath, "RUN_STATUSES")) {
      assert.ok(text.includes(status), `runs.yml does not document the "${status}" status from RUN_STATUSES`);
    }
  });
});
