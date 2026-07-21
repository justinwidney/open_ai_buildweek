# rules

The **life-graph rule engine** — the decision-tree *navigation* layer that
`LIFE_SIMULATION_MODEL.md` (Layer 5) and `events/README.md` name as the one
unbuilt piece: *"first-class preconditions/reversibility/unlocks for
decision-tree offering."* The financial kernel forks and ticks; `events/` turns
a chosen option into a diverged snapshot. This module decides **which
crossroads are reachable, and when** — so iteration through the years is a
branching tree of a few meaningful choices, not a decision every month.

## The model

- **`LifeContext`** — the durable, JSON-serializable position in the graph:
  `stage` (the coarse phase — `pre-launch`/`school`/`working`/`apprenticeship`/
  `gap-year`/`military`), `stageStartedMonth` (a per-stage timer), `flags` (the
  fine-grained memory a branch writes and later preconditions read, e.g.
  `{ major: "nursing", degreeEarned: true }`), and the resolved/blocked node id
  lists that gate re-firing. Nothing closes over a function, so a whole journey
  persists and replays by re-walking the graph.
- **`DecisionNode`** — a crossroads. Its `available(ctx)` returns a structured
  **`Eligibility`** (`{ eligible, reasons, warnings }`) — an ineligible node is
  *shown with reasons*, never silently dropped. Its `trigger` is either:
  - `milestone` — a structural fork you must resolve to move on (choose a path,
    declare a major, graduate, earn a ticket). It interrupts the year-by-year
    travel.
  - `opportunity` — optional enrichment (swap major, get a certification, buy a
    home) surfaced as something you *may* do, never forced.
  This split is what keeps most years decision-free while the pivotal moments
  still demand a choice.
- **`DecisionBranch`** — one option. It carries an optional `effect(ctx)` (the
  financial fork, an `EventEffect` from `events/`) and an `outcome` (the
  **context** transition: `setStage`, `mergeFlags`, `block`, `reopen`).

## The navigator (pure functions)

```ts
nextMilestone(graph, ctx)          // the one decision that must be resolved now, or null
availableOpportunities(graph, ctx) // optional decisions available now
availableDecisions(graph, ctx)     // everything eligible, major-before-minor
resolveBranch(ctx, node, branch)   // fold a chosen branch → new LifeContext (pure)
findNode / findBranch              // replay a persisted (nodeId, branchId)
```

The loop a caller runs: tick the sim forward a year → `advanceLifeContext` →
`nextMilestone`; if one is returned, present it, apply the chosen branch's
`effect` as a fork (`forkWithEvent`), and `resolveBranch` to advance the
context. `reopen` lets a gap year re-offer the root a year later without a
re-fire hack; `block` permanently removes a crossroads.

## Seed assumptions

The catalog's effect builders (`effects.ts`) assume the seed snapshot uses a
primary income id **`job`** and a cost-of-living expense id **`living`** — every
career change replaces `job`, and military/relocation reprice `living`. Build
the age-18 seed with those ids.

## `lifeGraph2026` — the age-18 tree

The concrete graph: **root** (college / work / trade / military / gap year) →
per-path spine of milestones (declare major → graduate → optional grad school;
entry track → cert/promotion; choose trade → journeyman ticket → master
license; choose branch → GI-Bill school or civilian) → path-independent,
age-gated **opportunities** (marriage, first home, first child, reusing the
`events/` catalog builders). A gap year loops back to the root at 19.

## Acceptance

- `resolveBranch` never mutates its input; a stage change resets the stage
  timer; `reopen` clears a node from resolved so it can fire again.
- A precondition never silently removes an option — an ineligible node/branch
  returns `reasons`.
- Walking the graph from a fresh 18-year-old reaches a credentialed, working
  adult on every root path, with the right milestones in order.

Depends on: `events/`, `contracts/`, `money/`, `types/`.
