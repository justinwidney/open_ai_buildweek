import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { resolveAdjustable, type AdjustmentContext } from "../adjustable/index.js";
import { buildIncomeAdjustable, incomeViews, type IncomeState } from "./index.js";

function ctxAt(month: number, ytdWages = 0): AdjustmentContext {
  return {
    month,
    rng: createRandomSource("income-test"),
    referenceData: referenceData2026,
    taxBasis: {
      ...initialTaxBasis(2026, "single"),
      ytdFederalTaxableWagesCents: ytdWages,
      ytdFicaWagesCents: ytdWages,
      ytdGrossWagesCents: ytdWages,
    },
  };
}

const job: IncomeState = {
  config: {
    id: "job-1",
    label: "Software Engineer",
    baseMonthlyGrossCents: cents(8_000),
    annualGrowthRate: 0.03,
    stateCode: "TX",
    pretaxDeferralRate: 0.06,
    startMonth: 0,
  },
};

describe("income", () => {
  it("all named views reconcile against the same underlying line items", () => {
    const ctx = ctxAt(0, cents(50_000));
    const result = resolveAdjustable(ctx, buildIncomeAdjustable(job, 0));
    const views = incomeViews(result);

    assert.equal(views.grossMonthlyCents, result.grossCents);
    assert.equal(views.takeHomeCents, result.netCents);
    assert.ok(views.takeHomeCents < views.afterTaxCents, "take-home should be below after-tax once the 401k deferral is excluded");
    assert.ok(views.afterTaxCents <= views.afterPayrollDeductionsCents, "after-tax should never exceed after-payroll-deductions-only");
    assert.equal(views.taxFreeCents, views.grossMonthlyCents - views.afterPayrollDeductionsCents);
  });

  it("grows the base salary annually by the configured growth rate", () => {
    const grossAtStart = buildIncomeAdjustable(job, 0).grossCents(ctxAt(0));
    const grossAfterOneYear = buildIncomeAdjustable(job, 12).grossCents(ctxAt(12));
    assert.ok(grossAfterOneYear > grossAtStart);
    const expectedRatio = 1.03;
    assert.ok(Math.abs(grossAfterOneYear / grossAtStart - expectedRatio) < 0.001);
  });

  it("a no-income-tax state (TX) still withholds federal and FICA", () => {
    const ctx = ctxAt(0, cents(50_000));
    const result = resolveAdjustable(ctx, buildIncomeAdjustable(job, 0));
    const views = incomeViews(result);
    assert.ok(views.takeHomeCents < views.grossMonthlyCents);
    assert.equal(result.lineItems.find((li) => li.key === "stateTax")!.amountCents, 0);
  });
});
