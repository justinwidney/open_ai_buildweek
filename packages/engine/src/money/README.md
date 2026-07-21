# money

Integer-cents money arithmetic — the one representation every other folder
in `engine/` must use for anything denominated in currency. See the
"Money" section of the top-level engine README/plan for why this beats
floating-point dollars, a decimal library, or `bigint` by default.

## Entry point

`index.ts` — `Cents`, `cents()`/`toDollars()` (the only two places dollars
should ever be converted to/from cents), `addC`/`subC`/`applyRate`,
`allocate()` (largest-remainder proportional split), and `assertSafe()`.

## Acceptance

- No file outside `money/` performs raw `+`/`-`/`*` on a `Cents` value
  without going through these helpers.
- `allocate()` output always sums to exactly its input `total`.
- Every function that produces a new `Cents` value calls `assertSafe`
  (directly or via another helper here) before returning it.

Depends on: nothing.

## Detailed life-sim requirements

Crossroads previews introduce many totals that players will compare directly:
annual salary versus each paycheque, mortgage principal and interest, closing
cash, property tax, commissions, benefit value, and long-range projections.
All of them must still reconcile to integer cents.

Planned additions should stay deliberately small:

- `MoneyRange` (low/expected/high cents) for uncertainty read models. A range
  is not a balance and must never be fed back into accounting as if it were an
  observed amount.
- Explicit helpers for converting annual or irregular amounts into scheduled
  allocations using an actual pay/calendar schedule. Do not implement
  biweekly pay as `annual / 12`, and do not round every intermediate value
  independently.
- Percentage, basis-point, and per-unit helpers with named rounding policy for
  mortgage rates, commissions, tax mill rates, and insurance rates.
- Optional currency identity at import/display boundaries if multiple
  currencies enter scope. Until conversion is implemented, mixed currencies
  must be rejected rather than silently added.
- Formatting metadata belongs in the client; this module returns cents and
  never locale-formatted strings.

## Crossroads output rules

- One-time cash, recurring cash flow, balances, and projected deltas are
  separate fields even when they share a display card.
- Expected values and percentile/range values are labeled and typed
  differently from guaranteed amounts.
- Negative values retain their accounting sign. Whether the UI labels them as
  a cost, saving, inflow, or outflow belongs to the read-model contract.
- A displayed total such as "monthly housing cost" must be reproducible by
  `addC()` over the disclosed component values.
- Annual-to-pay-period allocation must sum back to the exact annual amount
  across a full schedule, including 26-pay-period years and partial first
  years.

## Additional acceptance tests

- Weekly, biweekly, semimonthly, monthly, annual, and irregular allocations
  conserve the source total to the cent.
- Largest-remainder allocation is stable when two components have equal
  fractional remainders.
- Rate calculations cover negative adjustments, zero, boundary rates, and the
  configured safety ceiling.
- Any future foreign-exchange conversion records its rate, effective time,
  source/target currencies, and rounding result in an auditable breakdown.
