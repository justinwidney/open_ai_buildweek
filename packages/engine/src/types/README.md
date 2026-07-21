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

## Detailed-simulator boundary

This folder remains limited to the original foundational month/calendar and
tax-basis types. The broader portable vocabulary identified during planning is
now implemented in `contracts/`: stable/versioned references,
`EffectivePeriod`, provenance and validation, pay cadence and work rotations,
major/minor decisions, preview/session shapes, and catalog queries.

Keeping those related public contracts together avoids turning this leaf
folder into a miscellaneous dumping ground while preserving the same
dependency rule: domain behavior stays in its owning module, and portable
contracts contain no UI callbacks or executable samplers.

## Acceptance

- Month and tax-basis contracts round-trip without losing month keys, filing
  status, or year-to-date values.
- Dependency checks continue to prove that `types/` imports no sibling engine
  domain and contains no catalog lookup, formulas, sampling, or UI behavior.

- No file in this folder imports from any sibling folder in `engine/src/`.
- Every type here is a plain interface/type alias — no functions with
  business logic (conversions and simple derivations like
  `monthKeyToDate` are fine; tax/return calculations are not).
