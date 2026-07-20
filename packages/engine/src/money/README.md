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
