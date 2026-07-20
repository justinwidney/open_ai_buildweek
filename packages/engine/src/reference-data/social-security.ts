import { cents } from "../money/index.js";
import type { SocialSecurityRules } from "./types.js";

/**
 * Primary Insurance Amount (PIA) bend points for workers newly eligible in
 * 2026 (bend points are locked in at the year someone turns 62, not the
 * year they claim benefits — an important nuance if this is ever applied
 * to a birth-year-specific claimant rather than a flat current-year lookup).
 * Formula: PIA = 90% of AIME up to bendPoint1, + 32% of AIME between the
 * two bend points, + 15% of AIME above bendPoint2.
 */
export const socialSecurity2026: SocialSecurityRules = {
  taxYear: 2026,
  bendPoint1Cents: cents(1_286),
  bendPoint2Cents: cents(7_749),
  belowBendPoint1Rate: 0.9,
  betweenBendPointsRate: 0.32,
  aboveBendPoint2Rate: 0.15,
  source: "SSA.tools Primary Insurance Amount (PIA) bend-point reference",
  url: "https://ssa.tools/guides/pia",
  asOf: "2026-01-01",
};

/** Computes the monthly Primary Insurance Amount from Average Indexed Monthly Earnings, in cents. */
export function computePia(aimeCents: number, rules: SocialSecurityRules): number {
  if (aimeCents <= 0) return 0;
  let pia = 0;
  if (aimeCents <= rules.bendPoint1Cents) {
    pia = aimeCents * rules.belowBendPoint1Rate;
  } else if (aimeCents <= rules.bendPoint2Cents) {
    pia = rules.bendPoint1Cents * rules.belowBendPoint1Rate + (aimeCents - rules.bendPoint1Cents) * rules.betweenBendPointsRate;
  } else {
    pia =
      rules.bendPoint1Cents * rules.belowBendPoint1Rate +
      (rules.bendPoint2Cents - rules.bendPoint1Cents) * rules.betweenBendPointsRate +
      (aimeCents - rules.bendPoint2Cents) * rules.aboveBendPoint2Rate;
  }
  return Math.round(pia);
}
