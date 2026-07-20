import type { Adjustment, AdjustmentContext } from "../adjustable/index.js";
import { clampNonNegative } from "../money/index.js";

export interface Retirement401kOptions {
  /** Fraction of gross deferred pretax each month, e.g. 0.06 for 6%. */
  deferralRate: number;
}

/**
 * Traditional (pretax) 401(k)/403(b)-style deferral. Stops contributing
 * once the year's cumulative deferral hits the IRS employee limit, rather
 * than silently over-contributing. Simplifications flagged for a later
 * pass: no employer-match line item (would be a positive, non-taxable
 * line item), and no age-based catch-up (the reference-data limits
 * support it, but `TaxBasisState` doesn't track age yet).
 */
export function retirement401kPretaxAdjustment(options: Retirement401kOptions): Adjustment {
  return {
    key: "retirement401kPretax",
    label: "401(k) pretax deferral",
    compute(ctx: AdjustmentContext, grossCents: number): number {
      const limit = ctx.referenceData.retirementLimits.employeeDeferralLimitCents;
      const desired = Math.round(grossCents * options.deferralRate);
      const remainingRoom = clampNonNegative(limit - ctx.taxBasis.ytdRetirementContributionsCents);
      const actual = Math.min(desired, remainingRoom);
      return -clampNonNegative(actual);
    },
  };
}
