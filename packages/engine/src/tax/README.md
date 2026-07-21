# tax

Federal, state, and payroll tax logic built as `Adjustment`s, plus standalone
capital-gains and Social Security benefit calculations. Rates, brackets, wage
bases, and thresholds come from `reference-data/`, never literals in this folder.

## Current entry point

`index.ts` re-exports federal, state, Social Security, and Medicare withholding;
401(k) pretax deferral; long-term capital-gains and NIIT calculations; and Social
Security benefit taxability. Paycheck adjustments currently use cumulative-year
differencing (`tax(YTD after) - tax(YTD before)`), which handles monthly raises,
bonuses, and job changes. Ordering matters: pretax deductions run before taxes.

## Detailed employment tax model/API target

Tax inputs must describe pay events rather than only a monthly blended gross:

```ts
interface TaxablePayEvent {
  id: string;
  personId: string;
  sourceId: string;
  paidOn: CalendarDate;
  jurisdiction: TaxJurisdiction;
  workerClass: "employee" | "contractor";
  components: readonly TaxablePayComponent[]; // regular, overtime, bonus, commission...
  deductions: readonly PayrollDeduction[];
}
```

Each component/deduction needs federal-, state-, Social-Security-, Medicare-, and
self-employment-tax treatment. Add per-person/per-source YTD ledgers for wages,
withholding, deductions, annual limits, and employer contributions. Household
filing facts come from `household/`; elections such as W-4 extra withholding or
multiple-jobs adjustment are effective-dated inputs.

## Simulation rules

- Apply withholding on the actual weekly, biweekly, semimonthly, or monthly pay
  event using the jurisdiction's published method. Monthly aggregation happens
  after each event; extra-paycheck months must not be taxed as a monthly salary.
- Supplemental wages (bonuses/commissions) use the configured jurisdiction rule
  and still count toward YTD wage bases. Negative commission adjustments/clawbacks
  need a defined refund/carry-forward policy.
- Hourly, salary, and contract classification affects FICA/self-employment tax,
  deductible expenses, benefits, and withholding. Never infer classification
  from the label.
- Annual Social Security wage bases and retirement/HSA/FSA limits apply per
  correct taxpayer/employer scope. Multiple jobs share person-level limits while
  preserving source attribution; employer match does not reduce take-home.
- Pretax eligibility differs by tax type. Replace the current simplified shared
  exclusion set when reference rules support federal/state/FICA distinctions.
- Job changes, marriage, moves, residency/work-state splits, school credits, and
  dependent changes take effect on defined dates/months and do not rewrite prior
  withholding. Estimated tax and year-end liability/refund should remain distinct
  from payroll withholding.
- Every result is deterministic for the same events/reference-data version and
  reconciles to signed integer-cent line items.

## Decision-panel output

Career/school comparisons need player-facing estimated federal, state/local,
FICA or self-employment tax, employee pretax deductions, take-home per paycheck,
average monthly take-home, effective/marginal rates, and expected year-end
liability/refund. Explain how bonuses, commissions, contractor status, school
credits, and a second household earner change the result. Mark estimates and
missing jurisdiction data; do not present withholding as guaranteed final tax.

## Reference data

Version by tax year and jurisdiction: income brackets, standard deductions,
allowances/credits, withholding tables/methods by pay frequency, supplemental
wage rules, FICA rates/bases, self-employment rules, state/local reciprocity and
residency rules, contribution limits, and education credits. Records need source,
effective dates, rounding method, and fallback behavior. A saved run pins its
data version.

## Tests and acceptance criteria

- Existing progressive federal, FICA wage-base, additional Medicare, state
  archetype, 401(k) limit, capital-gains, NIIT, and Social Security tests remain.
- Equivalent annual guaranteed pay on 52/26/24/12 schedules reaches the expected
  annual liability within the jurisdiction's documented rounding tolerance.
- A third biweekly check, bonus, commission, overtime, and job change update YTD
  ledgers correctly and reconcile every paycheck gross-to-net.
- Two jobs for one person share applicable annual wage/deferral limits; spouses'
  person-level limits remain separate while joint filing uses household totals.
- Employee versus contractor scenarios produce the expected FICA/self-employment
  treatment and no accidental employer benefits for the contractor.
- Test negative/zero pay, clawbacks, annual-limit crossing mid-check, midyear
  marriage/move, multiple states, missing local data, and calendar-year rollover.
- No rate, bracket, threshold, or rounding rule is silently hard-coded.

## Dependencies and open questions

Depends on: `adjustable/`, `income/` pay events, `household/`, `reference-data/`,
`money/`, `types/`, and calendar utilities.

Decide the first supported countries/states/localities, whether simulation needs
exact calendar dates, which official withholding method is authoritative, how
year-end filing/refunds are evented, contractor expense scope, and whether tax
advice disclaimers/estimate confidence belong in engine metadata or UI copy.
