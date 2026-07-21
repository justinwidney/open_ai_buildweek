# accounts

The tax **wrapper** a balance lives inside — what turns "money" into "401(k)
money vs Roth money vs taxable money," so the simulator can answer *"where
should this dollar go?"* and *"what does it cost to pull it out?"* Part of
Layer 1 of `LIFE_SIMULATION_MODEL.md`.

Five **tax treatments** carry the actual math — `taxable`, `taxDeferred`,
`roth`, `hsa`, `education529` — and eight concrete **account types** map onto
them with display labels and contribution rules.

## Entry point

`index.ts`:

- `accountTypeInfo(type)` / `allAccountTypes()` — treatment, labels, whether
  contributions are pretax, whether qualified withdrawals are tax-free, and
  the early-withdrawal penalty rate + age gate.
- `annualContributionLimitCents(type, ageYears, retirementLimits)` — the IRS
  cap for 401(k)/IRA (with age-50 and age-60–63 catch-ups from
  `reference-data`), or `null` where no federal limit is modeled here.
- `classifyWithdrawalTax({ accountType, requestedCents, balanceCents,
  costBasisCents, ageYears, qualifiedExpense? })` — decomposes a withdrawal
  into tax-free / ordinary-income / capital-gain / penalty parts.

`HoldingConfig` and `FinancialAssetConfig` carry an optional `accountType`
(defaulting to `taxableBrokerage` / `cash`), and `statement/` groups the
balance sheet by tax treatment.

## Modeled vs deferred

Modeled: treatment classification, 401(k)/IRA contribution limits with
catch-ups, and the withdrawal tax decomposition (average-cost basis;
Roth/529 contributions-first ordering; penalty age gates 59.5 and 65).

Deferred (documented, not silently wrong): HSA/529 contribution limits (return
`null`), Traditional-IRA deductibility phase-outs, the Roth 5-year rule, RMDs,
and automatic annual dividend/capital-gain drag on taxable accounts. The dollar
tax itself is computed by `tax/`; this package only classifies.

## Acceptance

- `taxFree + ordinaryIncome + capitalGains === grossWithdrawal` for every
  account type; `penalty` is additional.
- A pre-59.5 traditional-401(k) withdrawal is fully ordinary income + a 10%
  penalty; the same withdrawal at 60 has no penalty.
- Roth contributions come out tax- and penalty-free before earnings.

Depends on: `money/`, `reference-data/`.
