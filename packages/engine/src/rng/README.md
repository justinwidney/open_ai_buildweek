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

## Stream and replay contract (planned)

A single mutable sequence is insufficient once one life contains independent
market, job, health, housing, and event risks. Add deterministic stream
derivation from semantic coordinates such as:

`root seed + run/branch id + path id + domain + entity id + event id`

The derivation algorithm and its version are part of the run manifest. Streams
must be independent of traversal order: inserting a housing draw cannot change
later market or bonus draws, and reordering scenario options cannot change
their results. Preview comparisons use aligned stream coordinates across the
baseline and every option (common random numbers).

Long-running forecasts also need serializable RNG state or draw coordinates so
workers can chunk/resume without replaying prior months. Persist only a seed
fingerprint in user-facing explanations; raw seed/state belongs in protected
run metadata. Sampled material events record the realized value so committed
history is not resampled.

## Additional acceptance criteria

- Named child streams reproduce independently of creation and consumption
  order, including across worker chunk sizes.
- Forks share pre-fork outcomes and diverge only for coordinates changed by
  the decision or an intentionally different scenario seed policy.
- Tests cover stream isolation, derivation-version changes, state
  serialization/resume, option reordering, and common-random-number pairing.
