# analysis

**Layer 5** of `LIFE_SIMULATION_MODEL.md` — the payoff. "Retrace a path, try
a different version, and find where the greatest divergence happened between
desired results at a certain age" resolves into three methods, all pure and
built on `goals/`.

## The three methods

- **A · temporal divergence** — `compareTrajectories(pathA, pathB, { metric })`.
  Where and by how much two lives separate: the fork month, the month of
  maximum divergence, and whether they're reconverging. "Where did life A and
  life B differ most?"
- **C · goal-relative gap** — `goalGapTrajectory(goal, path, ctx)`. Evaluates a
  goal at every month and finds the **age of maximum shortfall** — the literal
  "greatest divergence from desired results at a certain age."
- **B · counterfactual attribution** — `rankGoalImpacts(goal, baselineTerminal,
  counterfactuals, ctx)`. Ranks decisions by their impact on a goal, largest
  first. "Which choice mattered most?" — often a small recurring change
  (a contribution-rate tweak) beats a big one-time cost.

`divergenceReport(goal, baselinePath, variantPath, ctx)` bundles A + C for a
baseline-vs-variant comparison; run B alongside to name the culprit decisions.

## A path

A `Path` is a month-ordered `LifeStateSnapshot[]` — a run or a branch
materialized (via `resolveSnapshot` for a branch's shared prefix). Methods A/C
align on the months a path actually contains.

## Boundary: attribution is arithmetic, not a simulator

`rankGoalImpacts` takes the terminal snapshots the caller produced by re-running
each single-decision-flipped branch (`runSimulation` / `@control-ai/worker` /
`events.forkWithEvent`). Keeping the re-running out of this pure module is
deliberate — it needs the caller's returns strategy, reference data, and RNG.

## Acceptance

- `compareTrajectories` reports `forkMonth` = the first month the metric
  differs, and `maxDivergence` at the largest |A − B|.
- `goalGapTrajectory.maxShortfall` is the month with the largest positive
  `shortfallCents`, or null if the path is never behind.
- `rankGoalImpacts` orders counterfactuals by absolute impact and flags any
  that flip on-track status.

Depends on: `goals/`, `simulation/`, `money/`, `types/`.
