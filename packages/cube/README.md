# @control-ai/cube

[Cube Core](https://cube.dev/) data model exposing `@control-ai/db`'s
simulation tables as queryable measures and dimensions — the semantic layer
a future dashboard/chart frontend queries instead of writing raw SQL.

## Status: model authored, server not yet deployed

The data model (`model/cubes/*.yml`, `model/views/life_projection.yml`) and
`cube.js` config exist and are structure-checked by `pnpm --filter
@control-ai/cube test` (a dependency-free `node:test` that verifies every
cube's `sql_table` names a real `@control-ai/db` table and every view
references a cube that exists). What's *not* here is a running deployment:
Cube Core isn't a library you import — it's a config/YAML bundle loaded by a
separately-running `cube` server process that connects to Postgres directly,
so full semantic validation of the measures still requires that server and a
seeded database (see below). Treat the model as a validated shape, not a live
endpoint.

## Scope

`model/cubes/` has one cube per `@control-ai/db` output table (`runs`,
`run_months`, `decisions`, `flow_line_items`, `balance_snapshots`).
`model/views/life_projection.yml` composes them into three query surfaces at
the grains an app (or a chat-to-query layer) actually asks for:

- `life_projection` — net worth month by month for a run, plus its
  run/branch metadata. Answers "net worth over time for run X" and, by
  querying two run ids, "how do a run and its branch diverge."
- `cash_flows` — monthly income/expense/debt flows by `domain` + `view_key`.
  Answers "income breakdown by view over time," "spending over time."
- `entity_balances` — point-in-time stocks by `domain` + `metric_key`
  (portfolio value, remaining mortgage, etc.).

They're kept as three views rather than one because flows/balances are a
finer grain (many rows per run+month) than net worth (one row); combining
those fact tables in a single query would fan out and double-count.
`cube.js` points the dev server at Postgres via environment variables
(`.env.example`); PGlite has no wire port for a separate server to connect
to, so a real Postgres instance is required to run the server.

## To actually run this

1. `pnpm add cube` in this package (or `npx cubejs-cli create`) and follow
   Cube's Docker or local dev-server setup against a real Postgres instance
   containing `@control-ai/db`'s schema (apply `packages/db/drizzle`
   migrations to it).
2. Copy `.env.example` to `.env` and point it at that database.
3. Seed data by running a completed `@control-ai/worker` run against the same
   Postgres, then validate each cube's measures in the Cube Playground before
   trusting them.

## Acceptance (once wired up)

- Every cube's `sql_table` matches an actual `@control-ai/db` table name —
  this is an informational, not type-checked, contract, so a schema rename
  in `db` must be manually mirrored here.
- The `life_projection` view answers "net worth over time" and "income
  breakdown over time" for a single run without a raw SQL query.

Depends on (informationally, not as a code import): `@control-ai/db`'s
table/column names.
