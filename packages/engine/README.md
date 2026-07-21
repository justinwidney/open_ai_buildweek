# @control-ai/engine

Pure, dependency-light TypeScript kernel for the monthly financial and
lifestyle simulation. No Node-only or native dependencies — never imports
`node:worker_threads`, `pg`, or any DB driver — so it stays fast to
typecheck and portable to a client-side "what-if" preview build.

## Scope

Today the package computes one simulated life at a time as an ordered sequence
of immutable monthly `LifeStateSnapshot`s and can branch a path from an
existing month. It covers incomes, expenses, debts, financial assets, an
investment portfolio, physical assets, taxes, statements, budgets, goals, and
path analysis.

The next product layer is a **detailed life simulator**. At major crossroads
such as school versus work, choosing a job, renting versus buying, starting a
family, or retiring, the engine must give the UI enough information to explain
the choice before it changes the life path. The UI owns presentation and user
interaction; the engine owns calculations, eligibility, projections,
uncertainty, and explainable results.

Roadmap sections in this README and the domain READMEs are requirements, not a
claim that the corresponding APIs have already been implemented.

## Crossroads experience contract

Every major decision uses the same product flow:

1. **Discover** — query a versioned catalog and search/filter/sort options such
   as occupations, education programs, housing types, properties, loans, and
   insurance products.
2. **Configure** — collect the few player inputs that materially affect the
   result. Defaults must come from reference data and remain visible and
   editable.
3. **Validate** — return eligibility, affordability, missing inputs, warnings,
   and hard blockers as structured data. A disabled UI control is never the
   only explanation.
4. **Preview** — apply the option to a temporary fork and run it over a stated
   horizon without mutating the active life. The same state, assumptions,
   catalog version, and seed must return the same result.
5. **Compare** — normalize options into a common set of headline metrics,
   monthly line items, risks, trade-offs, and goal impacts.
6. **Commit** — record the selected catalog item, player overrides, effective
   month, assumptions, seed policy, and data version in a durable decision,
   then create the new branch.

Minor crossroads may use a compact confirmation, but they still use the same
validation and commit semantics. Presentation size is metadata; it must not
change simulation rules.

### Proposed shared types

Names may change during implementation, but domain APIs should converge on
this shape rather than inventing incompatible popup-specific payloads:

```ts
type DecisionImportance = "minor" | "major";

interface CrossroadDefinition<TOption, TInputs> {
  id: string;
  kind: string;
  importance: DecisionImportance;
  title: string;
  catalogQuery?: CatalogQuery;
  options: readonly TOption[];
  defaultInputs: TInputs;
  previewHorizonsMonths: readonly number[];
  dataVersion: string;
}

interface DecisionPreview<TBreakdown = unknown> {
  optionId: string;
  eligible: boolean;
  blockers: ValidationMessage[];
  warnings: ValidationMessage[];
  oneTimeCashCents: Cents;
  monthlyCashFlowCents: Cents;
  projectedNetWorthDeltaCents: Cents;
  goalImpacts: readonly GoalImpact[];
  ranges?: readonly ProjectionRange[];
  breakdown: TBreakdown;
  assumptions: readonly Assumption[];
  provenance: DataProvenance;
}
```

`DecisionPreview` is a read model, not persisted simulation state. Domain
modules own their detailed breakdown; the orchestration layer owns the shared
wrapper and comparison across options.

## First major crossroads

### School or work / choose a career

The detailed panel needs searchable occupation and education tiles plus a
comparable projection. It must represent salary, hourly, contract, and
self-employed work; weekly, biweekly, semimonthly, monthly, annual, and
irregular pay; shift rotations such as 10-on/4-off and 7-on/7-off; hours,
overtime, tips, bonuses, commissions, equity, benefits, union dues, payroll
deductions, unemployment risk, growth bands, and education prerequisites.

The comparison should show gross and take-home pay, expected and conservative
monthly income, time until first pay, education cost/debt, schedule and hours,
benefit value, income volatility, projected earnings, and effects on current
goals. See `income/`, `household/`, `tax/`, `expenses/`, `budget/`,
`statement/`, `events/`, and `reference-data/`.

### Rent or buy / choose a home

The detailed panel needs housing-type and property tiles plus mortgage and
ownership projections. It must distinguish detached, semi-detached,
townhouse, condo, manufactured home, multi-unit, and rental configurations;
support down payment and term choices; and model principal, interest, closing
costs, property tax, insurance, condo/HOA fees, utilities, maintenance,
repairs, appreciation or depreciation, selling costs, and opportunity cost.

