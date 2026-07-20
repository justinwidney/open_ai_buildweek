import type { Cents } from "../money/index.js";
import type { FilingStatus } from "../types/tax-basis.js";
import { clampNonNegative } from "../money/index.js";

/**
 * How much of a Social Security benefit is subject to federal income tax,
 * via the standard "provisional income" test (IRC §86). Base amounts are
 * fixed by statute since 1984 and are not inflation-indexed. This is the
 * commonly used simplified two-tier approximation of the IRS worksheet,
 * not a line-by-line transcription of Publication 915's worksheet.
 * Married-filing-separately living with a spouse effectively has a $0
 * base amount (i.e. up to 85% is taxable almost immediately) — modeled
 * here as thresholds of 0/0 for that status.
 */
export function taxableSocialSecurityBenefitCents(
  filingStatus: FilingStatus,
  otherIncomeCents: Cents,
  ssBenefitCents: Cents,
): Cents {
  const [tier1, tier2] =
    filingStatus === "marriedFilingJointly"
      ? [3_200_000, 4_400_000] // $32,000 / $44,000 in cents
      : filingStatus === "marriedFilingSeparately"
        ? [0, 0]
        : [2_500_000, 3_400_000]; // single / headOfHousehold: $25,000 / $34,000 in cents

  const provisionalIncome = otherIncomeCents + Math.round(0.5 * ssBenefitCents);

  if (provisionalIncome <= tier1) return 0;

  if (provisionalIncome <= tier2) {
    const tier1Taxable = Math.round(0.5 * (provisionalIncome - tier1));
    return Math.min(Math.round(0.5 * ssBenefitCents), tier1Taxable);
  }

  const tier1BandTaxable = Math.round(0.5 * Math.min(tier2 - tier1, ssBenefitCents));
  const tier2Taxable = Math.round(0.85 * (provisionalIncome - tier2)) + tier1BandTaxable;
  return clampNonNegative(Math.min(Math.round(0.85 * ssBenefitCents), tier2Taxable));
}
