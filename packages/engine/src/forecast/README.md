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

## Crossroads forecasts (planned)

The large popup needs a scenario forecast API rather than calling independent
single-option forecasts. Its input is one resolved baseline plus several
versioned event plans, a horizon, metrics, assumptions, path count, and a root
seed. Its output groups results by stable scenario id and includes baseline,
delta-to-baseline, monthly percentile bands, terminal distribution, goal
probabilities, downside/ruin risk, and important warnings.

Scenario comparisons must use **common random numbers**: path `i` for every
option receives aligned named streams for market, employment, health, housing,
and other risks. This reduces comparison noise and makes the displayed delta
about the decision. Adding/reordering options must not perturb an existing
option's path. Stream derivation therefore uses semantic ids, never array
position alone.

Preview can expose quality tiers (for example deterministic/low-path quick
preview followed by a high-path detailed forecast), but every result identifies
its method, path count, horizon, seed fingerprint, data/engine versions, and
completion status. Cached results are keyed by the normalized baseline,
serialized event plan, assumptions, versions, and seed policy.

Uncertainty is broader than market returns. Future distributions should accept
domain risk models for raises/bonus/commission, job loss, rent and property
cost growth, repairs, insurance/tax changes, appreciation/depreciation, and
interest rates. Forecast aggregation must retain enough tagged path detail to
explain which risks drive an option's range without exposing random internals
to the UI.

## Additional acceptance criteria

- Reversing option order or adding an unrelated option leaves existing
  scenario results unchanged.
- Baseline and scenarios have the same month grid and path count; percentile
  deltas reconcile to the documented comparison method (paired-path deltas,
  not subtraction of unrelated percentiles).
- Partial/cancelled forecasts are labeled and cannot be committed as if final.
- Tests cover zero-volatility collapse, multi-risk uncertainty, cache-key
  invalidation on version/assumption changes, paired scenario deltas, and
  deterministic reruns across worker chunking.
