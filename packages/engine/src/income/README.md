# income

Income sources modeled as `Adjustable`s: a raw monthly gross amount (with
annual growth for raises/COLA) run through the pretax-deferral and tax
pipeline from `tax/`, then assembled into the named views the user asked
for: gross, after-payroll-deductions, after-tax, tax-free, Social-Security
wages, and take-home.

## Entry point

`index.ts` — `IncomeSourceConfig`/`IncomeState`/`isIncomeActive` (an
income source only counts between its `startMonth` and optional
`endMonth`, so "choosing a job" in a decision can add or end a source
mid-run), `buildIncomeAdjustable(state, currentMonth)`, and
`incomeViews(result)`.

## Acceptance

- `incomeViews` never invents a number — every field is derived from
  `resolveAdjustable`'s line items via `findLineItem`, so it can never
  drift out of sync with what was actually withheld.
- `takeHomeCents <= afterTaxCents <= afterPayrollDeductionsCents <=
  grossMonthlyCents` always holds.
- Growth compounds annually (once per 12 simulated months active), not
  monthly, matching how raises/COLA actually work.

Depends on: `adjustable/`, `tax/`, `money/`, `types/`.
