# debts

## Current responsibility

This domain owns amortizing liabilities: mortgages, auto, student, and personal
loans. A debt payment is an `Adjustable`: gross is total household cash out and
line items reconcile principal, interest, and optional escrow to zero net. It
supports a fixed rate, term, start month, remaining balance, activity check, and
principal reduction.

Current entry point: `index.ts` exports `computeAmortizedPaymentCents`,
`DebtConfig`, `DebtState`, `initialDebtState`, `isDebtActive`,
`applyPrincipalPayment`, `buildDebtPaymentAdjustable`, and `debtViews`.

## Richer life-sim requirements

A mortgage choice needs to model both qualification and life after closing:

- debt kind and collateral ID; lender/product ID; fixed, variable/adjustable,
  interest-only, or blended product; term and amortization separately where the
  jurisdiction distinguishes them;
- quoted/base rate, APR, compounding convention, adjustable-rate index/margin,
  reset schedule, caps/floors, rate lock, points, origination/lender fees;
- original principal, down payment, loan-to-value (LTV), private/default mortgage
  insurance thresholds and premiums, escrow behavior, and closing cash;
- payment frequency and due schedule (monthly, semi-monthly, biweekly,
  accelerated biweekly, weekly) without treating a label as a math shortcut;
- prepayment privileges/penalties, extra principal, recast, refinance, renewal,
  delinquency, missed-payment fees, payoff quote, and foreclosure/default risk;
- clear distinction between qualification estimates and the household's actual
  month-by-month affordability.

## Proposed model and API contracts

```ts
type DebtKind = "mortgage" | "auto" | "student" | "personal" | "creditLine";
type RateModel =
  | { kind: "fixed"; annualRate: number }
  | { kind: "adjustable"; indexId: string; margin: number; resetMonths: number;
      periodicCap?: number; lifetimeCap?: number; floor?: number };
type PaymentFrequency = "monthly" | "semiMonthly" | "biweekly" | "weekly";

interface DebtProduct {
  id: string;
  kind: DebtKind;
  jurisdictionId: string;
  rateModel: RateModel;
  amortizationMonths: number;
  productTermMonths?: number;
  paymentFrequency: PaymentFrequency;
  minimumDownPaymentRules: readonly DownPaymentBand[];
  mortgageInsuranceRuleId?: string;
  feeRuleId?: string;
}

interface MortgageAffordabilityInput {
  purchasePriceCents?: Cents;
  availableDownPaymentCents: Cents;
  grossMonthlyIncomeCents: Cents;
  stableMonthlyIncomeCents: Cents;
  monthlyDebtObligationsCents: Cents;
  estimatedTaxMonthlyCents: Cents;
  estimatedInsuranceMonthlyCents: Cents;
  hoaMonthlyCents: Cents;
  heatingOrUtilityMonthlyCents?: Cents;
  requiredReserveCents: Cents;
  productId: string;
}

interface MortgageAffordabilityResult {
  maxPurchasePriceCents: Cents;
  maxPrincipalCents: Cents;
  paymentCents: Cents;
  housingRatio: number;
  totalDebtRatio: number;
  loanToValue: number;
  cashToCloseCents: Cents;
  cashAfterCloseCents: Cents;
  eligible: boolean;
  reasonCodes: readonly string[];
  assumptions: readonly AssumptionRef[];
}
```

Target pure APIs: `quoteDebtProduct`, `computePaymentSchedule`,
`estimateMortgageAffordability`, `applyDebtPayment`, `applyExtraPrincipal`,
`quotePayoff`, and `quoteRefinance`. Schedule rows should expose payment date,
principal, interest, escrow components, fees, and ending balance.

## Simulation rules

- Interest accrual and payment cadence use explicit conventions and dates. Never
  implement biweekly as “monthly / 2”; it produces 26 payments per year.
- Fixed-loan rounding is deterministic in cents. The last payment is capped and
  adjusted so principal never goes below zero.
- Qualification applies jurisdiction/product limits (housing-cost ratio, total
  debt-service ratio, LTV, stress/qualifying rate, down-payment minimum, reserves)
  and returns each failed rule. It is an educational estimate, not an approval.
- “Can afford” must report at least two constraints: lender-style maximum and a
  cash-flow-safe amount after taxes, expenses, savings goals, and reserves.
- Rate resets change future interest/payment only on the configured reset date.
  Scenario previews must show payment shock and lifetime-cap behavior.
- An extra payment reduces principal and subsequent interest; product rules
  determine penalties and whether the scheduled payment recasts.
- Refinance is represented as payoff of one debt plus creation costs and a new
  debt, preserving an auditable event history.
- Property tax and insurance remain underlying `expenses/` obligations. Escrow
  line items may reference those expense IDs. Orchestration counts a mortgage
  draft containing escrow once and marks the referenced expenses as paid; it
  must not add them again as separate cash outflow.

## Major decision-panel outputs

For every mortgage tile and selected property show:

- product/rate/APR, fixed or adjustable behavior, amortization and product term,
  payment frequency, estimated principal, LTV, and required down payment;
- principal-and-interest payment, mortgage insurance, property tax, property
  insurance, and total draft, with costs outside escrow shown separately;
- max affordable purchase price/principal, cash to close, cash remaining, debt
  ratios, reserve months, and eligibility/reason codes;
- first-payment breakdown and lifetime/selected-horizon principal, interest,
  escrow, fees, and ending balance;
- sensitivity for rates, price, down payment, income loss, and renewal/reset;
- payoff/refinance/prepayment terms and warnings; assumption dates and sources.

## Reference data needed

Versioned lender/product archetypes, benchmark/index rates, stress-test rules,
minimum down-payment bands, mortgage-insurance premiums, fee/points assumptions,
debt-ratio limits, prepayment conventions, and jurisdiction-specific term and
compounding rules. Saved choices retain the product and ruleset version.

## Tests and acceptance criteria

- `resolveAdjustable(...).netCents === 0`; principal + interest + escrow equals
  the total draft exactly.
- Zero-rate and ordinary fixed-rate schedules amortize to zero; the final payment
  never overpays; interest generally falls and principal rises on a level loan.
- Monthly, semi-monthly, biweekly, and weekly schedules have correct annual
  occurrence counts and deterministic cents totals.
- Affordability is constrained by each of down payment, closing cash/reserve,
  housing ratio, total debt ratio, LTV, and qualifying/stress rate, with stable
  reason codes for failures.
- A rate reset observes date and cap/floor; payment shock is visible in views.
- Extra payment and refinance flows reconcile principal, penalties, fees, and
  cash; no debt is silently erased.
- Escrowed tax/insurance is included once, and direct-pay costs still appear.
- Edge cases cover zero principal, invalid term/rate, negative amortization,
  missed payment, underwater collateral, early payoff, rate spike, income drop,
  and product data expiring between preview and selection.

## Dependencies and open questions

Depends on: `adjustable/`, `money/`, `types/`; composed with `physical-assets/`,
`expenses/`, `income/`, `assets/`, `reference-data/`, and `simulation/`.

Open questions: initial jurisdictions, credit score/history modeling, lender
approval randomness, ARM/variable-rate depth for v1, PMI cancellation rules,
Canadian renewal versus US long-term mortgage semantics, and default/foreclosure
scope.
