import { internalMutation } from "./_generated/server";

/**
 * One-off migration mutations — Convex's analogue of a numbered SQL migration.
 * When a schema change is breaking (renaming/retyping an existing field),
 * make the new field optional in `schema.ts`, add a mutation here that
 * backfills every affected document, run it once against the deployment
 * (`npx convex run migrations:<name>`), then drop the old field.
 *
 * Example skeleton (uncomment and adapt):
 *
 * export const backfillScenarioAge = internalMutation({
 *   args: {},
 *   handler: async (ctx) => {
 *     for (const s of await ctx.db.query("scenarios").collect()) {
 *       if (s.ageYearsAtStart === undefined) await ctx.db.patch(s._id, { ageYearsAtStart: 30 });
 *     }
 *   },
 * });
 */

export {};
// `internalMutation` is imported so the example above type-checks once uncommented.
void internalMutation;
