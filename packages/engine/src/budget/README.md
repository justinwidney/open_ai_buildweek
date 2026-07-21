# budget

The plan-versus-actual surface. A `BudgetTarget` is a monthly total-spending cap,
savings-rate goal, and/or per-category/per-entity caps; `evaluateBudget` compares
it with a `MonthlyStatement` and ranks overages. It reports but does not mutate or
enforce the plan.

## Current entry point

`evaluateBudget(target, statement) -> BudgetReport`. Every target field is
optional. A line can match a spending category (`fixed`, `discretionary`, or
`debt`) or one expense id. The function is pure and stateless.

## Detailed career/school planning target

Pay cadence makes a single flat monthly budget misleading. Add an effective-
dated budget plan and a cash-calendar projection while preserving normalized
monthly comparison:

```ts
interface BudgetPlan {
  id: string;
  startMonth: MonthKey;
  endMonth?: MonthKey;
  targets: BudgetTarget;
  reservePolicy?: { minimumCashCents?: Cents; targetMonths?: number };
}

interface CashCalendarEntry {
  dateOrPeriod: string;
  kind: "pay" | "bonus" | "commission" | "deduction" | "expense";
  sourceId: string;
  expectedCents: Cents;
  range?: { lowCents: Cents; highCents: Cents };
}
```

The budget domain should compare alternatives without owning job/school rules:
consume income projections, tuition/debt/care costs, and statements; return
budget impact. Support household and per-person/source attribution, irregular
income reserve targets, and scenario labels such as work now, full-time school,
school plus part-time work, or commission-heavy role.

## Simulation rules

- Keep actual monthly cash exact. A fifth weekly or third biweekly paycheck
  belongs to the month received; do not smooth it out in actuals.
- Separately expose a normalized planning amount (annual expected cash / 12) and
  label it as an average. Never mix normalized and received cash in one field.
- Variable compensation gets low/expected/high or percentile scenarios. Only
  guaranteed pay can satisfy mandatory recurring obligations by default.
- Job start/end, unpaid training, tuition, benefits deductions, commuting,
  childcare, and student-loan payments begin in their effective month.
- Multi-earner household totals sum sources, but loss-of-income and schedule
  scenarios can be applied to one member/source without rewriting the others.
- Budget evaluations remain pure. Applying a chosen plan is a decision/event and
  triggers a new simulation branch.

## Decision-panel output

For each career/school tile, produce a comparable budget-impact read model:

- average monthly gross and take-home, first/next paycheck, pay frequency, and
  months with extra checks;
- required monthly costs (taxes, deductions, tuition, commuting, tools,
  childcare) and benefit offsets;
- expected monthly surplus/shortfall, savings rate, minimum cash balance,
  emergency-fund runway, and probability/range of a shortfall when pay varies;
- before/after line-item variances and the first month the plan goes negative;
- explicit warnings when expected bonuses/commissions are funding fixed costs.

## Reference data

Budget categories and scenario defaults should reference stable ids from income,
education, benefits, expenses, and regional cost datasets. Assumptions (pay
scenario, inflation basis, childcare/commute estimate, catalog version) must be
returned with comparisons so UI copy can explain them.

## Tests and acceptance criteria

- Existing behavior remains: empty target is on track; positive overage is
  flagged; savings target is inclusive; overages rank worst-first.
- Weekly/biweekly test calendars retain extra-paycheck months in actual cash but
  yield the correct annual/12 normalized amount.
- Work-now versus school scenarios include all income, tuition, debt, benefits,
  commute, and childcare changes from their effective months.
- Bonus/commission low, expected, and high cases are deterministic and never
  treated as guaranteed unless configured.
- Two earners aggregate correctly; removing one job affects only its owner/source.
- Zero income, negative net cash flow, no spending, partial month, job loss,
  overlapping budget plans, and missing estimates produce defined results.
- Every decision-panel total reconciles to its component lines and names whether
  it is actual, normalized, or projected.

## Dependencies and open questions

Depends on: `statement/`, `income/` projections, `money/`, `types/`, education,
expenses, benefits, debt, events, and forecast/scenario comparison.

Decide whether intramonth dates are first-class, how probability ranges are
computed, whether reserve funding is advisory or automatic, and the default
conservatism for uncertain commissions/bonuses.
