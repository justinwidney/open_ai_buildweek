# simulation

The kernel every other folder builds toward: an immutable per-month
`LifeStateSnapshot`, a pure `tick()` reducer that advances one snapshot to
the next by running every active income/expense/debt/portfolio holding
through its own domain logic, and the branching mechanics
(`RunRef`/`forkRun`/`resolveSnapshot`) that let "turn 180 degrees" become a
new life path from any existing month without recomputing the shared
history.

## Entry point

`index.ts` — `LifeStateSnapshot`/`Decision`/`DecisionSet`,
`computeNetWorthCents`, `tick(ctx)` (returns `{ snapshot, detail }` —
`snapshot` carries only what the *next* tick needs, while `detail` is the
granular per-entity flow/balance records, see `detail.ts`, that a
persistence layer stores into `@control-ai/db`'s `flow_line_items`/
`balance_snapshots` tables), `runSimulation(initial, months, options)`
(returns `{ snapshots, details }`; the plain in-memory driver — a worker
chunk or a persisted branch extension calls the same `tick` underneath,
just starting from a different snapshot and persisting `details` as it
goes instead of collecting them in memory), and
`rootRun`/`forkRun`/`resolveSnapshot`.

## Scope boundary: decisions are recorded, not interpreted

`tick()` appends `decisionDeltas` onto the returned snapshot's `decisions`
array as an audit trail, but it does **not** translate "decision X was
chosen" into concrete state changes (adding an income source, buying a
house, changing a job). That translation is the caller's job when it
constructs a new starting `LifeStateSnapshot` at a fork point — see the
branching test in `index.test.ts` for the pattern: take the parent's
snapshot at the fork month, replace whatever domain state the decision
actually changes, and call `runSimulation` from there. A general
decision-effects system (mapping an arbitrary decision to an arbitrary
state patch) is a bigger, separate design worth its own pass once the
frontend's actual decision vocabulary is known.

## Other documented simplifications

- Net cash flow (take-home minus expenses minus debt payments) lands
  entirely on `financialAssets[0]` — the household's primary cash account.
  Additional financial assets just grow on their own interest.
- Portfolio holdings grow automatically every tick; contributions and
  withdrawals are applied by the caller via `portfolio/`'s functions
  before calling `tick`, not derived from surplus cash flow automatically.
- The calendar year (for tax-basis resets) is inferred purely from `month
  % 12`, assuming a run's anchor month is always a January — fine for now,
  but worth revisiting if a run needs to start mid-year.

## Acceptance

- `tick()` is pure — same input, same output, no mutation of `previous`.
- A branch's `resolveSnapshot` is byte-identical to its parent for every
  month at or before the fork, and never recomputes/stores those months
  itself.
- A deterministic (fixed-returns) run produces byte-identical results
  across repeated invocations with the same seed — the golden-master test.

Depends on: every other folder in `engine/src/`.
