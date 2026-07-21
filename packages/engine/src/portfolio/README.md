# portfolio

## Current responsibility

This domain owns market investments. Holdings grow under a pluggable fixed,
Monte Carlo, or historical `ReturnsStrategy`; market value and cost basis are
separate. Contributions raise both. Withdrawals use a simplified average-cost
model and currently calculate long-term capital-gains tax on realized gain.

Current entry point: `index.ts` exports `HoldingConfig`, `HoldingState`,
`PortfolioState`, `initialHoldingState`, `tickHoldingGrowth`,
`applyContribution`, `withdrawFromHolding`, and `portfolioViews`.

This remains separate from `assets/` (cash/plain interest), `physical-assets/`
(home/car), and `accounts/` (the holding's tax wrapper).

## Richer life-sim requirements

Large decisions require the portfolio to model what is sold and what future
wealth is displaced:

- asset class, security/fund/archetype, currency, risk level, liquidity,
  settlement, fees, distributions, and account ID rather than only account type;
- allocation targets, contribution schedule, employer match source, rebalancing,
  dividends/interest, fees, and taxable drag;
- tax lots (eventually), acquisition dates, short/long-term character, losses,
  loss carryforwards, and account-specific withdrawal classification;
- nominal and real scenario paths, volatility/sequence risk, correlated asset
  classes, and deterministic replay through `returns/` and `rng/`;
- sale/funding plan for down payment or emergencies, including gross sale, tax,
  penalty, fees, settlement date, and net cash;
- counterfactual opportunity cost: preserve investments versus sell for a home,
  with no promise that an expected return will occur.

## Proposed model and API contracts

```ts
interface HoldingConfigV2 {
  id: string;
  label: string;
  assetClassId: string;
  accountId: string;
  currency: string;
  liquidity: "daily" | "delayed" | "locked";
  settlementDays: number;
  annualFeeRate?: number;
}

interface TaxLot {
  id: string;
  holdingId: string;
  acquiredMonth: MonthKey;
  units?: number;
  marketValueCents: Cents;
  costBasisCents: Cents;
}

interface PortfolioFundingQuote {
  requestedNetCents: Cents;
  grossSalesCents: Cents;
  realizedGainCents: Cents;
  estimatedTaxCents: Cents;
  penaltyCents: Cents;
  feesCents: Cents;
  netAvailableCents: Cents;
  settlementDate: string;
  sales: readonly { holdingId: string; grossCents: Cents; basisCents: Cents }[];
  warnings: readonly string[];
}

interface OpportunityCostProjection {
  horizonMonth: MonthKey;
  expectedValueCents: Cents;
  percentileValuesCents?: Readonly<Record<string, Cents>>;
  contributionsDisplacedCents: Cents;
  assumptions: readonly AssumptionRef[];
}
```

Target APIs: `projectPortfolio`, `quotePortfolioFunding`,
`executePortfolioFunding`, `rebalancePortfolio`, and
`compareInvestmentOpportunityCost`. `accounts/` should classify wrapper tax and
penalties; `tax/` prices the resulting liability.

## Simulation rules

- Market growth changes value, never basis. Contributions add equal value/basis
  before fees; sales reduce both according to the documented lot method.
- Returns, fees, dividends, contributions, withdrawals, and rebalancing have an
  explicit monthly order shared by preview and simulation.
- A sale never exceeds available/vested holdings and produces cash only after
  settlement. Market movement between quote and execution requires a re-quote or
  explicit slippage rule.
- Down-payment funding uses net proceeds, not gross holdings. Tax, account
  penalty, fees, and settlement all participate in feasibility.
- Opportunity cost compares identical cash flows and horizons: the “rent” path
  invests any initial/monthly savings, while the “buy” path includes equity and
  sale costs. Do not compare house equity with an investment path that omitted
  the renter's contributions.
- Expected returns are scenario assumptions, not guaranteed appreciation.
  Monte Carlo panels expose distributions/percentiles and deterministic seeds.
- Average cost remains the explicit v1 simplification until tax-lot selection is
  implemented; UI must not claim optimal-lot tax minimization.

## Major decision-panel outputs

For rent-versus-buy or another major spend show:

- holdings by account, current value, basis/gain, vested/liquid status, risk, and
  settlement date;
- exact proposed sales, gross amount, estimated gain/tax/penalty/fees, and net
  cash delivered for closing;
- remaining allocation, concentration/risk change, emergency liquidity, and any
  interrupted recurring contributions or lost employer match;
- projected forgone value at 1/5/10/25-year horizons using the selected return
  scenario, with percentile range for stochastic runs;
- a fair rent-and-invest versus buy-and-build-equity comparison whose cash-flow
  assumptions and reference versions are inspectable.

## Reference data needed

Versioned asset-class returns, volatility/correlation, distributions/yields,
fees, inflation series, trading/settlement assumptions, and tax character inputs.
Historical datasets need provenance and date coverage; scenario presets must
identify whether numbers are nominal or real.

## Tests and acceptance criteria

- Growth changes balance but not basis; contributions change both equally; only
  a sale realizes gain under the current model.
- Withdrawal is capped at balance and net proceeds reconcile exactly to gross -
  tax (and, in V2, penalty/fees). Loss positions do not create positive gains.
- Funding quotes use net cash, observe settlement, and cannot spend unvested or
  locked holdings.
- Preview and execution share ordering, return seed, rounding, and rule versions;
  stale-price handling is deterministic.
- Opportunity-cost comparisons balance initial and monthly cash-flow differences
  on both paths and include terminal property sale costs/equity supplied by
  orchestration.
- Monte Carlo output is reproducible for a seed and percentile values are ordered.
- Edge cases cover empty holding, zero basis, value below basis, full liquidation,
  multiple wrappers, settlement after closing, currency mismatch, high fees,
  market crash immediately before purchase, and sequence-of-returns risk.

## Dependencies and open questions

Depends on: `returns/`, `rng/`, `accounts/`, `tax/`, `adjustable/`, and `money/`;
composed with `assets/`, `physical-assets/`, `expenses/`, and `simulation/`.

Open questions: tax-lot priority, short-term gains/loss carryforwards, dividend
tax drag, exact trade/settlement calendar, foreign exchange, margin/borrowing,
portfolio optimization policy, and which opportunity-cost metric the UI leads
with (median, expected, downside, or range).
