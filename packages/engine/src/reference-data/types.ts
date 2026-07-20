import type { Cents } from "../money/index.js";
import type { FilingStatus } from "../types/tax-basis.js";

/** Every researched dataset carries where it came from and when, so it can be refreshed deliberately later. */
export interface Provenance {
  source: string;
  url: string;
  asOf: string; // ISO date the figure was current as of, not the date we happened to look it up
}

export interface Bracket {
  /** Taxable income at which this bracket begins. */
  fromCents: Cents;
  rate: number;
}

export type BracketsByFilingStatus = Record<FilingStatus, readonly Bracket[]>;

export interface FederalIncomeTaxRules extends Provenance {
  taxYear: number;
  brackets: BracketsByFilingStatus;
  standardDeductionCents: Record<FilingStatus, Cents>;
}

export interface FicaRules extends Provenance {
  taxYear: number;
  socialSecurityRate: number;
  socialSecurityWageBaseCents: Cents;
  medicareRate: number;
  additionalMedicareRate: number;
  additionalMedicareThresholdCents: Record<FilingStatus, Cents>;
}

export interface SocialSecurityRules extends Provenance {
  taxYear: number;
  /** PIA formula bend points, in cents of AIME. */
  bendPoint1Cents: Cents;
  bendPoint2Cents: Cents;
  /** Marginal PIA credit below bendPoint1, between the two bend points, and above bendPoint2. */
  belowBendPoint1Rate: number;
  betweenBendPointsRate: number;
  aboveBendPoint2Rate: number;
}

export interface CapitalGainsRules extends Provenance {
  taxYear: number;
  longTermBrackets: BracketsByFilingStatus; // rates 0 / 0.15 / 0.20
  niitRate: number;
  niitThresholdCents: Record<FilingStatus, Cents>;
}

export interface RetirementLimits extends Provenance {
  taxYear: number;
  employeeDeferralLimitCents: Cents;
  catchUp50PlusCents: Cents;
  /** SECURE 2.0 "super catch-up," ages 60-63; replaces (does not stack with) the standard catch-up. */
  superCatchUp60to63Cents: Cents;
  combinedEmployerEmployeeLimitCents: Cents;
  iraLimitCents: Cents;
  iraCatchUp50PlusCents: Cents;
}

export type StateTaxArchetype = "no-income-tax" | "flat" | "progressive";

export interface StateTaxRules extends Provenance {
  stateCode: string;
  stateName: string;
  archetype: StateTaxArchetype;
  taxYear: number;
  /** Only meaningful when archetype === "flat"; the single rate applied to all taxable income. */
  flatRate?: number;
  /** Only meaningful when archetype === "progressive". */
  brackets?: readonly Bracket[];
  /** Informational note about a notable local/city layer on top of this state's tax (e.g. NYC), not modeled numerically. */
  localTaxNote?: string;
}

export interface ExpenseCategoryBenchmark {
  category: string;
  annualCents: Cents;
  shareOfTotal: number;
}

export interface HouseholdExpenseBenchmarks extends Provenance {
  surveyYear: number;
  annualTotalCents: Cents;
  categories: readonly ExpenseCategoryBenchmark[];
}

export type HomePriceTier = "low-cost-metro" | "mid-cost-metro" | "high-cost-metro" | "national-median";

export interface HomePriceBenchmark extends Provenance {
  tier: HomePriceTier;
  exampleMetro: string;
  medianPriceCents: Cents;
}

export interface HomePriceBenchmarks extends Provenance {
  asOfMonth: string;
  nationalMedianCents: Cents;
  thirtyYearMortgageRate: number;
  tiers: readonly HomePriceBenchmark[];
}

/** One calendar year's total return for an asset class, for historical-backtest replay. */
export interface HistoricalAnnualReturn {
  year: number;
  /** Nominal total return including reinvested dividends/coupons. */
  totalReturn: number;
}

export interface HistoricalReturnsDataset extends Provenance {
  assetClassId: string;
  annualReturns: readonly HistoricalAnnualReturn[];
}

export interface ReferenceDataBundle {
  federalIncomeTax: FederalIncomeTaxRules;
  fica: FicaRules;
  socialSecurity: SocialSecurityRules;
  capitalGains: CapitalGainsRules;
  retirementLimits: RetirementLimits;
  stateTax: Record<string, StateTaxRules>;
  expenseBenchmarks: HouseholdExpenseBenchmarks;
  homePriceBenchmarks: HomePriceBenchmarks;
  historicalReturns: Record<string, HistoricalReturnsDataset>;
}
