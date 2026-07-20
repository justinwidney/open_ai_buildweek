# tax

Federal/state/payroll tax logic, built as `Adjustment`s (see `adjustable/`)
plus a few standalone functions for tax events that don't fit a paycheck
pipeline (capital gains on a portfolio withdrawal, Social Security benefit
taxability). Every rate/bracket/threshold used here comes from
`reference-data/`, never a literal hard-coded number in this folder.

## Entry point

`index.ts` re-exports:
- `federalIncomeTaxAdjustment()`, `ficaSocialSecurityAdjustment()`,
  `ficaMedicareAdjustment()`, `stateTaxAdjustment(stateCode)` — paycheck
  pipeline steps. All three tax adjustments withhold using a
  **cumulative-year differencing** method (`tax(YTD after) - tax(YTD
  before)`) rather than annualizing a single month in isolation, so
  withholding lands on the correct annual total even when income varies
  month to month (raises, bonuses, a job change).
- `retirement401kPretaxAdjustment(options)` — pretax deferral, capped at
  the IRS annual limit; must be ordered *before* the tax adjustments in an
  `Adjustable.adjustments` array (see `PRETAX_DEDUCTION_KEYS`) so they see
  and exclude it from taxable wages.
- `longTermCapitalGainsTaxCents`/`netInvestmentIncomeTaxCents` — for
  `portfolio/`'s withdrawal logic, not a paycheck pipeline; gains stack on
  top of ordinary income for bracket purposes.
- `taxableSocialSecurityBenefitCents` — the provisional-income test for how
  much of a Social Security benefit is federally taxable.

## Acceptance

- No literal tax rate/bracket/threshold is hard-coded in this folder —
  everything reads from `ctx.referenceData`.
- Every `Adjustment` here is order-sensitive-safe: it only reads *prior*
  line items (via `sumLineItems`/`findLineItem`), never assumes a specific
  adjustment ran regardless of pipeline order.
- Documented simplifications (no state standard deduction, no age-based
  catch-up, MAGI approximated for NIIT) are called out in comments, not
  silently baked in.

Depends on: `adjustable/`, `reference-data/`, `money/`, `types/`.
