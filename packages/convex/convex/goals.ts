import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { goalMetricValidator, goalPriorityValidator } from "./validators.js";

/**
 * Goal CRUD. Progress/on-track evaluation runs in the client via
 * `@control-ai/engine`'s `evaluateGoal` against a run's stored snapshots —
 * Convex just holds the targets.
 *
 * `metric` and `priority` were `v.string()` with a `// GoalMetric` comment;
 * they are the engine's actual closed unions now, so a typo like
 * `"networth"` is rejected at the mutation boundary instead of creating a
 * goal that silently never evaluates.
 */

export const setGoal = mutation({
  args: {
    goalId: v.optional(v.id("goals")),
    runId: v.optional(v.id("runs")),
    ownerId: v.optional(v.string()),
    label: v.string(),
    metric: goalMetricValidator,
    targetCents: v.number(),
    byMonth: v.optional(v.number()),
    byAge: v.optional(v.number()),
    real: v.optional(v.boolean()),
    priority: v.optional(goalPriorityValidator),
  },
  handler: async (ctx, args) => {
    const { goalId, ...fields } = args;
    // Upsert, matching the local backend: passing an id edits in place rather
    // than accumulating a duplicate every time a target is nudged.
    if (goalId) {
      await ctx.db.patch(goalId, fields);
      return goalId;
    }
    return await ctx.db.insert("goals", fields);
  },
});

export const removeGoal = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.goalId);
  },
});

export const listGoals = query({
  args: { runId: v.optional(v.id("runs")) },
  handler: async (ctx, args) => {
    if (args.runId) {
      return await ctx.db
        .query("goals")
        .withIndex("by_run", (q) => q.eq("runId", args.runId))
        .collect();
    }
    return await ctx.db.query("goals").collect();
  },
});
