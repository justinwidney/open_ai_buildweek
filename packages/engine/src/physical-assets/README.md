# physical-assets

Non-financial owned assets with a value that changes over time — a house
(appreciating), a car (depreciating) — plus a flat monthly upkeep cost.
Deliberately doesn't know about `debts/` directly (no import from that
folder): a physical asset only records an *optional* `linkedDebtId`, and
`simulation/` is the layer that looks up that debt's remaining balance and
passes it into `computeEquityCents`. This keeps the two folders decoupled
so a physical asset can exist without a loan (paid in cash) and a debt can
exist without a linked physical asset (e.g. a personal loan).

## Entry point

`index.ts` — `PhysicalAssetConfig`/`PhysicalAssetState`,
`currentPhysicalAssetValueCents(config, currentMonth)` (annual
compounding, positive rate for appreciation, negative for depreciation),
`computeEquityCents(currentValueCents, linkedDebtRemainingBalanceCents?)`.

## Acceptance

- Value compounds annually from the purchase price and month, the same
  technique as income growth and expense inflation elsewhere in the
  engine — one compounding convention, not three.
- `computeEquityCents` with no linked-debt balance returns the full
  current value.

Depends on: `money/`, `types/`.
