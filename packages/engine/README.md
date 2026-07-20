# @control-ai/engine

Pure, dependency-light TypeScript kernel for the monthly financial and
lifestyle simulation. No Node-only or native dependencies — never imports
`node:worker_threads`, `pg`, or any DB driver — so it stays fast to
typecheck and portable to a future client-side "what-if" preview build.

## Scope

Computes one simulated life at a time as an ordered sequence of immutable
monthly `LifeStateSnapshot`s, plus the mechanics to branch a new life path
from any existing month with a changed decision. Covers incomes, expenses,
debts, financial assets, an investment portfolio, and physical assets, all
built on top of one shared "gross amount → pipeline of adjustments → named
views" mechanism (see `adjustable/`), and three interchangeable return
models for portfolio growth: fixed, Monte Carlo, and historical backtest.

## Entry point

`src/index.ts` re-exports the public surface of every subfolder. Other
packages (`@control-ai/db`, `@control-ai/worker`) and, eventually, the
frontend should only ever import from here — not from subfolder internals.

## Folders

Each subfolder has its own `README.md` with scope, acceptance rules, and
what it depends on: `money/`, `adjustable/`, `income/`, `expenses/`,
`debts/`, `assets/`, `portfolio/`, `physical-assets/`, `tax/`, `returns/`,
`reference-data/`, `simulation/`, `rng/`, `types/`.

## Demo / test

```sh
pnpm --filter @control-ai/engine test
```

Runs the `node:test`-based suites (via `tsx --test`) covering money
arithmetic, the adjustment pipeline, each domain's view assembler, the
tax/SSA reference calculations, the returns strategies, and a golden-master
end-to-end simulation run.

## Acceptance

- Zero Node-only/native imports anywhere in `src/`.
- Every `resolveAdjustable` result's line items sum exactly to its
  `netCents` (no penny drift).
- `tick()` is a pure function: same `TickContext` in, same
  `LifeStateSnapshot` out, no hidden mutation of its inputs.
- A branch never recomputes months at or before its fork point.
