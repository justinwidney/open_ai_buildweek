import type { LifeContext } from "./context.js";
import type { DecisionNode, LifeGraph } from "./graph.js";

/**
 * Roll this year's chance events. Walks the graph's `random`-trigger nodes in
 * order and returns the first one that is eligible *and* clears its
 * `annualProbability` against the supplied RNG — at most one surprise per year,
 * so a single travelled year never buries the player in popups.
 *
 * The RNG is the caller's, seeded per (run, year), so a resumed life re-rolls
 * identically. Order the catalog most-disruptive-first: a layoff should win the
 * year over a tax refund.
 *
 * A node already resolved or blocked (a once-per-life event that was handled or
 * dismissed-with-block) is skipped, which is how `oncePerLife` is enforced.
 */
export function rollYear(graph: LifeGraph, ctx: LifeContext, rng: () => number): DecisionNode | null {
  for (const node of graph.nodes) {
    if (node.trigger !== "random" || !node.chance) continue;
    if (ctx.resolvedNodeIds.includes(node.id) || ctx.blockedNodeIds.includes(node.id)) continue;
    const reviewMonth = ctx.deferredNodeUntilMonth?.[node.id];
    if (reviewMonth !== undefined && ctx.month < reviewMonth) continue;
    if (!node.available(ctx).eligible) continue;
    // Draw once per candidate so probabilities are independent and stable given the seed.
    if (rng() < node.chance.annualProbability) return node;
  }
  return null;
}

/** All `random`-trigger nodes in a graph, for tests and catalog inspection. */
export function randomEvents(graph: LifeGraph): readonly DecisionNode[] {
  return graph.nodes.filter((node) => node.trigger === "random");
}
