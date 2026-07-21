# Life Simulation Model — what to consider

Design research for turning `@control-ai/engine` from a monthly financial
kernel into a **branching life simulator**: at every month a full financial
state; at certain months a *decision node* forks the path; and afterward you
can retrace a path, try a different version, and find where a branch diverged
most from what you wanted at a given age.

The simulator answers two questions:

1. **Forecast** — "given the choices so far, what's the distribution of
   outcomes?" (already served by `forecast/runMonteCarloForecast`).
2. **Counterfactual** — "if I had chosen differently at node X, where and by
   how much would my life have diverged from this one (or from my goal)?"
   (this is the new work).

Everything below is organized as five layers: the **monthly state**, the
**event catalog** (forks), the **fork mechanics**, **goals**, and the
**divergence analysis**. The last section maps each to the current code and
lists the concrete gaps to build.

---

## Layer 1 — The monthly state vector

At any month the simulation should be able to report all of the following.
The engine already tracks most of the "core" rows (`LifeStateSnapshot`); the
italicized ones are not modeled yet.

### Flows (per-month, resettable)

| Flow | Notes | In engine? |
|---|---|---|
| Gross income, per job/source | salary, bonus, RSU vesting, self-employment, rental, dividends/interest, *Social Security*, *pension* | income ✓; multi-source ✓; *equity/bonus lumpiness* ✗ |
| Pre-tax deductions | 401(k)/403(b), HSA, health/dental premiums, FSA | 401(k) deferral ✓; *HSA/FSA/premiums* ✗ |
| Payroll taxes | FICA (SS + Medicare + addl Medicare) | ✓ |
| Income tax withholding | federal, state, *local/city* | fed ✓, state ✓, *local* ✗ |
| Take-home pay | after deductions + tax | ✓ |
| Expenses by category | fixed vs variable vs discretionary; *needs/wants/savings (50/30/20)* | fixed+inflation ✓; *category taxonomy & discretionary* partial |
| Debt service | principal, interest, escrow (tax+insurance) | ✓ |
| Savings / investment contributions | to which account (taxable, 401k, IRA, Roth, HSA, 529) | portfolio holdings ✓; *account-type routing* ✗ |
| Portfolio withdrawals | retirement drawdown, *sequence-of-returns* aware | withdrawals module exists; *drawdown policy* partial |
| Transfers | between accounts, employer match | *match, transfers* ✗ |

### Stocks (point-in-time balances)

| Stock | Notes | In engine? |
|---|---|---|
| Cash / emergency fund | months of runway | financialAsset ✓ |
| Taxable brokerage | balance + **cost basis** (for cap-gains) | ✓ (cost basis tracked) |
| Tax-advantaged accounts | 401k, Trad IRA, Roth IRA, HSA, 529 — each with its own tax + withdrawal rules | *account types* ✗ (only generic holdings) |
| Physical assets | home, car, valuables; appreciation/depreciation | ✓ |
| Debts | mortgage, student loans, auto, credit card, personal, HELOC | debt+amortization ✓ |
| Net worth | assets − liabilities | ✓ |
| *Human capital* | present value of expected future earnings | ✗ (useful for early-life views) |

### Context / environment (drives the rules)

| Context | Why it matters | In engine? |
|---|---|---|
| Age / calendar date | contribution limits, RMDs, SS claiming, catch-up | month index ✓; *age/DOB* ✗ |
| Filing status | single/MFJ/MFS/HoH — changes brackets & FICA thresholds | ✓ (taxBasis.filingStatus) |
| Household composition | dependents → tax credits, childcare, 529 | *dependents* ✗ |
| Location (state, city) | state/local tax + cost-of-living + home prices | stateCode ✓; *COL/local* partial (benchmarks exist) |
| Inflation regime | erodes real spending & goals | per-expense inflation ✓; *global CPI/COLA* partial |
| Realized market returns | fixed / Monte Carlo / historical | ✓ (three strategies) |
| Interest-rate regime | mortgage refi, cash yield, new-debt cost | *dynamic rates* ✗ |
| Employment status | employed / unemployed / self-employed / retired | *status machine* ✗ |

