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
