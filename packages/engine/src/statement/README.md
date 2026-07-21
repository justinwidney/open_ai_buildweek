# statement

The **monthly read model** — Layer 1 of the life-simulation model (see the
repo's `LIFE_SIMULATION_MODEL.md`). `simulation/` computes each month;
`statement/` packages one month into the complete, UI-ready picture a
pathway-simulator screen renders: income, the tax breakdown, spending,
debt service, cash flow, the balance sheet, and derived planning metrics.

Nothing here recomputes the simulation — it reshapes a
`LifeStateSnapshot` (+ that month's optional `MonthDetail`) into a flat,
labeled summary. Balances come from the snapshot (so a statement is valid
even for the month-0 starting point with no flows); income/tax/spending
come from the detail and are zero when it's absent.

## Entry point

`index.ts` — `buildMonthlyStatement({ snapshot, detail?, context? })`
returning a `MonthlyStatement`. `context` optionally carries
`ageYearsAtStart` (so the statement reports age at any month — the "results
at a certain age" anchor) and `safeWithdrawalRate` (for the FI number).

## What it derives

- **Taxes** broken into federal / state / FICA (surfaced from the income
  line items into the tick detail so they're also queryable in Cube).
- **Cash flow & savings rate** — take-home minus all spending, plus pretax
  contributions, over gross.
- **Balance sheet** — cash / investments / physical assets / liabilities /
  net worth, each itemized.
- **Planning** — emergency-fund runway, annualized spending, the FI number
  (annual spending ÷ withdrawal rate), and FI progress.

Forward-looking "expected future returns" is deliberately *not* here — a
statement is one month; the distribution of futures is `forecast/`.

## Acceptance

- `gross − takeHome − pretaxContribution === totalTax` (the withholding
  identity reconciles).
- `balanceSheet.totalAssets − totalLiabilities === netWorthCents` (matches
  the snapshot's cached net worth exactly, no drift).
- A statement builds for the month-0 snapshot (no detail) with zeroed flows
  and a fully-populated balance sheet.

Depends on: `simulation/`, `physical-assets/`, `expenses/`, `money/`, `types/`.
