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
house, changing a job). The existing `events/` interpreter performs that
translation for its typed mutation vocabulary and catalog builders. The
caller resolves the parent snapshot, applies the selected event, creates the
fork, and runs it forward. The planned crossroads work below expands that
existing seam with versioned option definitions, validation, richer state,
scheduled effects, and preview/commit orchestration; it does not move decision
interpretation into `tick()`.

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

## Detailed crossroads contract (planned)

The engine needs one domain-level contract for every crossroads; the UI may
render it as a small confirmation or a large searchable popup, but rendering
must not change the financial result.

- `minor` decisions are low-complexity, normally reversible, and may use a
  compact confirmation with one projection summary.
- `major` decisions (education/career, rent-or-buy, marriage, children,
  relocation, retirement) require an expanded experience with assumptions,
  eligibility warnings, multiple options, and side-by-side projections.
- Classification is catalog metadata, not a frontend heuristic. It includes a
  reason, required comparison metrics, and whether explicit confirmation is
  required.

The intended lifecycle is `open -> preview -> compare -> commit | cancel`:

1. **Open** resolves the snapshot, catalog version, and option eligibility at
   the decision's effective month.
2. **Preview** forks an ephemeral branch per option and applies its event
   effects without changing the active run.
3. **Compare** evaluates every option over the same horizon, reference-data
   version, assumptions, and seeded uncertainty streams.
4. **Commit** records the chosen option and its input values, applies the
   versioned event once, and creates the durable branch. Cancel discards all
   previews.

A preview response needs stable option/scenario ids; immediate cash required;
monthly income, tax, housing, insurance, debt, and discretionary-flow deltas;
asset/debt balances; net-worth and goal effects; uncertainty ranges; warnings;
and line-item explanations linking each number to an assumption or source.
Preview results are advisory snapshots, never hidden mutations.

## State evolution and branches (planned)

`LifeStateSnapshot` should eventually carry or reference all state needed to
resume a life: household, location, education, employment and pay schedule,
housing tenure/property, insurance, taxes, recurring schedules, active goals,
pending events, catalog/reference-data versions, and RNG stream state. Each
entity needs stable identity plus `effectiveFromMonth`/`effectiveToMonth` so a
job, lease, mortgage, or benefit starts and stops exactly once.

A durable branch records `parentRunId`, `forkMonth`, `decisionId`,
`optionId`, normalized user inputs, engine/schema version, data-bundle version,
seed policy, and the applied event ids. The shared prefix remains immutable.
Replaying the branch from that record must reproduce every snapshot and detail
line. Scheduled future effects (a school graduation, annual bonus, mortgage
renewal) live in state/event schedules rather than UI timers.

`TickDetail` is the explanation ledger. It should expand from per-entity totals
to opening balance + named inflows/outflows + growth/interest/tax adjustments =
closing balance, with formula/assumption/source ids. Aggregating those lines
must exactly equal the snapshot totals shown in a monthly projection.

## Additional acceptance criteria

- Opening, previewing, comparing, or cancelling a decision never alters its
  source run; committing the same idempotency key twice creates one fork/effect.
- All options in one comparison share the baseline, horizon, data versions,
  and aligned random streams; differences therefore reflect the choice rather
  than unrelated random draws.
- A replay from the branch manifest is byte-identical, including scheduled
  event outcomes and explanation lines.
- Every monthly total can be reconciled to detail lines and every line exposes
  its formula inputs and provenance.
- Tests cover at least career/school and rent/buy major decisions, one minor
  decision, cancel, invalid/ineligible inputs, delayed effects, and fork replay.
