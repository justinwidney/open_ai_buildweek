# expenses

## Current responsibility

This domain owns recurring household outflows such as rent, groceries,
insurance, and discretionary spending. An expense is an `Adjustable` with an
empty pipeline by default so reimbursements, subsidies, or discounts can later
be represented as line items. Base monthly amounts inflate with annual
compounding while active.

Current entry point: `index.ts` exports `ExpenseConfig`, `ExpenseState`,
`isExpenseActive`, `buildExpenseAdjustable`, and `expenseViews`.

## Richer life-sim requirements

The simulator needs an obligation model, not just one monthly amount:

- structured categories and subcategories (`housing.rent`, `housing.propertyTax`,
  `housing.insurance`, `housing.hoa`, `housing.maintenance`, utilities, transport,
  food, healthcare, childcare, education, subscriptions, and discretionary);
- frequency and due schedule: weekly, biweekly, monthly, quarterly, annual,
  seasonal, usage-based, or one-time; start/end dates and proration;
- fixed, indexed, percentage-of-value, tiered, stochastic, or event-driven amount
  rules; region and household-size drivers;
- payer/member, linked home/vehicle/employment/lease, autopay/funding account,
  required versus optional, and cancellation/late-fee rules;
- reimbursements, employer benefits, government subsidies, insurance claims,
  deductibles, and cost sharing as auditable adjustments;
- explicit estimate/actual/projection status and assumption/source metadata.

Housing must separate recoverable principal/equity from unrecoverable cash cost.
For renters that includes rent, renters insurance, utilities, deposits/fees, and
moving. For owners it includes interest, property tax, homeowners insurance,
HOA, maintenance/repairs, utilities, mortgage insurance, and transaction costs.

## Proposed model and API contracts

```ts
type ExpenseCadence =
  | "weekly" | "biweekly" | "monthly" | "quarterly" | "annual"
  | "seasonal" | "oneTime";

type ExpenseAmountRule =
  | { kind: "fixed"; amountCents: Cents }
  | { kind: "annualIndexed"; baseCents: Cents; annualRate: number }
  | { kind: "percentOfLinkedValue"; annualRate: number; linkedAssetId: string }
  | { kind: "usage"; fixedCents: Cents; unitRateCents: Cents; unitsDriverId: string };

interface ExpenseConfigV2 {
  id: string;
  label: string;
  categoryId: string;
  required: boolean;
  cadence: ExpenseCadence;
  amountRule: ExpenseAmountRule;
  startMonth: MonthKey;
  endMonth?: MonthKey;
  linkedEntityId?: string;
  paymentChannel?: { kind: "direct" | "debtEscrow"; debtId?: string };
  assumptionRefs: readonly AssumptionRef[];
}

interface HousingCostBreakdown {
  principalCents: Cents;
  interestCents: Cents;
  rentCents: Cents;
  propertyTaxCents: Cents;
  insuranceCents: Cents;
  hoaCents: Cents;
  maintenanceCents: Cents;
  utilitiesCents: Cents;
  otherCents: Cents;
  totalCashOutCents: Cents;
  unrecoverableCostCents: Cents;
}
```

Target APIs: `expenseOccurrences`, `resolveExpenseForMonth`,
`buildHousingCostBreakdown`, `projectExpense`, and `validateExpenseLinks`.

## Simulation rules

- Cadence is converted into dated occurrences, not divided into a misleading
  average for ledger cash flow. Views may additionally expose normalized monthly
  cost for comparisons.
- Annual/quarterly bills create cash-flow spikes unless the scenario explicitly
  models a sinking fund or escrow.
- Percentage property tax/insurance/maintenance estimates use the linked
  property's appropriate assessed/insured/market value and the effective rule
  version. Assessment value is not assumed to equal market value.
- Expense inflation follows one engine-wide nominal convention. Fixed contracts
  change only on renewal or an event.
- An escrowed expense remains the semantic tax/insurance obligation, while the
  mortgage draft is its payment channel. Reconciliation IDs ensure that the
  household cash ledger counts it exactly once.
- Deposits are not automatically expenses: refundable lease/security deposits
  become restricted assets/receivables; only non-refundable fees are costs.
- Maintenance reserve and realized repair spending must not both be treated as
  cash paid unless the reserve is an actual transfer to a separate balance.

## Major decision-panel outputs

The rent-versus-buy popup needs side-by-side, horizon-consistent views:

- first-month and normalized monthly totals with every housing component;
- move-in/cash-to-close costs, refundable deposits, recurring costs, annual cash
  spikes, and emergency repair exposure;
- recoverable principal versus unrecoverable cost, and cumulative 1/5/10-year
  totals under the same inflation/reference assumptions;
- current amount, expected increase/renewal month, direct versus escrow payment,
  uncertainty range, and source/effective date;
- warnings for affordability, missing insurance, weak maintenance reserve,
  expiring lease, possible special assessment, or large seasonal utility bills.

## Reference data needed

Versioned regional rent ranges, property-tax/assessment rules, insurance by
property/renter profile, HOA/condo fees, maintenance by property age/type,
utilities and climate, moving/lease fees, general/category inflation, and
household-size consumption assumptions.

## Tests and acceptance criteria

- With no adjustments, `outOfPocketCents === totalMonthlyCents`; all adjustment
  line items reconcile exactly.
- Annual indexing follows the documented compounding convention and effective
  dates; fixed contracts remain fixed until renewal.
- Each cadence emits the correct number/date of occurrences, including leap-year
  and partial-period/proration cases where supported.
- Housing breakdown components sum exactly to total cash out, and owner principal
  is excluded from unrecoverable cost.
- Escrowed taxes/insurance appear once in both the cash ledger and cost view.
- Refundable deposits are excluded from expense totals; forfeiture can later
  convert the relevant amount to expense.
- Edge cases cover annual tax bill, mid-month move, lease-free month, subsidy,
  insurance deductible, vacant property, special assessment, missing reference
  data, high inflation, and expense ending on a boundary month.

## Dependencies and open questions

Depends on: `adjustable/`, `money/`, `types/`; composed with `debts/`,
`physical-assets/`, `household/`, `reference-data/`, and `simulation/`.

Open questions: daily versus monthly proration, whether actual budgeting and
simulation projections share this type, stochastic repair granularity, payer
splits between household members, and supported regional tax/insurance rules.
