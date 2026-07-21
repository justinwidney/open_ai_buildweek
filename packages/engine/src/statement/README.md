# statement

The monthly read model. `simulation/` computes a month; `statement/` reshapes a
`LifeStateSnapshot` plus optional `MonthDetail` into the UI-ready income, taxes,
spending, debt, cash flow, balance sheet, and planning picture. It does not
recompute simulation results.

## Current entry point

`buildMonthlyStatement({ snapshot, detail?, context? }) -> MonthlyStatement`.
Income/tax/spending are zero without detail; balances still come from the
snapshot. Context can supply household age/dependents and a safe-withdrawal rate.
Current income lines expose source label, gross, take-home, and total tax only.

## Detailed employment read-model target

Expand statement lines without making this domain own payroll rules:

- Add `personId`, occupation/employer ids, worker classification, compensation
  kind, pay frequency, and period/check identifiers to each income source line.
- Add a component breakdown for regular pay, overtime, shift differential,
  bonuses, commissions, tips, paid leave, reimbursements, and clawbacks.
- Add deduction lines for retirement, health/dental, HSA/FSA, pension, union
  dues, insurance, garnishments, and other post-tax deductions. Employer-paid
  benefits appear in a total-compensation view, not cash flow.
- Preserve tax lines by person/source/jurisdiction and distinguish withholding
  from estimated year-end liability/refund.
- Expose both exact received-this-month cash and clearly named normalized monthly
  expectations. Never replace one with the other.
- Include member-level and household-level rollups so multiple earners and side
  jobs reconcile without losing ownership.

Proposed additional read models are `PaycheckLine`, `IncomeComponentLine`,
`PayrollDeductionLine`, `BenefitLine`, and `CareerMonthSummary`. Keep the current
fields as household totals/backward-compatible views while clients migrate.

## Simulation/read-model rules

- A statement is a projection of immutable facts. Same snapshot/detail/context
  produces byte-for-byte equivalent values and ordering.
- Aggregate only pay events whose paid date/period belongs to the statement
  month. Fifth weekly/third biweekly checks, bonuses, and commission payouts are
  visible as separate checks and explain the higher month.
- Monthly total gross equals sum of paycheck gross, each paycheck gross equals
  sum of components, and gross plus signed deductions/taxes equals take-home.
- Household totals equal member totals, which equal source totals. Use stable
  deterministic sorting for members, sources, checks, and line items.
- A no-pay month may still contain employer benefits or deductions only when the
  source rule permits them. Zero, negative/clawback, and final-paycheck cases
  must remain explainable.
- Forward-looking distributions belong to `forecast/`; this domain may show
  normalized expected pay only when it is supplied as labeled context, never by
  inventing it from one observed month.

## Decision-panel output

The career/school modal should consume a separate comparison statement built
from scenario results, with consistent rows for current versus candidate:

- gross/take-home per check, exact and average monthly values, annual total
  compensation, taxes, deductions, benefits, and cash-flow impact;
- pay frequency, first/next pay, scheduled hours/rotation, overtime and variable
  pay, with low/expected/high scenarios delegated to forecast;
- household and selected-member totals, new education/commute/childcare costs,
  and a concise explanation of every material delta;
- provenance/assumption flags so regional catalog estimates are not confused
  with the player's signed employment terms.

## Reference data

Statements retain ids and version/provenance metadata from occupation, pay,
benefit, tax, and education inputs. Labels can be snapshotted for historical
display, but ids remain canonical. Formatting, localization, and search indexes
belong outside this domain.

## Tests and acceptance criteria

- Existing withholding identity, balance-sheet reconciliation, spending split,
  household age/context, tax-treatment grouping, and month-0 behavior remain.
- 52/26/24/12 pay schedules yield correct check counts and monthly placement;
  extra-paycheck and no-pay months display correctly.
- Component -> paycheck -> source -> member -> household rollups reconcile in
  cents; no tax/deduction/benefit line disappears during aggregation.
- Two earners, multiple jobs, bonus/commission, overtime, contractor pay,
  negative clawback, job start/end, and final paycheck retain attribution.
- Actual, normalized, and forecast values have distinct field names and UI
  labels; tests fail if one is substituted for another.
- Ordering is deterministic and a statement remains valid with no detail or
  missing optional catalog metadata.

## Dependencies and open questions

Depends on: `simulation/`, `income/`, `tax/`, `household/`, `physical-assets/`,
`expenses/`, `money/`, `types/`; scenario comparison consumes `forecast/`.

Decide backward-compatible field rollout, whether paychecks require exact dates,
how much catalog metadata to snapshot, whether annual total compensation belongs
on monthly statements, and where confidence/assumption explanations are built.
