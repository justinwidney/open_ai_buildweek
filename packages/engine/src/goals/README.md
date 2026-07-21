# goals

**Layer 4** of `LIFE_SIMULATION_MODEL.md` — the "desired result at a certain
age" the whole simulator measures against. Without a first-class goal there's
nothing to be on or off track *relative to*; Layer 5's divergence analysis is
built directly on this.

## The model

A `Goal` is a target metric + a due date (`byAge` or `byMonth`) + `real`
(inflation-adjusted?) + priority. Six metrics: `netWorth`, `liquidNetWorth`
(excludes home equity + mortgage), `retirementIncome` (investable balance ×
withdrawal rate), `collegeFund` (529 balances), `homeEquity`, and `debtFree`
(the one lower-is-better metric).

## Entry point

`index.ts`:

- `metricValueCents(metric, snapshot, ctx)` — the current value of any metric.
- `evaluateGoal(goal, snapshot, ctx)` → `GoalProgress`: `achieved`,
  `progress`, `surplusCents`/`shortfallCents` (signed distance in the metric's
  good direction), and the due-date target. **Sweeping this across a run's
  months is the goal's gap trajectory** — the age of maximum `shortfallCents`
  is exactly the "greatest divergence from desired results" the product wants.
- `goalOutcomeDistribution(goal, terminalSnapshots, ctx)` → `GoalOutcome`: the
  **on-track probability** and metric spread across a Monte Carlo forecast's
  `terminalSnapshots`. This generalizes the forecast's net-worth-only
  `successProbability` to any goal.
- `nominalTargetCents` / `resolveTargetMonth` — real-target inflation and
  age→month resolution.

## Notes

- `real` targets are stated in month-0 dollars and inflated to their due date
  (default 3%) before comparison, so inflation can't quietly undershoot them.
- `retirementIncome` is an annual income (balance × SWR), not a balance;
  `debtFree`'s target is usually 0 and it's achieved when debt is at/under it.

## Acceptance

- A higher-is-better goal is `achieved` when the metric ≥ target; `debtFree`
  when total debt ≤ target.
- `shortfallCents` is 0 when at/ahead of target and positive when behind.
- `goalOutcomeDistribution`'s `onTrackProbability` matches the fraction of
  terminal snapshots meeting the goal.

Depends on: `simulation/`, `physical-assets/`, `forecast/` (percentile), `money/`, `types/`.

## Crossroads integration (planned)

Major-decision previews should report effects on all active goals, not only net
worth. For each option and goal the engine should return the baseline and
option target-month value, shortfall/surplus delta, projected completion month,
and probability of success when forecast paths are available. Results must say
whether values are nominal or real and which inflation/withdrawal assumptions
were used.

Goals also need lifecycle state: draft/active/paused/completed/abandoned,
created/effective months, ownership (person or household), contribution source,
priority, and a versioned target history. A later target edit must not rewrite
earlier evaluations. Dependencies and conflicts should be explicit (for
example, a down-payment goal funding a home event, or two goals competing for
the same monthly surplus).

For long horizons, show uncertainty rather than a false single completion
date: percentile target values, on-track probability, and the assumptions or
events driving the spread. Goal evaluation remains pure; allocation and
trade-off policy belongs in a separately testable planner rather than being
hidden in the metric calculation.

## Additional acceptance criteria

- Baseline and option goal impacts use the same target version, effective
  month, horizon, reference-data bundle, and aligned forecast paths.
- A target revision creates a new version and historical progress remains
  reproducible under the old one.
- Tests cover goal funding by a committed event, paused goals, competing-goal
  disclosures, real/nominal presentation, and deterministic goal comparisons.
