import type { Adjustment, AdjustmentContext, LineItem } from "../adjustable/index.js";
import { sumLineItems } from "../adjustable/index.js";
import { applyBrackets } from "../reference-data/federal-income-tax.js";
import { clampNonNegative } from "../money/index.js";
import { PRETAX_DEDUCTION_KEYS } from "./pretax-keys.js";

/**
 * Withholds federal income tax on a cumulative-year basis: this month's tax
 * is `tax(YTD taxable through this month) - tax(YTD taxable before this
 * month)`, both run through the same annual bracket schedule. This is what
 * makes withholding land on the correct total annual tax by December
 * regardless of how income varies month to month (a raise, a bonus, a
 * mid-year job change) — the alternative of annualizing/de-annualizing a
 * single month's income would drift under exactly those conditions.
 */
export function federalIncomeTaxAdjustment(): Adjustment {
  return {
    key: "federalIncomeTax",
    label: "Federal income tax withholding",
    compute(ctx: AdjustmentContext, grossCents: number, priorLineItems: readonly LineItem[]): number {
      const rules = ctx.referenceData.federalIncomeTax;
      const filingStatus = ctx.taxBasis.filingStatus;
      const brackets = rules.brackets[filingStatus];
      const standardDeduction = rules.standardDeductionCents[filingStatus];

      const pretaxThisMonth = sumLineItems(priorLineItems, [...PRETAX_DEDUCTION_KEYS]); // negative
      const taxableGrossThisMonth = clampNonNegative(grossCents + pretaxThisMonth);

      const ytdTaxableBefore = clampNonNegative(ctx.taxBasis.ytdFederalTaxableWagesCents - standardDeduction);
      const ytdTaxableAfter = clampNonNegative(ctx.taxBasis.ytdFederalTaxableWagesCents + taxableGrossThisMonth - standardDeduction);

      const taxBefore = applyBrackets(ytdTaxableBefore, brackets);
      const taxAfter = applyBrackets(ytdTaxableAfter, brackets);
      return -(taxAfter - taxBefore);
    },
  };
}
