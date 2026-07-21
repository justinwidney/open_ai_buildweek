# @control-ai/convex

Convex backend for the pathway simulator — the reactive persistence layer for
scenarios (life paths), their computed months, decisions, and goals. An
alternative to the Postgres/Drizzle `@control-ai/db` package: pick one as the
store. Convex suits the pathway UI well because queries are reactive (the
timeline re-renders when a month is appended) and each month is one document.

## "Migrations" in Convex

There are **no SQL migration files**. `convex/schema.ts` *is* the schema;
`npx convex dev` diffs and applies it live, enforcing the validators on write.
To evolve it:

- **Additive** change (new optional field, new table): edit `schema.ts` — no
  data migration needed.
- **Breaking** change (rename/retype an existing field): make the new field
  optional, write a one-off **migration mutation** that backfills every
  document, then remove the old field. That mutation is the Convex analogue of
  a numbered migration; keep it in `convex/migrations.ts`.

## Tables (`convex/schema.ts`)

- `scenarios` — one life path; a branch carries `parentScenarioId` + `forkMonth`.
- `months` — one computed month: `netWorthCents` (for the chart), the full
  `MonthlyStatement` (detail panel), and the raw `LifeStateSnapshot` (to fork
  or extend from).
- `decisions` — the fork audit trail (path markers).
- `goals` — targets to measure paths against.
- `jobs` — optional background extend/branch tracking.

## Functions

- `scenarios.ts` — `createScenario`, `forkScenario`, `appendMonths` (idempotent
  per month), `listScenarios`, `getNetWorthSeries`, `getMonth`, `getDecisions`.
- `goals.ts` — `setGoal`, `removeGoal`, `listGoals`.

The heavy computation stays in the **pure `@control-ai/engine`**, which runs
fine in Convex's V8 runtime (no Node/native deps) *or* directly in the browser.
The typical loop: run the engine to compute months → `appendMonths` → the UI
reactively reads `getNetWorthSeries`/`getMonth`. Forking: `forkScenario` makes
the child row; the client reads the parent's snapshot at the fork month,
applies an event (`engine.forkWithEvent`), runs forward, and `appendMonths` to
the child.

## Run it

```sh
pnpm --filter @control-ai/convex exec convex dev   # first run provisions a dev deployment + generates convex/_generated
```

`convex/_generated/` (the typed API + server types) is created by the CLI and
is gitignored; this package won't typecheck until you've run `convex dev` once.
Like `@control-ai/cube`, it's a prepared scaffold, not a live deployment.
