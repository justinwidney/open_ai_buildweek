import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { balanceValidator, flowValidator, goalMetricValidator, goalPriorityValidator, jobStatusValidator, returnsStrategyValidator, runStatusValidator } from "./validators.js";

/**
 * Convex schema for the pathway simulator. Unlike the Postgres/Drizzle
 * package, Convex has NO SQL migrations — this file *is* the schema, and
 * `npx convex dev` applies changes reactively. Evolve it by editing here;
 * for a breaking data change, write a one-off migration mutation (see
 * migrations.ts) rather than a numbered SQL file.
 *
 * Document-shaped storage lets us keep each month's full engine output
 * (`LifeStateSnapshot` + `MonthlyStatement`) as one document, instead of the
 * relational long/tidy fact tables — the reactive UI reads a month's whole
 * statement in a single query and re-renders when it changes.
 *
 * ## Aligned with @control-ai/shared/sim
 *
 * This schema used to call the core entity a **scenario** (`scenarios`,
 * `scenarioId`, `name`) while @control-ai/engine, @control-ai/db,
 * @control-ai/worker and the Cube model all called the same thing a **run**
 * (`LifeStateSnapshot.runId`, `runs`, `RunRef`). One entity under two names
 * across five packages meant every boundary needed a translation nobody had
 * written. It is a `run` here now too, and the field names, lifecycle
 * validators and flow/balance vocabulary all come from
 * `@control-ai/shared/sim`, so the two backends stay comparable.
 *
 * Two further gaps this closes: `decisions` now carries the engine's
 * `Decision.id` (without it a stored decision could not be read back into a
 * snapshot), and `flows`/`balances` are recorded per month — so a Convex run
 * holds the same facts the Cube model reads out of Postgres, rather than only
 * an opaque statement blob.
 */
export default defineSchema({
  // One simulated life path. A branch points at its parent + the month it forked.
  runs: defineTable({
    label: v.string(),
    ownerId: v.optional(v.string()), // future: per-user scoping
    parentRunId: v.optional(v.id("runs")),
    forkMonth: v.optional(v.number()),
    /** The decision label that created this branch, for the pathway UI's fork markers. */
    forkDecisionLabel: v.optional(v.string()),
    status: runStatusValidator,
    /**
     * The static entity configs this run replays from (`RootSeed`). Stored as
     * `v.any()` deliberately — see validators.ts on why large engine-owned
     * structures are typed at the boundary rather than restated as validators.
     */
    rootSeed: v.any(),
    returnsStrategy: returnsStrategyValidator,
    /** Age of the primary person at month 0, so months can report age. */
    ageYearsAtStart: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_parent", ["parentRunId"]),

  // One computed month of a run: the aggregate figures a timeline chart needs,
  // plus the full statement for a detail panel and the raw snapshot to resume/branch from.
  months: defineTable({
    runId: v.id("runs"),
    month: v.number(),
    netWorthCents: v.number(),
    /** Year-to-date tax accumulators (`TaxBasisState`) — engine-owned, so typed at the boundary. */
    taxBasis: v.any(),
    /** The full `MonthlyStatement` (income, tax split, spending, balance sheet, planning). */
    statement: v.any(),
    /** The full `LifeStateSnapshot` — needed to fork or extend from this month. */
    snapshot: v.any(),
    /** Per-entity monthly flows, at the same grain @control-ai/db stores and Cube queries. */
    flows: v.optional(v.array(flowValidator)),
    /** Per-entity point-in-time balances, same grain as @control-ai/db's `balance_snapshots`. */
    balances: v.optional(v.array(balanceValidator)),
  }).index("by_run_month", ["runId", "month"]),

  // The decision audit trail — what fork was taken and when. Mirrors the engine's Decision.
  decisions: defineTable({
    runId: v.id("runs"),
    /** The engine's own `Decision.id`, distinct from Convex's `_id`. Required to round-trip back into a snapshot. */
    id: v.string(),
    month: v.number(),
    domain: v.string(),
    optionId: v.string(),
    label: v.string(),
    effectiveFromMonth: v.number(),
  }).index("by_run", ["runId"]),

  // A user's goals (net worth by 60, debt-free by 40, …). runId absent = applies across runs.
  goals: defineTable({
    runId: v.optional(v.id("runs")),
    ownerId: v.optional(v.string()),
    label: v.string(),
    metric: goalMetricValidator,
    targetCents: v.number(),
    byMonth: v.optional(v.number()),
    byAge: v.optional(v.number()),
    real: v.optional(v.boolean()),
    priority: v.optional(goalPriorityValidator),
  }).index("by_run", ["runId"]),

  // Background extension/branch jobs (optional; mirrors @control-ai/worker's jobs table).
  jobs: defineTable({
    runId: v.id("runs"),
    fromMonth: v.number(),
    toMonth: v.number(),
    status: jobStatusValidator,
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_run", ["runId"]),
});
