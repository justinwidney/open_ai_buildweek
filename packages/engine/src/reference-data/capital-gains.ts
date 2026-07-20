import { cents } from "../money/index.js";
import type { BracketsByFilingStatus, CapitalGainsRules } from "./types.js";

/**
 * 2026 long-term capital gains brackets. Single and MFJ 0%/15% thresholds
 * and the 15%/20% cutover are directly confirmed against IRS Rev. Proc.
 * 2025-32 ($49,450 / $98,900 and $545,500 / $613,700). Head-of-household
 * and married-filing-separately thresholds are reconstructed the same way
 * as the federal ordinary brackets: scaling the last published (2025)
 * thresholds by the same ~2.28% factor implied by the confirmed figures
 * above (MFS mirrors half of the MFJ thresholds, per the standard IRS
 * pattern). Short-term gains are not modeled separately here — they are
 * ordinary income and should route through `federal-income-tax.ts`.
 */
const longTermBrackets: BracketsByFilingStatus = {
  single: [
    { fromCents: cents(0), rate: 0 },
    { fromCents: cents(49_450), rate: 0.15 },
    { fromCents: cents(545_500), rate: 0.2 },
  ],
  marriedFilingJointly: [
    { fromCents: cents(0), rate: 0 },
    { fromCents: cents(98_900), rate: 0.15 },
    { fromCents: cents(613_700), rate: 0.2 },
  ],
  marriedFilingSeparately: [
    { fromCents: cents(0), rate: 0 },
    { fromCents: cents(49_450), rate: 0.15 },
    { fromCents: cents(306_850), rate: 0.2 },
  ],
  headOfHousehold: [
    { fromCents: cents(0), rate: 0 },
    { fromCents: cents(66_200), rate: 0.15 },
    { fromCents: cents(564_000), rate: 0.2 },
  ],
};

export const capitalGains2026: CapitalGainsRules = {
  taxYear: 2026,
  longTermBrackets,
  niitRate: 0.038,
  // NIIT thresholds are fixed by statute (IRC §1411) and not inflation-indexed.
  niitThresholdCents: {
    single: cents(200_000),
    headOfHousehold: cents(200_000),
    marriedFilingJointly: cents(250_000),
    marriedFilingSeparately: cents(125_000),
  },
  source: "IRS Revenue Procedure 2025-32 (capital gains brackets); IRS Topic 559 (NIIT)",
  url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
  asOf: "2026-01-01",
};