The comparison should show a lender-style maximum and a safer affordable
budget, cash needed at closing, complete monthly payment, debt-service ratios,
remaining emergency fund, equity trajectory, rent-versus-buy break-even range,
risks, and goal impacts. See `physical-assets/`, `debts/`, `expenses/`,
`assets/`, `accounts/`, `tax/`, `events/`, and `reference-data/`.

## Domain ownership

| Domain | Owns in the detailed simulator |
|---|---|
| `money/` | Exact currency arithmetic, allocation, rounding, and display-boundary rules. |
| `types/` | Foundational month/calendar and tax-basis leaf types. |
| `contracts/` | Portable IDs, versions, provenance, validation, work schedules, catalogs, and decision-preview/session contracts. |
| `reference-data/` | Versioned catalogs, benchmarks, geographic modifiers, effective dates, and source metadata. |
| `income/` | Employment contracts, schedules, pay calendars, variable compensation, benefits, and income realization. |
| `household/` | People, dependents, shared resources, age, availability, and household-level eligibility. |
| `expenses/` | Recurring, scheduled, usage-based, and event-driven costs. |
| `debts/` | Loan offers, affordability constraints, amortization, delinquency, refinancing, and payoff. |
| `physical-assets/` | Homes, vehicles, condition, ownership costs, valuation, appreciation/depreciation, and sale. |
| `accounts/` | Tax treatment, liquidity, contributions, withdrawals, and restricted-use balances. |
| `portfolio/` / `returns/` | Allocation, growth, fees, volatility, and investment opportunity cost. |
| `tax/` | Pay-period withholding, annual liability estimates, credits, deductions, and tax effects of decisions. |
| `adjustable/` | Auditable transformation pipelines shared by income, expenses, debts, and assets. |
| `simulation/` | Preview, compare, commit, branch evolution, invariants, and orchestration. |
| `events/` | Decision definitions, preconditions, effects, unlocks, reversals, and audit records. |
| `forecast/` / `rng/` | Uncertainty ranges, hazards, correlated scenarios, and reproducible random streams. |
| `statement/` / `budget/` | Player-facing monthly truth, affordability, cash-flow pressure, and plan-versus-actual. |
| `goals/` / `analysis/` | Goal effects, trade-offs, divergence, attribution, and comparison explanations. |

## Entry point

`src/index.ts` re-exports the public surface of every subfolder. Other
packages (`@control-ai/db`, `@control-ai/worker`) and, eventually, the
frontend should only ever import from here — not from subfolder internals.

## Folders

Each subfolder has its own `README.md` with current scope, detailed-simulator
requirements, dependencies, and acceptance rules: `accounts/`, `adjustable/`,
`analysis/`, `assets/`, `budget/`, `contracts/`, `debts/`, `events/`, `expenses/`,
`forecast/`, `goals/`, `household/`, `income/`, `money/`, `physical-assets/`,
`portfolio/`, `reference-data/`, `returns/`, `rng/`, `simulation/`,
`statement/`, `tax/`, and `types/`.

## Implementation sequence

1. Establish shared catalog, provenance, validation, crossroad, and preview
   contracts in `types/`, `reference-data/`, `events/`, and `simulation/`.
2. Build career contracts and fixtures end to end, including pay schedules,
   variable compensation, deductions, taxes, statements, and career preview.
3. Build housing contracts and fixtures end to end, including affordability,
   mortgages, total ownership cost, valuation, sale, and rent-versus-buy
   preview.
4. Add stochastic employment, repair, market, interest-rate, and home-value
   scenarios only after deterministic previews reconcile exactly.
5. Generalize the same flow to transportation, family, health/insurance,
   relocation, and retirement crossroads.

Each vertical slice should ship with a small curated catalog, a pure preview
API, a commit path that produces the previewed first-month result, a complete
breakdown for the UI, and golden fixtures for typical and edge cases.

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
- Previewing never mutates the active run, consumes an unrelated RNG stream,
  or silently changes catalog/default assumptions.
- Committing an unchanged preview produces the same first diverged state and
  decision metadata that the preview displayed.
- Every player-visible total can be reconciled to named components and source
  assumptions; no unexplained residual or hidden fee is allowed.
- Catalog search and filtering are deterministic and do not contain financial
  calculations; calculations live in their owning domain.
