# events

**Layer 2** of `LIFE_SIMULATION_MODEL.md` — the event interpreter that turns
a life choice into a fork. The simulation kernel deliberately records
decisions but never acts on them (`tick`'s "scope boundary"); this is the
seam that translates *"buy a home," "change jobs," "have a child"*
into a concrete diverged snapshot a branch runs forward from.

## The three pieces

1. **`StateMutation`** — the small typed vocabulary of state changes
   (`adjustCash`, `addIncome`/`removeIncome`/`patchIncomeConfig`,
   `addExpense`…, `addDebt`, `addPhysicalAsset`, `setFilingStatus`, …).
2. **`applyEvent(snapshot, effect)`** — folds an `EventEffect`
   (`{ decision, mutations }`) over a snapshot: applies the mutations,
   recomputes net worth, records the decision on the audit trail. Pure — the
   input is never mutated. `applyEvents` chains several in one month.
3. **Catalog builders** — reusable "fork templates" that produce an
   `EventEffect` from plain parameters + the `effectiveFromMonth`:
   `changeContributionRate`, `changeJob`, `buyHome`, `marry`, `haveChild`,
   `receiveWindfall`, `relocate`.

## How it fits branching

`applyEvent` produces the diverged fork snapshot; the branching layer
(`simulation/forkRun`, or `@control-ai/worker`'s `branchRun`) owns the
`runId`/`parentSnapshotRef`/`month` and runs it forward. So the full
"what-if" is: take the parent's snapshot at the fork month → `applyEvent`
with a chosen option → branch runs it forward → compare to the original.

## Boundaries (documented, not missing)

- Events change the **financial snapshot** (incomes/expenses/debts/assets and
  filing status). Updating the `household/` roster (a new dependent/spouse for
  age/CTC) is the caller's parallel responsibility until household lives on the
  snapshot.
- `adjustCash` can drive cash negative — **affordability is a precondition's
  job**, not the interpreter's. Preconditions/unlocks (which choices are
  offered when) belong to the decision-tree navigation in Layer 5.

## Acceptance

- `applyEvent` never mutates its input snapshot and always returns one with a
  net worth consistent with its balances.
- Mutations apply in order (a remove-then-add with one id is a replace).
- Each catalog builder produces a snapshot whose new entities activate at
  `effectiveFromMonth` when the branch ticks forward.

Depends on: `simulation/`, `income/`, `expenses/`, `debts/`, `physical-assets/`,
`portfolio/`, `assets/`, `money/`, `types/`.

## Decision and option catalog (planned)

`events/` should become the engine-facing catalog of crossroads, separate from
reference data such as job or property records. A decision definition needs a
stable/versioned id, category, `major | minor` presentation class, title and
educational copy keys, input schema, option-query definition, prerequisites,
unlock rules, comparison metrics, preview horizon, and one or more effect
builders. An option needs its own stable id, labels/tags for search and filter,
assumptions/defaults, eligibility result, and the parameters required to build
an `EventEffect`.

Preconditions return structured results (`eligible`, blocking reasons,
warnings, and suggested remedies); they must never silently remove an option.
Validation happens before preview and again before commit against the resolved
fork snapshot, because affordability or eligibility may have changed.

Examples of complete major-decision effects:

- **Career/school:** tuition and debt, lost earnings, graduation date,
  credential, job start, pay amount/cadence, shifts/rotation, hours and
  overtime, benefits, bonuses/commission rules, payroll tax, raises, and
  layoff/promotion events.
- **Rent/buy:** property type, down payment and closing cash, mortgage terms,
  qualification and affordability (income, debt-to-income, rate, term, and
  maximum payment/price), principal/interest schedule, property taxes,
  insurance, maintenance, utilities/fees, appreciation or depreciation, sale
  costs, rent/deposit/escalation, and move timing.

## Preview, commit, and scheduled effects (planned)

Effect builders are pure: catalog version + option + normalized inputs + month
produce a deterministic event plan. A plan separates immediate mutations from
scheduled effects and uncertain effects. Preview applies that plan to an
ephemeral fork; commit applies the identical serialized plan to a durable fork
under an idempotency key. The committed audit record preserves the definition
version, option, user inputs, assumption/source ids, generated schedule, and
seed namespace so later catalog updates do not rewrite history.

Uncertain outcomes use named RNG streams and record the sampled result (for
example bonus qualification or repair timing). Materialized results are replay
data; they are not sampled again when a saved branch is loaded. Event conflicts
need explicit precedence and validation, such as preventing two primary homes
or overlapping full-time jobs unless a definition permits them.

## Additional acceptance criteria

- Every offered option either builds a valid effect plan or returns structured
  validation errors; search/filter metadata does not affect its economics.
- Preview and commit from the same snapshot, inputs, versions, and seed produce
  the same immediate and scheduled mutations.
- Applying a committed event id twice is idempotent; conflicting active-state
  effects fail with actionable reasons rather than partial mutation.
- Tests cover start/end-month boundaries, ordered simultaneous effects,
  affordability changes between preview and commit, uncertain-event replay,
  and full career/school and rent/buy effect plans.
