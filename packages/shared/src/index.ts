/**
 * Back-compatible root entry: the 3D world contracts, which is all this
 * package held before the simulation contracts arrived. Prefer the explicit
 * subpaths in new code — `@control-ai/shared/world` and
 * `@control-ai/shared/sim` — so a world-only consumer never pulls the
 * simulation contracts (and their `@control-ai/engine` types) into its graph.
 */
export * from "./world/index.js";
