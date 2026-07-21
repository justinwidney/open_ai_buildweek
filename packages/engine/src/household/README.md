# household

Who the simulation is *for* — Layer 1 of `LIFE_SIMULATION_MODEL.md`. A
`Household` is the primary person, an optional spouse, and any dependents,
plus the filing status. Ages are stored as a **birth-month offset from run
month 0**, so everyone ages automatically as the run ticks — the anchor for
contribution catch-ups, RMDs, Social Security timing, and "desired results at
a certain age."

## Entry point

`index.ts`:

- `ageYearsAt(birthMonth, month)` · `primaryPerson(household)` ·
  `dependentsUnderAge(household, month, maxAge)`.
- `qualifyingChildrenForCtc` / `childTaxCreditCents` — base child tax credit
  (children under 17 × $2,000; MAGI phase-out not modeled).
- `householdContextAt(household, month)` — the month-specific bundle a
  statement/tax layer wants: filing status, primary/spouse age, dependent
  count, children under 13 (childcare population), and the CTC estimate.

`statement/`'s context accepts a `Household` and reports the primary person's
age, dependent count, and CTC estimate in its planning block.

## Notes

- This layer *represents* the household and derives facts from it. It does not
  yet feed the CTC into federal withholding or auto-create childcare expenses —
  those are follow-ups (a tax-integration step and a Layer-2 event
  respectively). Filing status still lives on `taxBasis`; a household is the
  intended source of truth for it, reconciled when the two are wired together.

## Acceptance

- A 30-year-old at month 0 (`birthMonth: -360`) is 30 at month 0 and 31 at
  month 12.
- The CTC counts only `kind: "child"` dependents under 17, at the per-child
  amount.

Depends on: `money/`, `types/`.
