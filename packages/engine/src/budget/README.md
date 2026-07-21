# budget

The **plan vs actual** surface — Layer 1 of `LIFE_SIMULATION_MODEL.md`. A
`BudgetTarget` is the user's monthly plan (a total-spending cap, a
savings-rate goal, and/or per-category and per-line caps); `evaluateBudget`
compares it against a `MonthlyStatement`'s actuals and reports every
variance, worst overage first. This is the hand-holding a planner needs:
*"you're $120 over your dining budget and 4 points under your 20% savings
goal this month."*

## Entry point

`index.ts` — `evaluateBudget(target, statement) → BudgetReport`. Every part
of the target is optional; only the checks it specifies appear in the report.
`onTrack` is true when nothing is over budget and the savings goal (if set) is
met; `overBudgetLines` is the ranked "here's what to fix" list.

Budget line targets match either a whole spending **category** ("fixed" |
"discretionary" | "debt") or a single **entity** by its expense id.

## Notes

- This layer *reports*; it does not enforce. Changing a budget to steer future
  months is a decision/fork (Layer 2–3) that re-runs the simulation — the
  report just tells the user (and later, the divergence analysis) how a month
  landed against plan.
- Pure and stateless: same target + statement → same report.

## Acceptance

- A line whose actual exceeds its cap is flagged `overBudget` with a positive
  `varianceCents`; one at or under is not.
- `savingsRate.met` is true iff the statement's actual rate ≥ the target.
- `onTrack` is false if any specified check fails, true for an empty target.

Depends on: `statement/`, `money/`, `types/`.
