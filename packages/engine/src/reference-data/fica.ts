import { cents } from "../money/index.js";
import type { FicaRules } from "./types.js";

/**
 * Additional Medicare Tax thresholds ($200k single/HoH/qualifying widow(er),
 * $250k MFJ, $125k MFS) are fixed by statute (IRC §3101(b)(2)) and are not
 * inflation-indexed, so they're stable across tax years.
 */
export const fica2026: FicaRules = {
  taxYear: 2026,
  socialSecurityRate: 0.062,
  socialSecurityWageBaseCents: cents(184_500),
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThresholdCents: {
    single: cents(200_000),
    headOfHousehold: cents(200_000),
    marriedFilingJointly: cents(250_000),
    marriedFilingSeparately: cents(125_000),
  },
  source: "IRS Topic 751 (Social Security and Medicare withholding rates); SSA 2026 wage base announcement",
  url: "https://www.irs.gov/taxtopics/tc751",
  asOf: "2026-01-01",
};
