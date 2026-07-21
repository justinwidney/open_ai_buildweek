import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Goal CRUD. Progress/on-track evaluation runs in the client via `@control-ai/engine`'s
 *  `evaluateGoal` against a scenario's stored snapshots — Convex just holds the targets. */

export const setGoal = mutation({
  args: {
    scenarioId: v.optional(v.id("scenarios")),
    ownerId: v.optional(v.string()),
    label: v.string(),
    metric: v.string(),
    targetCents: v.number(),
    byMonth: v.optional(v.number()),
    byAge: v.optional(v.number()),
    real: v.optional(v.boolean()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("goals", args);
  },
});

export const removeGoal = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.goalId);
  },
});

export const listGoals = query({
  args: { scenarioId: v.optional(v.id("scenarios")) },
  handler: async (ctx, args) => {
    if (args.scenarioId) {
      return await ctx.db
        .query("goals")
        .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
        .collect();
    }
    return await ctx.db.query("goals").collect();
  },
});
