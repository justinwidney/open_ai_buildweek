# @control-ai/worker

Background computation for the simulation engine, using
[piscina](https://github.com/piscinajs/piscina) for a small, maintained
`worker_threads` pool rather than a hand-rolled one.

## Scope

Handles exactly one kind of work: **extending a run's horizon or creating a
branch**, i.e. computing months that don't exist yet. Scrubbing
already-computed history is deliberately *not* this package's job — that's
a plain indexed read through `@control-ai/db` from whichever layer renders
the timeline, with no worker involved, because it should be instant.

## Design note: computation and persistence are split across threads on purpose

The original design (see the top-level plan) called for persisting
directly from inside the worker thread. Building it surfaced a real reason
not to: this project's zero-install local/test database
(`@electric-sql/pglite`) does not support concurrent access to the same
data directory from multiple threads or processes — a worker thread
opening its own PGlite connection would work in production against real
Postgres but silently break local dev and every test. So `tick-worker.ts`
(the actual code that runs on the pool's OS thread) does **only** pure,
CPU-bound computation — no `@control-ai/db` import, no native driver —
mirroring `@control-ai/engine`'s own "zero Node-only/native deps" rule one
level up. `orchestration.ts`, running on the caller's thread, receives the
fully-computed, plain-data `RunSimulationResult` back from the pool and
persists it through a single shared `@control-ai/db` connection — the
normal pattern for a pooled/embedded database connection regardless of
which driver is behind it.

A job (`{ fromSnapshot, monthsToCompute, returnsStrategyConfig, seed }`)
computes in bounded chunks (default 60 months, via `extendRun`'s
`chunkMonths`) rather than the whole requested horizon eagerly — "zoom
ahead" to month 900 doesn't need 75 years precomputed up front, and a
crash partway through a long extension leaves every already-persisted
chunk durably saved. A small `jobs` table (in `@control-ai/db`'s schema,
exposed via `enqueueJob`/`updateJobStatus`/`getJob`) tracks
`queued | running | done | error` per extension so a caller can poll "is
month X ready yet." Creating a branch (`branchRun`) only ever computes
`forkMonth + 1 → toMonth` — never the shared prefix with its parent.

## Entry point

`index.ts` — `createPool()`, `extendRun(pool, db, params)`,
`branchRun(pool, db, params)`, `buildReturnsStrategy` (reconstructs a real
`ReturnsStrategy` from the serializable `ReturnsStrategyConfig` a job
payload carries, since strategies close over functions and can't cross a
`worker_threads` message boundary directly).

## Demo / test

```sh
pnpm --filter @control-ai/worker test
```

Dispatches a real computation job through an actual worker thread (proving
the `piscina` + `tsx`-loader plumbing works end to end), then exercises
`extendRun`/`branchRun` against a PGlite-backed `@control-ai/db` instance
on the main thread, asserting chunk boundaries are all persisted and a
branch's own rows never include a month at or before its fork point.

## Acceptance

- `tick-worker.ts` never imports `@control-ai/db` or any DB driver.
- `extendRun` never recomputes a month that's already persisted for that
  chunk sequence; each chunk is persisted before the next is dispatched.
- A branch's own persisted rows only ever cover months after its fork
  point.
- Worker failures update the job's status to `error` rather than throwing
  into an unrelated caller.

Depends on: `@control-ai/engine`, `@control-ai/db`.
