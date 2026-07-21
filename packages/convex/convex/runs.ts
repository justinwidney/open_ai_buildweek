import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { balanceValidator, decisionValidator, flowValidator, returnsStrategyValidator, runStatusValidator } from "./validators.js";

/**
 * Run (path) lifecycle. The heavy lifting — actually computing months — runs
 * in the client or a worker using the pure `@control-ai/engine`; these
 * functions persist the results and expose them reactively to the pathway UI.
 *
 * Named `run` throughout, matching `@control-ai/shared/sim`, the engine and
 * the Postgres backend. This file was `scenarios.ts`; if you are looking for
 * `createScenario` / `forkScenario`, they are `createRun` / `forkRun` here,
 * with `scenarioId` → `runId` and `name` → `label`.
 *
 * Every function here has a counterpart on the `RunStore` interface in
 * `@control-ai/shared/sim`, which the localStorage backend also implements —
 * so the app can run entirely offline and switch to Convex without a second
 * code path through the UI.
 */

export const createRun = mutation({
  args: {
    label: v.string(),
    rootSeed: v.any(),
    returnsStrategy: returnsStrategyValidator,
    ageYearsAtStart: v.optional(v.number()),
    ownerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    return await ctx.db.insert("runs", {
      label: args.label,
      rootSeed: args.rootSeed,
      returnsStrategy: args.returnsStrategy,
      ageYearsAtStart: args.ageYearsAtStart,
      ownerId: args.ownerId,
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

/** Fork a new branch run from a parent at a month. The child's months are computed and appended separately. */
export const forkRun = mutation({
  args: {
    parentRunId: v.id("runs"),
    forkMonth: v.number(),
    label: v.string(),
    forkDecisionLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentRunId);
    if (!parent) throw new Error("Parent run not found");
    const timestamp = Date.now();
    // A branch inherits its parent's seed and strategy verbatim; what makes it
    // diverge is the decision applied at the fork month, not a different seed.
    return await ctx.db.insert("runs", {
      label: args.label,
      parentRunId: args.parentRunId,
      forkMonth: args.forkMonth,
      forkDecisionLabel: args.forkDecisionLabel,
      rootSeed: parent.rootSeed,
      returnsStrategy: parent.returnsStrategy,
      ageYearsAtStart: parent.ageYearsAtStart,
      ownerId: parent.ownerId,
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

/** Upsert a batch of computed months for a run. Idempotent per (run, month), so re-running a chunk is safe. */
export const appendMonths = mutation({
  args: {
    runId: v.id("runs"),
    months: v.array(
      v.object({
        month: v.number(),
        netWorthCents: v.number(),
        taxBasis: v.any(),
        statement: v.any(),
        snapshot: v.any(),
        flows: v.optional(v.array(flowValidator)),
        balances: v.optional(v.array(balanceValidator)),
      }),
    ),
    decisions: v.optional(v.array(decisionValidator)),
    status: v.optional(runStatusValidator),
  },
  handler: async (ctx, args) => {
    for (const m of args.months) {
      const existing = await ctx.db
        .query("months")
        .withIndex("by_run_month", (q) => q.eq("runId", args.runId).eq("month", m.month))
        .unique();
      if (existing) await ctx.db.patch(existing._id, m);
      else await ctx.db.insert("months", { runId: args.runId, ...m });
    }
    for (const d of args.decisions ?? []) {
      // Keyed on the engine's decision id, so re-appending a chunk carrying the
      // same decisions updates them rather than duplicating the audit trail.
      const existing = await ctx.db
        .query("decisions")
        .withIndex("by_run", (q) => q.eq("runId", args.runId))
        .filter((q) => q.eq(q.field("id"), d.id))
        .unique();
      if (existing) await ctx.db.patch(existing._id, d);
      else await ctx.db.insert("decisions", { runId: args.runId, ...d });
    }
    await ctx.db.patch(args.runId, { status: args.status ?? "done", updatedAt: Date.now() });
  },
});

export const updateRunStatus = mutation({
  args: { runId: v.id("runs"), status: runStatusValidator },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, { status: args.status, updatedAt: Date.now() });
  },
});

/** Deletes a run and everything under it. Child branches are left in place, orphaned — matching the local backend. */
export const deleteRun = mutation({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const months = await ctx.db
      .query("months")
      .withIndex("by_run_month", (q) => q.eq("runId", args.runId))
      .collect();
    for (const m of months) await ctx.db.delete(m._id);

    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    for (const d of decisions) await ctx.db.delete(d._id);

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    for (const g of goals) await ctx.db.delete(g._id);

    await ctx.db.delete(args.runId);
  },
});

/** All runs, for rendering the branch tree of paths. */
export const listRuns = query({
  args: { ownerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("runs").collect();
    return args.ownerId ? all.filter((r) => r.ownerId === args.ownerId) : all;
  },
});

export const getRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => await ctx.db.get(args.runId),
});

/** Compact net-worth series for a run's own stored months — the timeline chart's data. */
export const getNetWorthSeries = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const months = await ctx.db
      .query("months")
      .withIndex("by_run_month", (q) => q.eq("runId", args.runId))
      .collect();
    return months.sort((a, b) => a.month - b.month).map((m) => ({ month: m.month, netWorthCents: m.netWorthCents }));
  },
});

/** One month's full statement (income/tax/spending/balance sheet/planning) for the detail panel. */
export const getMonth = query({
  args: { runId: v.id("runs"), month: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("months")
      .withIndex("by_run_month", (q) => q.eq("runId", args.runId).eq("month", args.month))
      .unique();
  },
});

/** The furthest month computed for a run — where an extension resumes from. */
export const getLatestMonth = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("months")
      .withIndex("by_run_month", (q) => q.eq("runId", args.runId))
      .order("desc")
      .first();
  },
});

/** The decisions taken along a run — the fork markers on the path. */
export const getDecisions = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});
