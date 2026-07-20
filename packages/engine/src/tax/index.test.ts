import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { resolveAdjustable, type Adjustable, type AdjustmentContext } from "../adjustable/index.js";
import {
  federalIncomeTaxAdjustment,
  ficaSocialSecurityAdjustment,
  ficaMedicareAdjustment,
  stateTaxAdjustment,
  retirement401kPretaxAdjustment,
  longTermCapitalGainsTaxCents,
  netInvestmentIncomeTaxCents,
  taxableSocialSecurityBenefitCents,
} from "./index.js";

function ctxAt(monthlyGrossYtdCents: number, overrides: Partial<AdjustmentContext> = {}): AdjustmentContext {
  return {
    month: 0,
    rng: createRandomSource("tax-test"),
    referenceData: referenceData2026,
    taxBasis: { ...initialTaxBasis(2026, "single"), ytdFederalTaxableWagesCents: monthlyGrossYtdCents, ytdFicaWagesCents: monthlyGrossYtdCents, ytdGrossWagesCents: monthlyGrossYtdCents },
    ...overrides,
  };
}

function paycheck(gross: number, adjustments: Adjustable["adjustments"]): Adjustable {
  return { id: "job", label: "Job", grossCents: () => gross, adjustments };
}

describe("tax", () => {
  it("federal tax is progressive: a raise is taxed at a higher marginal rate than the base salary", () => {
    const lowIncomeCtx = ctxAt(0);
    const lowResult = resolveAdjustable(lowIncomeCtx, paycheck(cents(3_000), [federalIncomeTaxAdjustment()]));
    const lowTaxRate = -lowResult.lineItems[0]!.amountCents / cents(3_000);

    // Simulate a high earner already well into the year at a high cumulative income.
    const highIncomeCtx = ctxAt(cents(500_000));
    const highResult = resolveAdjustable(highIncomeCtx, paycheck(cents(3_000), [federalIncomeTaxAdjustment()]));
    const highTaxRate = -highResult.lineItems[0]!.amountCents / cents(3_000);

    assert.ok(highTaxRate > lowTaxRate, `expected marginal rate on top of $500k YTD (${highTaxRate}) > marginal rate near $0 YTD (${lowTaxRate})`);
  });

  it("federal withholding across 12 identical months reconciles to a sensible annual total for a mid income", () => {
    const filingStatus = "single" as const;
    let taxBasis = initialTaxBasis(2026, filingStatus);
    const monthlyGross = cents(6_000); // $72,000/yr
    let totalWithheld = 0;
    for (let m = 0; m < 12; m++) {
      const ctx: AdjustmentContext = { month: m, rng: createRandomSource("t"), referenceData: referenceData2026, taxBasis };
      const result = resolveAdjustable(ctx, paycheck(monthlyGross, [federalIncomeTaxAdjustment()]));
      const withheld = -result.lineItems[0]!.amountCents;
      totalWithheld += withheld;
      taxBasis = { ...taxBasis, ytdFederalTaxableWagesCents: taxBasis.ytdFederalTaxableWagesCents + monthlyGross };
    }
    // $72,000/yr single, 2026 brackets: roughly an 8-11% effective federal rate is a sane ballpark.
    const effectiveRate = totalWithheld / (monthlyGross * 12);
    assert.ok(effectiveRate > 0.05 && effectiveRate < 0.15, `effective rate ${effectiveRate} outside sane bounds`);
  });

  it("FICA social security tax stops once the wage base is exceeded", () => {
    const wageBase = referenceData2026.fica.socialSecurityWageBaseCents;
    const ctx = ctxAt(0, { taxBasis: { ...initialTaxBasis(2026, "single"), ytdFicaWagesCents: wageBase - cents(100) } });
    const result = resolveAdjustable(ctx, paycheck(cents(1_000), [ficaSocialSecurityAdjustment()]));
    // Only $100 of this $1,000 paycheck is still within the wage base.
    assert.equal(result.lineItems[0]!.amountCents, -Math.round(cents(100) * referenceData2026.fica.socialSecurityRate));
  });

  it("additional Medicare tax only applies to wages above the filing-status threshold", () => {
    const threshold = referenceData2026.fica.additionalMedicareThresholdCents.single;
    const ctx = ctxAt(0, { taxBasis: { ...initialTaxBasis(2026, "single"), ytdFicaWagesCents: threshold - cents(500) } });
    const result = resolveAdjustable(ctx, paycheck(cents(1_000), [ficaMedicareAdjustment()]));
    const base = Math.round(cents(1_000) * referenceData2026.fica.medicareRate);
    const additional = Math.round(cents(500) * referenceData2026.fica.additionalMedicareRate);
    assert.equal(result.lineItems[0]!.amountCents, -(base + additional));
  });

  it("no-income-tax state produces zero state tax", () => {
    const ctx = ctxAt(0);
    const result = resolveAdjustable(ctx, paycheck(cents(5_000), [stateTaxAdjustment("TX")]));
    assert.equal(result.lineItems[0]!.amountCents, 0);
  });

  it("flat-tax state applies its flat rate directly", () => {
    const ctx = ctxAt(0);
    const result = resolveAdjustable(ctx, paycheck(cents(5_000), [stateTaxAdjustment("CO")]));
    assert.equal(result.lineItems[0]!.amountCents, -Math.round(cents(5_000) * 0.044));
  });

  it("progressive-tax state charges a higher effective rate for a high earner than a low earner", () => {
    const low = resolveAdjustable(ctxAt(0), paycheck(cents(2_000), [stateTaxAdjustment("CA")]));
    const high = resolveAdjustable(ctxAt(cents(600_000)), paycheck(cents(2_000), [stateTaxAdjustment("CA")]));
    assert.ok(-high.lineItems[0]!.amountCents > -low.lineItems[0]!.amountCents);
  });

  it("401(k) pretax deferral stops once the annual IRS limit is reached", () => {
    const limit = referenceData2026.retirementLimits.employeeDeferralLimitCents;
    const ctx = ctxAt(0, { taxBasis: { ...initialTaxBasis(2026, "single"), ytdRetirementContributionsCents: limit - cents(50) } });
    const result = resolveAdjustable(ctx, paycheck(cents(2_000), [retirement401kPretaxAdjustment({ deferralRate: 0.5 })]));
    assert.equal(result.lineItems[0]!.amountCents, -cents(50));
  });

  it("pretax 401k deferral, ordered first, reduces the federal-taxable base the tax adjustment sees", () => {
    // Use a YTD base well past the standard deduction so this month's marginal tax is non-zero either way
    // (a single month's income in isolation would otherwise be fully absorbed by the annual deduction).
    const ctx = ctxAt(cents(100_000));
    const withDeferral = resolveAdjustable(
      ctx,
      paycheck(cents(5_000), [retirement401kPretaxAdjustment({ deferralRate: 0.1 }), federalIncomeTaxAdjustment()]),
    );
    const withoutDeferral = resolveAdjustable(ctxAt(cents(100_000)), paycheck(cents(5_000), [federalIncomeTaxAdjustment()]));
    const taxWithDeferral = -withDeferral.lineItems[1]!.amountCents;
    const taxWithoutDeferral = -withoutDeferral.lineItems[0]!.amountCents;
    assert.ok(taxWithDeferral < taxWithoutDeferral, "deferring pretax should reduce the federal tax owed");
  });

  it("long-term capital gains stack on top of ordinary income for bracket purposes", () => {
    const lowOrdinaryCtx = ctxAt(0);
    const highOrdinaryCtx = ctxAt(cents(600_000));
    const gain = cents(50_000);
    const taxOnGainLowBase = longTermCapitalGainsTaxCents(lowOrdinaryCtx, gain);
    const taxOnGainHighBase = longTermCapitalGainsTaxCents(highOrdinaryCtx, gain);
    assert.ok(taxOnGainHighBase >= taxOnGainLowBase, "the same gain stacked on top of higher ordinary income should never be taxed less");
  });

  it("NIIT is zero below the MAGI threshold and positive above it", () => {
    const belowThreshold = ctxAt(cents(50_000));
    const aboveThreshold = ctxAt(cents(250_000));
    const nii = cents(10_000);
    assert.equal(netInvestmentIncomeTaxCents(belowThreshold, nii), 0);
    assert.ok(netInvestmentIncomeTaxCents(aboveThreshold, nii) > 0);
  });

  it("social security benefit taxability follows the tiered provisional-income test", () => {
    // Thresholds are annual ($25,000 / $34,000 single), so exercise this with annual-scale figures.
    const ssBenefit = cents(24_000);
    assert.equal(taxableSocialSecurityBenefitCents("single", 0, ssBenefit), 0);
    const midTier = taxableSocialSecurityBenefitCents("single", cents(20_000), ssBenefit); // provisional = 20,000 + 12,000 = 32,000: between $25k/$34k
    assert.ok(midTier > 0 && midTier <= ssBenefit * 0.5 + 1);
    const highTier = taxableSocialSecurityBenefitCents("single", cents(40_000), ssBenefit); // provisional = 40,000 + 12,000 = 52,000: above $34k
    assert.ok(highTier > midTier);
    assert.ok(highTier <= ssBenefit * 0.85 + 1);
  });
});
