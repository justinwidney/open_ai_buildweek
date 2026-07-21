# assets

## Current responsibility

This domain owns simple financial balances such as cash, checking, savings, and
money-market funds. They earn a plain interest rate rather than a market
`ReturnsStrategy`. Paychecks land here and expenses/debt payments draw here
before `simulation/` decides whether to sell portfolio holdings or report a
shortfall.

Current entry point: `index.ts` exports `FinancialAssetConfig`,
`FinancialAssetState`, `initialFinancialAssetState`, and `tickFinancialAsset`.
The current tick grows one month of interest, applies net cash flow, and clamps
the balance at zero.

## Richer life-sim requirements

Cash is the binding constraint behind major choices, so it needs to distinguish:

- checking, savings, high-yield savings, money market, certificate/term deposit,
  and restricted/escrow/deposit balances;
- owner/household member, institution/product, currency, account tax wrapper,
  access/liquidity, withdrawal delay, minimum balance, overdraft, and fees;
- nominal/APY rate, compounding and crediting frequency, introductory expiry,
  variable-rate reference, and maturity/early-redemption rule;
- earmarks such as emergency fund, down payment, closing costs, repairs, rent
  deposit, tax reserve, and goals, without double-counting one dollar in several
  available-funds totals;
- pending/dated deposits and withdrawals, transfers (not income/expense),
  interest earned, and insufficient-funds outcomes;
- restricted refundable housing deposits as assets until returned or forfeited.

## Proposed model and API contracts

```ts
type CashAssetKind =
  | "checking" | "savings" | "moneyMarket" | "termDeposit"
  | "restrictedDeposit" | "escrow";
type LiquidityClass = "immediate" | "delayed" | "locked" | "restricted";

interface FinancialAssetConfigV2 {
  id: string;
  label: string;
  kind: CashAssetKind;
  accountType?: AccountType;
  currency: string;
  annualInterestRate: number;
  compounding: "daily" | "monthly" | "annual";
  liquidity: LiquidityClass;
  withdrawalDelayDays?: number;
  minimumBalanceCents?: Cents;
  overdraftLimitCents?: Cents;
  feeRuleId?: string;
}

interface CashReservation {
  id: string;
  assetId: string;
  purpose: "emergency" | "downPayment" | "closing" | "repair" | "other";
  amountCents: Cents;
  hard: boolean;
}

interface LiquiditySnapshot {
  grossCashCents: Cents;
  restrictedCents: Cents;
  reservedCents: Cents;
  immediatelyAvailableCents: Cents;
  availableByDate: readonly { date: string; amountCents: Cents }[];
}
```

Target APIs: `projectFinancialAsset`, `reserveCash`, `releaseReservation`,
`transferCash`, `availableLiquidity`, and `applyCashTransaction`. Transactions
should return typed insufficiency reason codes rather than rely on clamping.

## Simulation rules

- Interest timing and compounding are explicit. Existing behavior (interest
  before current-month net flow) remains the default until a dated ledger exists.
- Deposits, withdrawals, and transfers are separate events. A transfer changes
  location, not household net worth or income.
- A balance must never silently go negative. A shortfall becomes an explicit
  result for `simulation/` to resolve via overdraft, credit, portfolio sale,
  delayed purchase, or failed decision.
- Reservations reduce available liquidity but not account balance or net worth.
  Hard reservations cannot be spent without an explicit release/override event.
- Buying a home debits down payment, closing costs, and immediate repairs on the
  acquisition date. An atomic preflight ensures all funding is available.
- “Cash after close” preserves the configured emergency reserve; gross cash is
  not synonymous with safely spendable cash.
- A refundable rent/security deposit moves cash into a restricted asset. Return
  releases it; forfeiture converts the lost amount to an expense.
- Term deposits and pending transfers count only on dates they can settle, and
  early-redemption penalties are exposed before use.

## Major decision-panel outputs

For rent-versus-buy and other crossroads expose:

- gross, restricted, reserved, and immediately available cash;
- required down payment, closing/moving/repair cash, refundable deposit, and
  funding gap/surplus for each option;
- cash remaining after the decision, emergency-fund months remaining, and the
  first date delayed funds become usable;
- interest/fees forgone by moving cash, early-redemption penalties, and warnings
  for minimum-balance or overdraft risk;
- a proposed funding plan by account with editable allocations and stable reason
  codes when it cannot settle.

The UI must not present retirement/investment balances as cash; `accounts/` and
`portfolio/` supply their taxes, penalties, volatility, and settlement effects.

## Reference data needed

Versioned product archetypes for rates, compounding, minimum balances, fees,
deposit insurance labels, settlement delay, and term-deposit penalties. Product
data should carry region, currency, effective date, expiry, and source.

## Tests and acceptance criteria

- Under current behavior, interest is applied before net cash flow and the stored
  balance never becomes negative.
- V2 insufficient-funds handling returns an explicit unresolved remainder and
  does not discard the deficit through clamping.
- Gross = restricted + reserved-available overlap rules + spendable amounts with
  no reservation counted twice; reservations do not change net worth.
- Transfer-out plus transfer-in nets to zero aside from declared fees.
- A housing acquisition either settles every cash component and creates state or
  changes nothing.
- Cash-after-close and emergency-month values match the same expense forecast
  shown in the decision panel.
- Edge cases cover zero balance, zero/negative rate, overdraft, locked deposit,
  withdrawal delay crossing closing, overlapping reservations, returned/forfeit
  deposit, multiple currencies, rate expiry, and a closing-cost increase.

## Dependencies and open questions

Depends on: `money/`, `accounts/`; composed with `simulation/`, `expenses/`,
`goals/`, `portfolio/`, `debts/`, and `physical-assets/`.

Open questions: multi-currency/FX scope, dated transaction-ledger ownership,
overdraft as negative cash versus debt, bank failure/deposit insurance events,
interest taxation, and whether reservations are engine state or planning-only.
