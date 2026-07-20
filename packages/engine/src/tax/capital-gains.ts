import type { AdjustmentContext } from "../adjustable/index.js";
import { applyBrackets } from "../reference-data/federal-income-tax.js";
import { clampNonNegative } from "../money/index.js";
import type { Cents } from "../money/index.js";

/**
 * Long-term capital gains are taxed at their own bracket schedule, but
 * that schedule applies to *total* taxable income — gains are treated as
 * "stacked on top of" ordinary income for the purpose of which LTCG
 * bracket they fall into. This computes the tax owed on a chunk of gain
 * realized this month using the same cumulative-year differencing
 * technique as `federal.ts`, so gains realized earlier vs. later in the
 * year (relative to ordinary income already earned) are taxed correctly
 * rather than each gain being evaluated in isolation.
 */
export function longTermCapitalGainsTaxCents(ctx: AdjustmentContext, gainCentsThisMonth: Cents): Cents {
  const rules = ctx.referenceData.capitalGains;
  const federalRules = ctx.referenceData.federalIncomeTax;
  const filingStatus = ctx.taxBasis.filingStatus;
  const brackets = rules.longTermBrackets[filingStatus];

  const ordinaryTaxableFloor = clampNonNegative(
    ctx.taxBasis.ytdFederalTaxableWagesCents - federalRules.standardDeductionCents[filingStatus],
  );
  const gainsBefore = ctx.taxBasis.ytdRealizedLongTermGainsCents;
  const gainsAfter = gainsBefore + gainCentsThisMonth;

  const taxOnFloorAlone = applyBrackets(ordinaryTaxableFloor, brackets);
  const taxBefore = applyBrackets(ordinaryTaxableFloor + gainsBefore, brackets) - taxOnFloorAlone;
  const taxAfter = applyBrackets(ordinaryTaxableFloor + gainsAfter, brackets) - taxOnFloorAlone;
  return taxAfter - taxBefore;
}

/**
 * Net Investment Income Tax: 3.8% on the lesser of net investment income
 * or the excess of MAGI over a filing-status threshold. Approximates MAGI
 * as cumulative gross wages plus realized gains and other investment
 * income (no above-the-line-deduction modeling yet) — documented
 * simplification, not the literal IRS worksheet.
 */
export function netInvestmentIncomeTaxCents(
  ctx: AdjustmentContext,
  netInvestmentIncomeThisMonth: Cents,
): Cents {
  const rules = ctx.referenceData.capitalGains;
  const filingStatus = ctx.taxBasis.filingStatus;
  const threshold = rules.niitThresholdCents[filingStatus];

  const magiBefore =
    ctx.taxBasis.ytdGrossWagesCents +
    ctx.taxBasis.ytdRealizedLongTermGainsCents +
    ctx.taxBasis.ytdRealizedShortTermGainsCents +
    ctx.taxBasis.ytdNetInvestmentIncomeCents;
  const magiAfter = magiBefore + netInvestmentIncomeThisMonth;

  const niiBefore = ctx.taxBasis.ytdNetInvestmentIncomeCents + ctx.taxBasis.ytdRealizedLongTermGainsCents + ctx.taxBasis.ytdRealizedShortTermGainsCents;
  const niiAfter = niiBefore + netInvestmentIncomeThisMonth;

  const taxableBefore = Math.min(niiBefore, clampNonNegative(magiBefore - threshold));
  const taxableAfter = Math.min(niiAfter, clampNonNegative(magiAfter - threshold));
  return Math.round((taxableAfter - taxableBefore) * rules.niitRate);
}
