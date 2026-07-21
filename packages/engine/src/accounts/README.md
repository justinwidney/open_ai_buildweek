# accounts

## Current responsibility

This domain defines the tax wrapper a balance lives inside: cash, taxable
brokerage, Traditional/Roth 401(k), Traditional/Roth IRA, HSA, and education
529. Five tax treatments carry the rules: `taxable`, `taxDeferred`, `roth`,
`hsa`, and `education529`.

Current entry point: `index.ts` exports:

- `accountTypeInfo` / `allAccountTypes` for labels, treatment, contribution and
  withdrawal characteristics;
- `annualContributionLimitCents` for currently modeled 401(k)/IRA limits and
  catch-ups from `reference-data/`;
- `classifyWithdrawalTax` to split a withdrawal into tax-free, ordinary-income,
  capital-gain, and additional-penalty amounts.

`HoldingConfig` and `FinancialAssetConfig` may carry an `accountType`, and
`statement/` groups balances by tax treatment.

## Richer life-sim requirements

For major choices, an account is more than a tax label. It should carry:

- account ID, owner/member, institution/plan, country/jurisdiction, currency,
  opening/closing dates, beneficiary, and linked employer when relevant;
- tax treatment plus plan-specific eligibility, vesting, employer match,
  contribution election, payroll versus manual deposits, and shared-limit group;
- annual contribution usage, carry-forward room where applicable, overage and
  correction handling, income phase-outs, and effective-year rules;
- liquid/locked/restricted status, settlement delay, withdrawal purpose,
  ordering rules, withholding, penalties, loans/hardship withdrawals, and RMDs;
- separate tax basis/source buckets when treatment differs (employee pretax,
  Roth, employer match, rollover, contribution versus earnings);
- auditable transactions so funding a down payment cannot bypass tax or penalty.

Housing-specific wrappers/products (for example a jurisdictional first-home
savings account or retirement-plan homebuyer withdrawal) should be added only
through versioned regional rules, not embedded as a universal assumption.

## Proposed model and API contracts

```ts
interface AccountConfig {
  id: string;
  accountType: AccountType;
  ownerId: string;
  jurisdictionId: string;
  currency: string;
  openedMonth: MonthKey;
  planId?: string;
  employerId?: string;
  beneficiaryIds?: readonly string[];
}

interface ContributionRoom {
  limitGroupId: string;
  annualLimitCents: Cents | null;
  contributedCents: Cents;
  employerContributedCents: Cents;
  remainingCents: Cents | null;
  excessCents: Cents;
  ruleVersion: string;
}

interface FundingSourceQuote {
  accountId: string;
  requestedCents: Cents;
  grossWithdrawalCents: Cents;
  taxWithholdingCents: Cents;
  estimatedTaxCents: Cents;
  penaltyCents: Cents;
  feesCents: Cents;
  netAvailableCents: Cents;
  settlementDate: string;
  opportunityWarnings: readonly string[];
  eligibilityReasonCodes: readonly string[];
}
```

Target APIs: `accountRulesForDate`, `computeContributionRoom`,
`quoteAccountWithdrawal`, `quoteFundingSources`, `applyAccountTransaction`, and
`validateQualifiedWithdrawal`. Classification and dollar tax remain separate:
accounts determines tax character; `tax/` computes liability.

## Simulation rules

- Rules are selected by jurisdiction and effective tax year; historical runs
  retain the original rule version.
- Contribution caps that are shared across account types are enforced at the
  limit-group/owner level, not separately for each account.
- Employer contributions and vesting are tracked separately from employee cash.
  Unvested money is not available for a home purchase or net worth available-to-
  spend view.
- A withdrawal quote and execution use the same ordering, basis, qualification,
  withholding, penalty, fee, and settlement rules. Execution must fail or
  re-quote if material inputs/rules changed.
- `taxFree + ordinaryIncome + capitalGains === grossWithdrawal`; penalty and
  withholding are additional cash effects and must not be confused with tax
  character.
- Using a retirement/education/health account for housing requires an explicit
  purpose and qualification result. No UI path may silently mark it qualified.
- Funding transfers between wrappers preserve basis/source metadata and do not
  create income unless the rules say the transaction is taxable.

## Major decision-panel outputs

For a home purchase or other large crossroad, provide a funding-source table:

- account label/type/owner, balance, vested and liquid amount, and settlement;
- requested gross amount versus net cash delivered after withholding, estimated
  tax, penalty, and fees;
- qualification status and plain-language reason codes;
- remaining account balance, contribution room impacts, forfeited match/benefit,
  and long-horizon opportunity-cost input for `portfolio/`;
- recommended ordering may be shown as educational guidance, but assumptions
  and jurisdiction/date must be visible and the player can inspect every cost.

Cash/down-payment affordability must consume `netAvailableCents`, not gross
account balance.

## Reference data needed

Versioned annual limits, catch-ups, income phase-outs, penalty ages/rates,
qualification rules, withholding defaults, employer plan/match archetypes,
vesting schedules, RMD/lifetime rules, and regional first-home programs. Every
rule needs jurisdiction, effective period, source, and confidence/status.

## Tests and acceptance criteria

- Current invariant holds for all account types: tax-free + ordinary-income +
  capital-gain portions equal gross; penalties are additional.
- A pre-59.5 Traditional 401(k) withdrawal is ordinary income plus modeled 10%
  penalty; at 60 the current penalty is zero. Roth basis exits before earnings.
- Shared Traditional/Roth 401(k) and IRA caps are enforced once per owner/group;
  catch-up boundaries and annual rule changes are tested.
- Gross-to-net funding quotes reconcile tax, withholding, penalty, fees, and
  settlement, and never exceed vested/liquid balance.
- A non-qualified HSA/529 withdrawal and a qualified one produce distinct,
  explainable results; purpose cannot be inferred from the popup route.
- Edge cases cover age 59.5/65 boundaries, zero basis, loss below basis, partial
  vesting, excess contribution, rollover, multiple owners, rule-year boundary,
  stale quote, and a housing program with repayment/recapture conditions.

## Modeled today versus deferred

Modeled today: account taxonomy, 401(k)/IRA limits and catch-ups, average-cost
withdrawal decomposition, Roth/529 contributions-first ordering, and penalty
age gates.

Still deferred: HSA/529 caps, Traditional-IRA deductibility phase-outs, Roth
five-year rules, RMDs, employer match/vesting, account loans, withholding,
regional homebuyer accounts/programs, and automatic taxable dividend/capital-
gain drag. Returning `null` for an unmodeled cap is preferable to inventing one.

## Dependencies and open questions

Depends on: `money/`, `reference-data/`; composed with `assets/`, `portfolio/`,
`income/`, `tax/`, `statement/`, and `simulation/`.

Open questions: initial country/tax system, precision of tax estimates in a
decision preview, plan-loan support, source-bucket depth, beneficiary simulation,
and whether “recommended funding order” is in engine policy or UI guidance.
