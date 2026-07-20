# @control-ai/cube

[Cube Core](https://cube.dev/) data model exposing `@control-ai/db`'s
simulation tables as queryable measures and dimensions — the semantic layer
a future dashboard/chart frontend queries instead of writing raw SQL.

## Status: schema-only scaffold

This package is **not** wired into `pnpm -r` build/test/typecheck and isn't
covered by automated tests yet. Cube Core isn't a library you import — it's
a YAML/config bundle loaded by a separately-running `cube` server process
that connects to Postgres directly, so there's nothing to unit-test without
an actual running server and a seeded database, which is out of scope for
this pass. Treat the files here as a validated starting shape, not a
working deployment.

## Scope

`model/cubes/` has one cube per `@control-ai/db` table (`runs`,
`run_months`, `decisions`, `flow_line_items`, `balance_snapshots`).
`model/views/life_projection.yml` composes them into the shape an app
actually wants to ask for — e.g. "net worth over time for run X," "income
breakdown by view over time," "how do a run and its branch diverge."
`cube.config.js` points the dev server at local Postgres (or PGlite via its
Postgres wire protocol, if compatible — verify before relying on it).

## To actually run this

1. `pnpm add -w cubejs-cli` (or `npx cubejs-cli create`) and follow Cube's
   Docker or local dev-server setup against a real Postgres instance
   containing `@control-ai/db`'s schema.
2. Point `cube.config.js`'s `driverFactory`/env vars at that database.
3. Validate each cube against seeded data from a completed
   `@control-ai/worker` run before trusting any measure.

## Acceptance (once wired up)

- Every cube's `sql_table` matches an actual `@control-ai/db` table name —
  this is an informational, not type-checked, contract, so a schema rename
  in `db` must be manually mirrored here.
- The `life_projection` view answers "net worth over time" and "income
  breakdown over time" for a single run without a raw SQL query.

Depends on (informationally, not as a code import): `@control-ai/db`'s
table/column names.
