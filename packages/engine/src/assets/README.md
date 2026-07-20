# assets

Simple financial (cash/savings) balances — money that earns a plain
interest rate but isn't subject to market volatility or a `ReturnsStrategy`
the way `portfolio/` holdings are. This is the household's cash buffer:
where a paycheck's take-home lands and where expenses/debt payments draw
from before the simulation reducer decides whether to pull from the
portfolio instead.

## Entry point

`index.ts` — `FinancialAssetConfig`/`FinancialAssetState`/
`initialFinancialAssetState`, `tickFinancialAsset(state, netCashFlowCents)`
(grows the balance by one month of interest, then applies net
deposits/withdrawals, clamped at zero).

## Acceptance

- Interest is applied before that month's net cash flow, not after.
- Balance never goes negative — an overdraft is a decision for
  `simulation/` to handle (e.g. by drawing from the portfolio or flagging
  a shortfall), not something this module hides.

Depends on: `money/`.
