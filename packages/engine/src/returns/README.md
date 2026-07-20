# returns

One `ReturnsStrategy` interface unifying the three modes the user asked
for — fixed, Monte Carlo, and historical backtest — so `portfolio/` (and
the simulation kernel) never branch on which mode is active. Every
strategy is pure given its `ReturnRequest` (including the caller-supplied
`RandomSource`'s current state); none of them read `Math.random()` or any
other hidden global, which is what keeps a run reproducible from its seed
alone.

## Entry point

`index.ts` — `ReturnsStrategy`/`ReturnRequest`/`ReturnResult`,
`createFixedReturnsStrategy(annualRatesByAssetClass)`,
`createMonteCarloReturnsStrategy(distributionsByAssetClass)` (lognormal
sampling from annual mean/volatility — the standard model for this kind of
tool, and it can't assign probability to a return below -100% the way a
plain normal distribution technically can), and
`createHistoricalBacktestStrategy(options)` (replays a real dated annual
sequence from `reference-data/historical-returns.ts`, spreading each
year's figure evenly across its 12 months; wraps back to the dataset's
first year rather than erroring once a run outlives the dataset's span).

`annualToMonthlyRate` converts an annual rate to its true monthly
compounding equivalent (`(1+annual)^(1/12) - 1`), used consistently instead
of a flat `/12` division, which would silently under/overstate compounding
over a multi-decade run.

## Acceptance

- No strategy calls `Math.random()`; the fixed strategy doesn't even read
  its `rng` argument.
- The same seed always reproduces the same Monte Carlo sample path.
- The historical-backtest strategy's output for a chosen start year
  matches the real annual figure in `reference-data/` for that year (e.g.
  2008's real drawdown, 2009's real recovery), not an approximation of it.

Depends on: `rng/`, `reference-data/`, `types/`.
