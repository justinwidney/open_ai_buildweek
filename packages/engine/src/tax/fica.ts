import type { Adjustment, AdjustmentContext, LineItem } from "../adjustable/index.js";
import { sumLineItems } from "../adjustable/index.js";
import { clampNonNegative } from "../money/index.js";
import { FICA_WAGE_EXCLUDED_KEYS } from "./pretax-keys.js";

/** Social Security (OASDI) portion of FICA — stops once cumulative FICA wages for the year hit the wage base. */
export function ficaSocialSecurityAdjustment(): Adjustment {
  return {
    key: "ficaSocialSecurity",
    label: "Social Security (FICA) tax",
    compute(ctx: AdjustmentContext, grossCents: number, priorLineItems: readonly LineItem[]): number {
      const rules = ctx.referenceData.fica;
      const excludedThisMonth = sumLineItems(priorLineItems, [...FICA_WAGE_EXCLUDED_KEYS]); // negative
      const ficaWagesThisMonth = clampNonNegative(grossCents + excludedThisMonth);

      const ytdBefore = ctx.taxBasis.ytdFicaWagesCents;
      const ytdAfter = ytdBefore + ficaWagesThisMonth;
      const wageBase = rules.socialSecurityWageBaseCents;

      const taxableBefore = Math.min(ytdBefore, wageBase);
      const taxableAfter = Math.min(ytdAfter, wageBase);
      const taxableThisMonth = clampNonNegative(taxableAfter - taxableBefore);

      return -Math.round(taxableThisMonth * rules.socialSecurityRate);
    },
  };
}

/** Medicare portion of FICA — uncapped base rate, plus an Additional Medicare Tax above a filing-status threshold. */
export function ficaMedicareAdjustment(): Adjustment {
  return {
    key: "ficaMedicare",
    label: "Medicare (FICA) tax",
    compute(ctx: AdjustmentContext, grossCents: number, priorLineItems: readonly LineItem[]): number {
      const rules = ctx.referenceData.fica;
      const excludedThisMonth = sumLineItems(priorLineItems, [...FICA_WAGE_EXCLUDED_KEYS]);
      const ficaWagesThisMonth = clampNonNegative(grossCents + excludedThisMonth);

      const base = Math.round(ficaWagesThisMonth * rules.medicareRate);

      // Additional Medicare Tax applies only to cumulative-year wages above the threshold; whichever
      // portion of this month's wages crosses that line (not necessarily all of it) is taxed at the extra rate.
      const threshold = rules.additionalMedicareThresholdCents[ctx.taxBasis.filingStatus];
      const ytdBefore = ctx.taxBasis.ytdFicaWagesCents;
      const ytdAfter = ytdBefore + ficaWagesThisMonth;
      const additionalWagesThisMonth = clampNonNegative(ytdAfter - Math.max(ytdBefore, threshold));

      const additional = Math.round(additionalWagesThisMonth * rules.additionalMedicareRate);
      return -(base + additional);
    },
  };
}
