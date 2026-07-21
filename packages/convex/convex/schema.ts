import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
 */
export default defineSchema({
  // One simulated life path. A branch points at its parent + the month it forked.
  scenarios: defineTable({
    name: v.string(),
    ownerId: v.optional(v.string()), // future: per-user scoping
    parentScenarioId: v.optional(v.id("scenarios")),
    forkMonth: v.optional(v.number()),
    /** The decision label that created this branch, for the pathway UI's fork markers. */
    forkDecisionLabel: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("running"), v.literal("done"), v.literal("error")),
    /** Serializable rng seed + returns-strategy config, so a run can be recomputed deterministically. */
    rootSeed: v.any(),
    returnsStrategy: v.any(),
    /** Age of the primary person at month 0, so months can report age. */
    ageYearsAtStart: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_parent", ["parentScenarioId"]),

  // One computed month of a scenario: the aggregate figures a timeline chart needs,
  // plus the full statement for a detail panel and the raw snapshot to resume/branch from.
  months: defineTable({
    scenarioId: v.id("scenarios"),
    month: v.number(),
    netWorthCents: v.number(),
    /** The full `MonthlyStatement` (income, tax split, spending, balance sheet, planning). */
    statement: v.any(),
    /** The full `LifeStateSnapshot` — needed to fork or extend from this month. */
    snapshot: v.any(),
  }).index("by_scenario_month", ["scenarioId", "month"]),

  // The decision audit trail — what fork was taken and when. Mirrors the engine's Decision.
  decisions: defineTable({
    scenarioId: v.id("scenarios"),
    month: v.number(),
    domain: v.string(),
    optionId: v.string(),
    label: v.string(),
    effectiveFromMonth: v.number(),
  }).index("by_scenario", ["scenarioId"]),

  // A user's goals (net worth by 60, debt-free by 40, …). scenarioId null = applies across scenarios.
  goals: defineTable({
    scenarioId: v.optional(v.id("scenarios")),
    ownerId: v.optional(v.string()),
    label: v.string(),
    metric: v.string(), // GoalMetric
    targetCents: v.number(),
    byMonth: v.optional(v.number()),
    byAge: v.optional(v.number()),
    real: v.optional(v.boolean()),
    priority: v.optional(v.string()),
  }).index("by_scenario", ["scenarioId"]),

  // Background extension/branch jobs (optional; mirrors @control-ai/worker's jobs table).
  jobs: defineTable({
    scenarioId: v.id("scenarios"),
    fromMonth: v.number(),
    toMonth: v.number(),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("done"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_scenario", ["scenarioId"]),
});
