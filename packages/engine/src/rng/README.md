# rng

Seeded, deterministic randomness. Nothing anywhere in `engine/` (or its
dependents) may call `Math.random()` directly — every stochastic path
(Monte Carlo return sampling, a randomly chosen historical-backtest start
date) takes a `RandomSource` explicitly, so a run is reproducible from its
seed alone and safe to resume/parallelize across worker chunks without
re-deriving earlier draws.

## Entry point

`index.ts` — `RandomSource` (`next()` in `[0,1)`, `nextGaussian()` for
normal/lognormal sampling), `createRandomSource(seed)` (numeric or string
seed via `mulberry32`), and `seedFromString`.

## Acceptance

- `createRandomSource(seed)` given the same seed always produces the same
  sequence.
- No file under `engine/src/` calls `Math.random()`.

Depends on: nothing.
