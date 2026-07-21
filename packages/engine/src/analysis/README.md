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

## Popup-facing scenario comparison (planned)

`analysis/` should turn raw paths and forecast distributions into a stable,
UI-neutral comparison model. For each option it should provide:

- immediate cash and affordability/eligibility status;
- month-by-month and annualized deltas by named category (gross pay, taxes,
  housing, insurance, debt service, discretionary cash, assets, liabilities,
  net worth, and active goals);
- break-even month, worst cash month, maximum divergence, terminal delta, and
  goal success deltas;
- uncertainty intervals and paired-path probabilities such as “option A ends
  ahead of baseline”; and
- explanation records containing formula inputs, assumption/source ids, and
  the event or entity that caused each delta.

Comparison calculations operate on stable metric/category ids; display labels,
currency formatting, search ranking, and popup layout stay outside the engine.
Missing or non-comparable data is explicit, never coerced to zero. Analysis
also reports material caveats (short horizon, stale reference data, low path
count, unsupported tax jurisdiction) so the popup can show them beside the
claim they qualify.

Attribution distinguishes known contractual cash flows, model assumptions,
and sampled uncertainty. It must not imply causal certainty merely because two
branches diverge; single-decision counterfactuals and paired forecast paths are
identified as model-based estimates.

## Additional acceptance criteria

- Every headline comparison reconciles to monthly detail categories and links
  to at least one explanation record.
- Scenario ordering does not change values; ties use a stable documented rule.
- Paired-path statistics use aligned seeds and reject incompatible scenario
  manifests rather than comparing them silently.
- Tests cover a career pay-cadence comparison, rent/buy break-even analysis,
  a scenario with missing jurisdiction data, and nominal versus real metrics.
