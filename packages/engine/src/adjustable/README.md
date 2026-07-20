# adjustable

The one shared mechanism behind every "total / after-tax / after-payroll /
tax-free / ..." style derived view the simulation needs — for income, and
reused as-is for expenses, debts, and physical-asset upkeep. An `Adjustable`
is a raw monthly `grossCents` plus an ordered pipeline of `Adjustment`s;
`resolveAdjustable` runs the pipeline once into a flat list of signed
`LineItem`s that always reconcile exactly to `netCents`. Each domain then
supplies its own thin "view assembler" over those line items (see
`income/views.ts` for the reference example) rather than reimplementing
the pipeline mechanics.

## Entry point

`index.ts` — `Adjustment`, `LineItem`, `Adjustable`, `AdjustableResult`,
`AdjustmentContext`, `resolveAdjustable`, and the `findLineItem`/
`sumLineItems` lookup helpers later adjustments use to see earlier ones
(e.g. a federal-tax adjustment excluding a pretax 401(k) deferral computed
earlier in the same pipeline).

`AdjustmentContext` is deliberately minimal (month, rng, reference data,
tax basis) rather than the full simulation snapshot — that's what lets this
folder stay a leaf dependency of `simulation/`, not the reverse.

## Acceptance

- `resolveAdjustable(...).netCents` always equals
  `grossCents + sum(lineItems.map(li => li.amountCents))` — enforced via
  `money/`'s `addC`, never hand-summed.
- Adjustment order is caller-controlled and later adjustments may depend on
  earlier ones via `findLineItem`/`sumLineItems`; nothing here reorders or
  memoizes across calls.

Depends on: `money/`, `types/`, `rng/`, `reference-data/`.
