# @control-ai/db

Postgres-first persistence for simulation output, built on
[Drizzle ORM](https://orm.drizzle.team/) (`drizzle-orm/pg-core` +
`drizzle-kit`). Tested against
[`@electric-sql/pglite`](https://pglite.dev/), a real Postgres-compatible
engine that runs in-process — no installed database server required for
local development or tests.

## Scope

Owns the five-table schema (`src/schema.ts`) that stores simulation *output*
only — `runs`, `run_months`, `decisions`, `flow_line_items`,
`balance_snapshots` — plus a repository layer (`src/repository.ts`) that
implements `saveRun`, `appendMonths`, `getSnapshotAt` (the DB-backed
`resolveSnapshot` from `@control-ai/engine`), and `createBranch`. Real-world
reference data (tax brackets, FICA, SSA, historical returns) is **not**
stored here — it stays as versioned code in
`@control-ai/engine`'s `reference-data/` folder, since it changes on a
different cadence than a person's simulated life and doesn't need
migrations.

Two generalized long/tidy fact tables (`flow_line_items` for monthly flows,
`balance_snapshots` for point-in-time stocks) cover every domain
(income/expense/debt/portfolio/physical-asset) uniformly via a `domain` +
`view_key`/`metric_key` column pair, rather than one bespoke table per
domain — this is deliberately the easiest shape to add a new domain or view
to without a migration, and it's the shape Cube.js (`@control-ai/cube`)
wants to sit on top of.

## Entry point

`src/index.ts` exports the schema, the Drizzle client factory, and the
repository functions. Consumers (`@control-ai/worker`, and later an API
layer) should go through the repository, not raw Drizzle queries, so the
`resolveSnapshot` branching semantics stay centralized.

## Demo / test

```sh
pnpm --filter @control-ai/db test
```

Spins up an in-process PGlite instance, applies the schema, and round-trips
a run through `saveRun` → `appendMonths` → `getSnapshotAt` →
`createBranch`, asserting the branch shares its pre-fork months with the
parent and diverges after.

## Acceptance

- Schema changes are additive-first; breaking changes get a new
  `drizzle-kit` migration, never a hand-edited table.
- `getSnapshotAt` produces byte-identical results to
  `@control-ai/engine`'s in-memory `resolveSnapshot` for the same run/month.
- No reference/lookup data lives in this schema — only simulation output.

Depends on: `@control-ai/engine`.
