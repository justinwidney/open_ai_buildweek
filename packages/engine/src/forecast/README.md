# forecast

Multi-path Monte Carlo aggregation. `simulation/` computes **one** life as a
deterministic sequence of monthly snapshots; a *forecast* runs many such
lives — each with its own RNG stream but the same starting point and
decisions — and summarizes the spread of outcomes into per-month percentile
bands plus terminal success/ruin probabilities. This is the "range of
possible futures" view a planning UI charts, versus `simulation/`'s single
authored path.

## Entry point

`index.ts` — `runMonteCarloForecast(params)` returning per-month
`bands` (mean + requested percentiles of net worth), the full ascending
`terminalNetWorthCents` distribution, a `successProbability` (fraction of
paths whose final net worth clears `goalCents`), and a `ruinProbability`
(fraction that dipped below zero at any month). Also re-exports the
`percentileOfSorted` / `meanOf` helpers it's built on.

Each path derives a distinct child seed from the base `seed`
(`${seed}:path:${i}`), so a whole forecast is reproducible: the same
`(seed, paths, monthsToSimulate)` yields byte-identical bands.

## Notes

- Pass a **Monte Carlo** returns strategy for a real distribution; a fixed
  strategy makes every path identical and collapses the bands to one line.
- This is pure engine code — no `Math.random`, no Node/native imports — so
  it runs the same in a worker, a server, or a client-side preview. Running
  N long paths is CPU-bound; `@control-ai/worker` is the place to move a
  large forecast off the main thread, not here.

## Acceptance

- Same `(seed, paths, months)` reproduces identical `bands` and
  `terminalNetWorthCents`.
- Percentiles are monotonic within a month (P10 ≤ P50 ≤ P90) and each band
  has one entry per requested percentile.
- With volatility present, higher percentiles fan out above lower ones as
  the horizon lengthens (the bands widen over time).

Depends on: `simulation/`, `returns/`, `rng/`, `reference-data/`, `types/`.
