import { internalMutation } from "./_generated/server";

/**
 * One-off migration mutations — Convex's analogue of a numbered SQL migration.
 * When a schema change is breaking (renaming/retyping an existing field),
 * make the new field optional in `schema.ts`, add a mutation here that
 * backfills every affected document, run it once against the deployment
 * (`npx convex run migrations:<name>`), then drop the old field.
 *
 * ## scenarios → runs
 *
 * The `scenarios` table was renamed to `runs` (and `name` → `label`,
 * `parentScenarioId` → `parentRunId`) to match `@control-ai/shared/sim` and
 * every other package. No migration is written for it because the rename
 * landed before this schema was ever deployed — there is no `_generated/`
 * directory in the repository and therefore no deployment holding
 * `scenarios` documents.
 *
 * If you *do* have a deployment predating this change, the rename is not
 * automatic: Convex will simply see an empty `runs` table and an unknown
 * `scenarios` one. Copy the documents across in a migration mutation here
 * before dropping the old table, mapping `name` → `label`, `parentScenarioId`
 * → `parentRunId`, and adding `updatedAt` (there was no such field).
 *
 * Example skeleton (uncomment and adapt):
 *
 * export const backfillRunAge = internalMutation({
 *   args: {},
 *   handler: async (ctx) => {
 *     for (const r of await ctx.db.query("runs").collect()) {
 *       if (r.ageYearsAtStart === undefined) await ctx.db.patch(r._id, { ageYearsAtStart: 30 });
 *     }
 *   },
 * });
 */

export {};
// `internalMutation` is imported so the example above type-checks once uncommented.
void internalMutation;
