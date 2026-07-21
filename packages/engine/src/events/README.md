# events

**Layer 2** of `LIFE_SIMULATION_MODEL.md` — the event interpreter that turns
a life choice into a fork. The simulation kernel deliberately records
decisions but never acts on them (`tick`'s "scope boundary"); this is the
missing seam that translates *"buy a home," "change jobs," "have a child"*
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
