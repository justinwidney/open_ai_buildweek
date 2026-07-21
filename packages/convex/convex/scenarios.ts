import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Scenario (path) lifecycle. The heavy lifting — actually computing months —
 * runs in the client or a worker using the pure `@control-ai/engine`; these
 * functions persist the results and expose them reactively to the pathway UI.
 */

export const createScenario = mutation({
  args: {
    name: v.string(),
    rootSeed: v.any(),
    returnsStrategy: v.any(),
    ageYearsAtStart: v.optional(v.number()),
    ownerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scenarios", {
      name: args.name,
      rootSeed: args.rootSeed,
      returnsStrategy: args.returnsStrategy,
      ageYearsAtStart: args.ageYearsAtStart,
      ownerId: args.ownerId,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

/** Fork a new branch scenario from a parent at a month. The child's months are computed and appended separately. */
export const forkScenario = mutation({
  args: {
    parentScenarioId: v.id("scenarios"),
    forkMonth: v.number(),
    name: v.string(),
    forkDecisionLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentScenarioId);
    if (!parent) throw new Error("Parent scenario not found");
    return await ctx.db.insert("scenarios", {
      name: args.name,
      parentScenarioId: args.parentScenarioId,
      forkMonth: args.forkMonth,
      forkDecisionLabel: args.forkDecisionLabel,
      rootSeed: parent.rootSeed,
      returnsStrategy: parent.returnsStrategy,
      ageYearsAtStart: parent.ageYearsAtStart,
      ownerId: parent.ownerId,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

/** Upsert a batch of computed months for a scenario. Idempotent per (scenario, month), so re-running a chunk is safe. */
export const appendMonths = mutation({
  args: {
    scenarioId: v.id("scenarios"),
    months: v.array(v.object({ month: v.number(), netWorthCents: v.number(), statement: v.any(), snapshot: v.any() })),
    decisions: v.optional(v.array(v.object({ month: v.number(), domain: v.string(), optionId: v.string(), label: v.string(), effectiveFromMonth: v.number() }))),
  },
  handler: async (ctx, args) => {
    for (const m of args.months) {
      const existing = await ctx.db
        .query("months")
        .withIndex("by_scenario_month", (q) => q.eq("scenarioId", args.scenarioId).eq("month", m.month))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { netWorthCents: m.netWorthCents, statement: m.statement, snapshot: m.snapshot });
      } else {
        await ctx.db.insert("months", { scenarioId: args.scenarioId, ...m });
      }
    }
    for (const d of args.decisions ?? []) {
      await ctx.db.insert("decisions", { scenarioId: args.scenarioId, ...d });
    }
    await ctx.db.patch(args.scenarioId, { status: "done" });
  },
});

/** All scenarios, for rendering the branch tree of paths. */
export const listScenarios = query({
  args: { ownerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("scenarios").collect();
    return args.ownerId ? all.filter((s) => s.ownerId === args.ownerId) : all;
  },
});

/** Compact net-worth series for a scenario's own stored months — the timeline chart's data. */
export const getNetWorthSeries = query({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, args) => {
    const months = await ctx.db
      .query("months")
      .withIndex("by_scenario_month", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    return months
      .sort((a, b) => a.month - b.month)
      .map((m) => ({ month: m.month, netWorthCents: m.netWorthCents }));
  },
});

/** One month's full statement (income/tax/spending/balance sheet/planning) for the detail panel. */
export const getMonth = query({
  args: { scenarioId: v.id("scenarios"), month: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("months")
      .withIndex("by_scenario_month", (q) => q.eq("scenarioId", args.scenarioId).eq("month", args.month))
      .unique();
  },
});

/** The decisions taken along a scenario — the fork markers on the path. */
export const getDecisions = query({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
  },
});
