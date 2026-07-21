# physical-assets

## Current responsibility

This domain owns non-financial property whose value changes over time, such as
a home or vehicle. Today it supports an annual appreciation/depreciation rate,
flat monthly upkeep, an optional `linkedDebtId`, and equity calculated from the
current value less a balance supplied by `simulation/`.

The debt link is intentionally an ID rather than an import from `debts/`. A
property may be bought for cash and a debt may have no physical collateral.

Current entry point: `index.ts` exports `PhysicalAssetConfig`,
`PhysicalAssetState`, `currentPhysicalAssetValueCents`, and
`computeEquityCents`.

## Richer life-sim requirements

For a meaningful rent-versus-buy crossroad, a home needs more detail than a
purchase price and one value-change rate:

- property kind: detached, semi-detached/townhouse, condo, apartment/coop,
  manufactured/mobile home, rural/acreage, or multi-unit;
- location/reference-market ID, size, age/year built, condition, bedrooms,
  bathrooms, parking, land/lot, energy profile, and accessibility attributes;
- purchase month and price, expected closing costs, inspection/legal fees,
  moving costs, immediate repairs/renovations, and expected sale costs;
- land/building split where data supports it (land generally does not
  depreciate like a structure), appreciation scenario, condition decline, and
  renovation/value improvements;
- tenure state (`searching`, `owned`, `listed`, `sold`) and occupancy (`primary`,
  `secondary`, `rental`), allowing vacancies or rental income to be added later;
- links to financing and to recurring cost obligations: mortgage(s), property
  tax, homeowners/condo insurance, HOA/condo fees, maintenance, utilities, and
  special assessments;
- event risk such as major repairs, damage, insurance claims, assessment
  changes, and forced/early sale.

Rent is not a physical asset. A rental option belongs in the housing reference
catalog and becomes recurring expense state when selected.

## Proposed model and API contracts

These are target contracts, not claims about the current implementation:

```ts
type PropertyKind =
  | "detached" | "semiDetached" | "townhouse" | "condo"
  | "coop" | "manufactured" | "rural" | "multiUnit";

interface PropertyOption {
  id: string;
  marketId: string;
  kind: PropertyKind;
  label: string;
  listPriceCents: Cents;
  bedrooms: number;
  bathrooms: number;
  floorAreaSqFt?: number;
  yearBuilt?: number;
  condition: "needsWork" | "average" | "updated" | "new";
  hoaMonthlyCents?: Cents;
  estimatedPropertyTaxAnnualCents: Cents;
  estimatedInsuranceAnnualCents: Cents;
  estimatedMaintenanceAnnualCents: Cents;
  tags: readonly string[];
}

interface PropertyAcquisitionPlan {
  optionId: string;
  purchaseMonth: MonthKey;
  offerPriceCents: Cents;
  downPaymentCents: Cents;
  closingCostCents: Cents;
  immediateRepairCents: Cents;
  linkedDebtId?: string;
}

interface PropertyValuationAssumptions {
  annualLandChangeRate?: number;
  annualStructureChangeRate?: number;
  annualCompositeChangeRate: number;
  saleCostRate: number;
}

interface PropertySnapshot {
  marketValueCents: Cents;
  debtBalanceCents: Cents;
  grossEquityCents: Cents;
  estimatedSaleCostCents: Cents;
  netSaleProceedsCents: Cents;
}
```

Useful pure APIs should include `validatePropertyAcquisitionPlan`,
`projectPropertyValue`, `estimateSaleProceeds`, and
`buildPropertyDecisionOption`. Validation must return explainable reason codes
rather than only a boolean so UI can say why an option is unavailable.

## Simulation rules

- Values use nominal dollars and the engine-wide month convention. The current
  annual compounding convention remains the default and must be identical in a
  preview and an executed simulation.
- The acquisition month debits down payment, closing costs, and immediate work
  from a selected funding source. The property and linked debt are created
  atomically; an unaffordable transaction must not leave partial state.
- Taxes, insurance, HOA, maintenance, and utilities are cash-flow obligations,
  not reductions in property value. They are owned by `expenses/`, even when a
  debt servicer collects some of them through escrow.
- Escrow is packaging of an underlying obligation. The cash-flow aggregator
  counts either the mortgage draft including escrow or the separately paid
  expense, never both. Cross-domain IDs must make that reconciliation testable.
- Appreciation is uncertain and never presented as guaranteed. Scenario runs
  should support conservative/base/optimistic rates and market shocks.
- Maintenance preserves condition but does not automatically increase market
  value. A capital improvement must explicitly update basis/value assumptions.
- On sale, calculate gross equity, transaction costs, debt payoff, and net
  proceeds separately. Negative equity is allowed and creates a funding need.

## Major decision-panel outputs

The rent-versus-buy popup should receive serializable view data, not domain
state objects. For each searchable/filterable property tile expose:

- image/catalog label, property kind, location, size, condition, price, and tags;
- required cash at closing and cash remaining after closing;
- estimated mortgage principal and interest plus tax, insurance, HOA,
  maintenance, utilities, and total monthly housing cash flow;
- expected market value, debt balance, gross equity, sale costs, and net equity
  at useful horizons (for example 1, 5, 10, and 25 years);
- break-even month versus the selected rental, cumulative unrecoverable cost,
  and portfolio/cash opportunity cost supplied by orchestration;
- affordability status and reason codes, sensitivity to rate/down-payment/home
  price, and explicit assumption/source labels;
- trade-off flags such as high maintenance, condo assessment risk, long commute,
  low liquidity, or negative-equity risk.

The panel may describe estimated “depreciation” as structure wear or a negative
market scenario; it must not imply that every owner-occupied home mechanically
depreciates.

## Reference data needed

`reference-data/` should provide versioned, region- and effective-date-specific
property catalogs or archetypes, market appreciation ranges, closing/sale cost
assumptions, tax assessment rules, insurance estimates, maintenance-by-age/type,
utilities, HOA ranges, and rent comparables. Every generated option should keep
the reference IDs and assumption version used for replayability.

## Tests and acceptance criteria

- Current value compounds from purchase price/month consistently with income
  and expense annual compounding; a negative rate produces depreciation.
- `computeEquityCents` without debt returns full value and permits negative
  equity when debt exceeds value.
- Acquisition cash equals down payment + closing + immediate costs; property and
  debt creation is atomic.
- Net sale proceeds reconcile exactly to sale price - selling costs - debt
  payoff, including an underwater sale.
- Tax, insurance, HOA, and maintenance appear exactly once in monthly cash flow,
  whether escrowed or paid directly.
- Preview output and the first executed month use identical assumptions and
  cents-rounding.
- Search/filter results are deterministic for identical reference-data versions.
- Edge cases cover all-cash purchase, zero/very small down payment, condo special
  assessment, missing market data, renovation, sale before break-even, severe
  market decline, paid-off mortgage, and multiple liens.

## Dependencies and open questions

Depends on: `money/`, `types/`; composed by `simulation/` with `debts/`,
`expenses/`, `assets/`, `portfolio/`, `income/`, and `reference-data/`.

Open questions: supported countries and property law, whether land/building
valuation is required in v1, treatment of owner-occupied capital gains,
refinancing/HELOC support, rental-property income and vacancies, and whether
listings are real data or curated archetypes.
