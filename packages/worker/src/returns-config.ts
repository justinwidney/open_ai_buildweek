/**
 * `ReturnsStrategyConfig` and `buildReturnsStrategy` now live in
 * `@control-ai/shared/sim`, re-exported here so existing importers and this
 * package's job payload keep working unchanged.
 *
 * They moved because this package depends on `piscina` and `worker_threads`,
 * making it unimportable from the browser and from Convex — yet
 * @control-ai/db, @control-ai/convex and the web app all *persist* this exact
 * shape, so owning the type here forced every one of them to store the column
 * as `unknown` / `v.any()`. Why the type exists at all is unchanged: a live
 * `ReturnsStrategy` closes over functions, so it can neither cross a worker
 * message boundary nor be written to a database; this plain-data config
 * travels, and the worker thread rehydrates it on the far side.
 */
export { buildReturnsStrategy, type ReturnsStrategyConfig } from "@control-ai/shared/sim";