### Derived / planning metrics (what a UI actually charts)

Savings rate · emergency-fund runway (months) · debt-to-income · **budget
target vs actual** by category · net-worth trajectory · **FI number** (~25×
annual expenses) and years-to-FI · retirement success probability · goal
progress (down payment, college fund, FI) · effective & marginal tax rate ·
real (inflation-adjusted) vs nominal net worth.

> The user's phrase "expected future returns" lives here: it's both an input
> (the returns strategy) and a derived output (the forecast's percentile
> bands and success probability).

---

## Layer 2 — The life-event catalog (decision nodes = forks)

Each entry is a **static important moment** that can fork the path. For each
you model: *precondition* (when it's available), *one-time cost/inflow*,
*recurring deltas* (income/expense/debt added or removed), *state mutations*
(entities added/removed, filing status, location), *stochastic effects*, and
*downstream unlocks* (choices it enables or blocks).

### Education & career
- Attend college / grad / professional school / trade school / bootcamp —
  tuition (cash or **student loan**), delayed/reduced earnings during, earnings
  bump after, field-dependent trajectory.
- Choose major / field / specialization — sets the income growth curve.
- First job · change jobs · promotion · career pivot · negotiate raise.
- Start a business / freelance / side hustle — variable income, startup cost,
  self-employment tax, upside skew.
- Sabbatical · return to school mid-career · phased down.
- Relocate for work — salary Δ **and** cost-of-living / state-tax Δ together.
- Involuntary: layoff / unemployment spell (with benefits), disability.
- Retire — early / normal / phased; flips income→withdrawals, opens SS timing.

### Family & relationships
- Marriage — filing status change, combined balance sheet, one-time wedding
  cost, possible dual income.
- Divorce — asset split, alimony/child support, single filing again.
- Have a child (per child, with timing) — childbirth cost, ongoing childcare &
  expenses, **529** goal, child tax credit, career/earnings impact, parental
  leave.
- Elder care / supporting parents.
- Death of spouse — survivor SS, life-insurance inflow, filing change.

### Housing
- Rent vs buy · buy first home (down payment, closing costs, mortgage, property
  tax, insurance, maintenance) · upgrade / downsize · second/investment
  property (rental income) · refinance · **pay off mortgage early** · relocate
  (ties to career/COL).

### Transportation
- Buy vs lease · new vs used · replacement cadence · financing vs cash.

### Health & insurance
- Health-plan choice (premium vs deductible; HDHP unlocks **HSA**) · major
  medical event · disability onset · buy life / disability / umbrella / LTC
  insurance.

### Financial & investment (the "change my budget/allocation" forks)
- Asset allocation / risk level (feeds the returns model's volatility).
- **Contribution-rate change** — the everyday fork the user called out
  ("change budgets"): more to 401k/Roth/taxable, less to spending, or vice
  versa.
- Roth vs traditional · backdoor / mega-backdoor Roth · rebalancing policy ·
  debt payoff strategy (avalanche vs snowball) · tax-loss harvesting.
- Windfalls: inheritance, signing bonus, **equity liquidity / IPO**, lawsuit,
  lottery.

### Lifestyle & discretionary (small, frequent forks)
- Take a trip / gap year · lifestyle inflation vs frugality · expensive hobby ·
  charitable giving · "cut the morning coffee" class of micro-budget changes.

### Exogenous scenarios (not choices — environment forks)
- Recession / bull run · inflation shock · rate change · tax-law change · job
  market. Model these as *scenario overlays* you can branch on to stress-test a
  plan ("what if a recession hits at 45?").

---

## Layer 3 — Fork mechanics (anatomy of a decision node)

A fork is not "edit a number" — it's a typed transformation of the state.
Recommended shape for a life event:

```ts
interface LifeEvent {
  id: string;
  category: "career" | "family" | "housing" | ... ;
  label: string;                       // "Buy a home"
  // When can this happen / be offered?
  precondition?: (s: LifeStateSnapshot, age: number) => boolean;
  // The chosen variant (rent vs buy; which school; how many kids).
  options: LifeEventOption[];
}

interface LifeEventOption {
  optionId: string;                    // "buy-350k-20pct-down"
  oneTime?: MoneyDelta[];              // down payment out, inheritance in
  // Structural mutations to the snapshot, applied at effectiveFromMonth:
  addIncomes?: IncomeConfig[];
  removeIncomeIds?: string[];
  addExpenses?: ExpenseConfig[];
  addDebts?: DebtConfig[];
  addPhysicalAssets?: PhysicalAssetConfig[];
  setFilingStatus?: FilingStatus;
  setLocation?: { stateCode: string; colIndex?: number };
  // Stochastic / risk effects (used by Monte Carlo branches):
  hazards?: Hazard[];                  // e.g. layoff prob, medical-event prob
  // What this choice enables/blocks later:
  unlocks?: string[]; blocks?: string[];
  reversible: boolean;                 // can you undo it later?
}
```

Key principles:

- **Pre-fork state is shared, post-fork diverges.** The engine already does
  this: `forkRun(parentRef, forkMonth, childId)` + `resolveSnapshot` delegate
  everything at/before the fork to the parent and only store the child's new
  months. Branches are cheap; a tree of "what-ifs" is the natural structure.
- **The kernel does not interpret decisions.** `tick()` records a decision as
  audit metadata but does *not* mutate state from it — by design. So the
  missing piece is a pure **event interpreter**: `applyEvent(snapshot, option)
  → snapshot'` that produces the diverged starting snapshot a branch runs
  forward from. This is the single most important thing to build.
- **Deterministic vs stochastic divergence.** Two branches can differ because
  of a *choice* (buy vs rent) or because of *luck* (the same choice under two
  return draws). To separate them, compare branches as **distributions** (run
  each as a Monte Carlo forecast), not single lines.
- **Reversibility & re-forking.** "Retrace and try a different version" = fork
  again from the same node with a different `optionId`. Keep the run tree so
  siblings are directly comparable.
- **Timing is itself a variable.** The same event at 28 vs 35 (kids, home,
  retirement) is a different outcome; expose `effectiveFromMonth` as a lever.

---

## Layer 4 — Goals & desired trajectories

To find divergence "between desired results at a certain age," the sim needs a
first-class notion of what you *wanted*. A goal is a target keyed to age/date:

```ts
interface Goal {
  id: string;
  metric: "netWorth" | "liquidNetWorth" | "retirementIncome"
        | "collegeFund" | "debtFree" | "homeEquity";
  targetCents: number;
  byAge: number;                       // or byMonth
  real: boolean;                       // inflation-adjusted target?
  priority: "must" | "want" | "nice";
}
```

Derived from goals: a **desired trajectory** (the target value at each age),
**goal-progress** at any month (actual ÷ target), **on-track probability**
(share of Monte Carlo paths that clear the goal by its age — you already have
`successProbability`; generalize it to arbitrary goals), and **slack/shortfall**
(how far ahead/behind at each age).

---

## Layer 5 — Retrace & divergence analysis

This is the analytical heart of the ask. Three distinct questions, three
methods:

### A. Temporal divergence between two paths
"Where did life A and life B separate the most?" For two runs, compute a
per-month distance `d(m) = metricA(m) − metricB(m)` (net worth, or goal-gap).
Report the **max-divergence month/age**, the sign, and whether the gap is
still widening or converging. Because pre-fork months are shared, `d(m)=0`
until the fork; the interesting part is the shape after.

### B. Counterfactual decision attribution
"Which choice mattered most for hitting my goal?" Hold everything else fixed,
flip one decision, re-run, and measure the change in the terminal goal metric
(or on-track probability). Rank decisions by impact. This is a
**one-at-a-time sensitivity / Shapley-style** analysis over the decision set —
it tells you the fork with the greatest leverage, which is often *not* the one
with the biggest immediate cost (e.g. a 3% contribution-rate change can
dominate a one-time trip).

### C. Goal-relative divergence (the user's exact phrasing)
"Where is the greatest divergence between desired results and this path at a
certain age?" Compute `gap(m) = actual(m) − desired(m)` against the goal
trajectory (Layer 4), find the age of **maximum shortfall**, and attribute it
(via B) to the decisions/variables responsible. Combine with Monte Carlo so
the answer is "at age 52 you fall furthest below your $2M target, and the fork
driving it is the 45-year-old home upgrade, which cut on-track probability from
78% → 61%."

Recommended output object:

```ts
interface DivergenceReport {
  baseline: RunId; variant: RunId;         // or path vs goal
  forkMonth: number;
  maxDivergence: { month: number; age: number; deltaCents: number };
  converging: boolean;
  goalImpact?: { goalId: string; onTrackDelta: number };  // Δ probability
  attribution?: Array<{ decisionId: string; contributionCents: number }>;
}
```

---

## Mapping to the current engine + gaps to build

### Build status

- **Layer 1 (monthly state) — largely complete.**
  - `statement/buildMonthlyStatement` packages a snapshot (+ flow detail) into
    the complete monthly read model: income, a **federal/state/FICA tax split**
    (surfaced as flow line items in the tick detail, so Cube queries them too),
    spending by fixed/discretionary/debt, cash flow & savings rate, the balance
    sheet **grouped by tax treatment**, and planning metrics (emergency-fund
    runway, FI number, FI progress).
  - `accounts/` — eight account types over five tax treatments
    (taxable/taxDeferred/roth/hsa/education529), 401(k)/IRA contribution limits
    with catch-ups, and withdrawal tax classification. `HoldingConfig` /
    `FinancialAssetConfig` now carry an optional `accountType`.
  - `budget/` — `BudgetTarget` (total cap, savings-rate goal, per-category and
    per-line caps) vs a statement's actuals → `BudgetReport` with ranked
    overages. The plan-vs-actual hand-holding surface.
  - `household/` — primary/spouse/dependents with birth-month offsets (ages
    advance automatically), child-tax-credit estimate, and a `HouseholdContext`
    the statement consumes for age + dependents.
  - Still open in Layer 1 (deferred, lower value): human capital (PV of future
    earnings); moving filing status onto the household as source of truth;
    wiring the CTC into federal withholding; automatic taxable-account dividend
    drag. These are refinements, not blockers for Layer 2.
- **Layer 2 (event interpreter + catalog) — complete.** `events/` adds the
  seam the kernel deliberately left out (`tick` records decisions but never
  acts on them):
  - `StateMutation` — the typed vocabulary of state changes (adjustCash,
    add/remove/patch income·expense·debt·asset, setFilingStatus).
  - `applyEvent(snapshot, { decision, mutations })` — folds a choice into a
    diverged fork snapshot, recomputes net worth, records the decision. Pure.
    `applyEvents` chains several in one month.
  - Catalog builders (fork templates): `changeContributionRate`, `changeJob`,
    `buyHome`, `marry`, `haveChild`, `receiveWindfall`, `relocate`.
  - `forkWithEvent` — the end-to-end bridge: `forkRun` + `applyEvent` → a
    branch `RunRef` + its diverged snapshot, ready to run forward.
  - Boundary: events change the financial snapshot; mirroring the `household/`
    roster and enforcing affordability/preconditions are the caller's job
    (preconditions/unlocks belong to Layer 5 navigation).
- **Layer 4 (goals) — complete.** `goals/`:
  - `Goal` (metric + `byAge`/`byMonth` + `real` + priority) over six metrics:
    netWorth, liquidNetWorth (ex home equity/mortgage), retirementIncome
    (investable × SWR), collegeFund (529s), homeEquity, debtFree.
  - `evaluateGoal(goal, snapshot, ctx)` → `GoalProgress` (achieved, progress,
    signed surplus/shortfall, real-target inflation). Swept across months, its
    `shortfallCents` is the goal's **gap trajectory**.
  - `goalOutcomeDistribution(goal, terminalSnapshots, ctx)` → on-track
    probability + metric spread, generalizing the forecast's net-worth-only
    `successProbability` to any goal. Forecast now returns `terminalSnapshots`.
- **Layer 5 (divergence analysis) — complete.** `analysis/`:
  - Method A · `compareTrajectories(pathA, pathB, {metric})` — fork month,
    month of maximum divergence, converging vs widening.
  - Method C · `goalGapTrajectory(goal, path, ctx)` — goal shortfall at every
    month + the **age of maximum shortfall** (the literal product ask).
  - Method B · `rankGoalImpacts(goal, baselineTerminal, counterfactuals)` —
    ranks decisions by impact on a goal, flags on-track flips (pure arithmetic
    over caller-produced re-runs).
  - `divergenceReport` bundles A + C for baseline vs variant.
- Layer 3 (fork *mechanics*) is embodied by `events/`; the only unbuilt piece
  is first-class preconditions/reversibility/unlocks for decision-tree
  *offering* (a UI/navigation concern), not the fork math.

## All five layers are built

Engine test count: 134. The full "choose an event → branch → run forward →
compare to a goal → find where/why it diverged" loop exists end-to-end in
`@control-ai/engine`, pure and deterministic. What remains is product wiring,
not core modeling: persist statements/goals/analysis through `@control-ai/db`
and expose them in Cube; move a large forecast/attribution sweep onto
`@control-ai/worker`; and build the pathway-simulator frontend. Plus the
documented Layer-1 refinements (human capital, household-on-snapshot, CTC into
withholding, taxable dividend drag) and Layer-3 preconditions when the UI needs
them.

**Already there:** monthly `tick`, immutable snapshots, three return models,
tax/FICA/SS reference data, cheap `forkRun`/`resolveSnapshot` branching,
decisions as audit trail, and multi-path Monte Carlo `forecast` with
percentile bands + success/ruin probability. Persistence + branch semantics in
`@control-ai/db`; off-thread extend/branch in `@control-ai/worker`; a Cube
model over the output.

**Gaps, in priority order:**

1. **Event interpreter (`decisions/` or new `events/`)** — pure
   `applyEvent(snapshot, option) → snapshot'`. Without it every branch's
   diverged starting state is hand-built (as the tests do today). This unlocks
   the whole "life choice = fork" model. *Highest leverage.*
2. **Life-event catalog** — typed `LifeEvent`/`LifeEventOption` definitions
   (Layer 2/3) with costs, effects, preconditions, unlocks. Start with the 8–10
   highest-impact events (job, home, marriage, child, retire,
   contribution-rate, relocate, windfall).
3. **Account types** — distinguish taxable / 401k / IRA / Roth / HSA / 529 so
   contributions, growth, and withdrawals get the right tax treatment (needed
   for realistic retirement + college goals). Use the snapshot's `extensions`
   hook to add without a schema break.
4. **Goals + goal-relative metrics** (Layer 4) and generalizing
   `successProbability` to arbitrary goals.
5. **Divergence analysis module (`analysis/`)** — the three methods in Layer 5,
   returning `DivergenceReport`s. Pairs naturally with the run tree.
6. **Age/DOB + household** — real age drives limits/RMDs/SS; dependents drive
   credits and childcare. Currently only a month index + filing status.
7. **Scenario overlays** — exogenous recession/inflation/rate branches for
   stress-testing (Layer 2, last group).

Suggested build order: **1 → 2 → 4 → 5** gives an end-to-end "choose an event,
branch, compare to goal, see where it diverged" loop; **3, 6, 7** deepen
realism afterward.
