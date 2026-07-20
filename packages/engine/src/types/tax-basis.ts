import type { Cents } from "../money/index.js";

export type FilingStatus = "single" | "marriedFilingJointly" | "marriedFilingSeparately" | "headOfHousehold";

/**
 * Year-to-date accumulators needed to apply marginal tax rules correctly
 * across a calendar year (brackets, wage-base caps, NIIT thresholds all
 * depend on cumulative-year figures, not a single month in isolation).
 * Reset to zero every January by the simulation reducer, never by tax
 * logic itself.
 */
export interface TaxBasisState {
  filingStatus: FilingStatus;
  calendarYear: number;
  ytdGrossWagesCents: Cents;
  ytdFederalTaxableWagesCents: Cents;
  ytdFicaWagesCents: Cents;
  ytdFederalWithheldCents: Cents;
  ytdStateWithheldCents: Cents;
  ytdRetirementContributionsCents: Cents;
  ytdRealizedLongTermGainsCents: Cents;
  ytdRealizedShortTermGainsCents: Cents;
  ytdNetInvestmentIncomeCents: Cents;
}

export function initialTaxBasis(calendarYear: number, filingStatus: FilingStatus): TaxBasisState {
  return {
    filingStatus,
    calendarYear,
    ytdGrossWagesCents: 0,
    ytdFederalTaxableWagesCents: 0,
    ytdFicaWagesCents: 0,
    ytdFederalWithheldCents: 0,
    ytdStateWithheldCents: 0,
    ytdRetirementContributionsCents: 0,
    ytdRealizedLongTermGainsCents: 0,
    ytdRealizedShortTermGainsCents: 0,
    ytdNetInvestmentIncomeCents: 0,
  };
}
