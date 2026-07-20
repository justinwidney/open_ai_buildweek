import { cents } from "../money/index.js";
import type { RetirementLimits } from "./types.js";

export const retirementLimits2026: RetirementLimits = {
  taxYear: 2026,
  employeeDeferralLimitCents: cents(24_500),
  catchUp50PlusCents: cents(8_000),
  superCatchUp60to63Cents: cents(11_250),
  combinedEmployerEmployeeLimitCents: cents(72_000),
  iraLimitCents: cents(7_500),
  iraCatchUp50PlusCents: cents(1_100),
  source: "IRS Notice 2025-67; IRS Newsroom 401(k)/IRA 2026 limit announcement",
  url: "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500",
  asOf: "2026-01-01",
};
