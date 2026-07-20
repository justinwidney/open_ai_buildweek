# types

Cross-domain leaf types with no logic and no dependencies on the rest of
`engine/src/` — every other folder may import from here, this folder
imports from nothing else in the package. Exists specifically to break
dependency cycles: e.g. `adjustable/` needs to know the shape of
`TaxBasisState` without depending on `tax/`'s actual bracket logic.

## Contents

- `month.ts` — `MonthKey` (an integer offset from a run's anchor date) and
  calendar-conversion helpers.
- `tax-basis.ts` — `FilingStatus` and `TaxBasisState`, the year-to-date
  accumulators (gross income, FICA wages, withholding, realized gains) that
  tax `Adjustment`s need to compute correctly across a calendar year.

## Acceptance

- No file in this folder imports from any sibling folder in `engine/src/`.
- Every type here is a plain interface/type alias — no functions with
  business logic (conversions and simple derivations like
  `monthKeyToDate` are fine; tax/return calculations are not).
