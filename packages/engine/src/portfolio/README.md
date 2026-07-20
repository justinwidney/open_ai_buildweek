# portfolio

Investment holdings that grow under a pluggable `ReturnsStrategy` (fixed,
Monte Carlo, or historical backtest — see `returns/`), track cost basis
separately from market value, and realize capital-gains tax on withdrawal
via `tax/longTermCapitalGainsTaxCents`. This is where "portfolio" as a
top-level domain from the user's request lives, separate from `assets/`
(plain interest-bearing cash) and `physical-assets/` (house/car).

## Entry point

`index.ts` — `HoldingConfig`/`HoldingState`/`PortfolioState`/
`initialHoldingState`, `tickHoldingGrowth(state, returnsStrategy, month,
rng)` (growth never touches cost basis), `applyContribution` (raises
balance and cost basis equally — no gain), `withdrawFromHolding(state,
requestedCents, ctx)` (realizes gain proportionally using an
average-cost-basis model, taxes only the gain via `tax/`, caps at the
available balance), and `portfolioViews(state)`.

## Acceptance

- Growth changes `balanceCents` but never `costBasisCents`; contributions
  change both equally; only a withdrawal can create a realized gain.
- `withdrawFromHolding` never withdraws more than the holding's balance,
  and `netProceedsCents === grossWithdrawalCents - capitalGainsTaxCents`
  always holds.
- The cost-basis model is average-cost, not specific-lot/FIFO/LIFO —
  documented here as a known simplification, not silently assumed.

Depends on: `returns/`, `tax/`, `adjustable/` (for `AdjustmentContext`),
`money/`.
