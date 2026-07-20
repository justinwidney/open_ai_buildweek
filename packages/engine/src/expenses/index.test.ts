import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { resolveAdjustable, type AdjustmentContext } from "../adjustable/index.js";
import { buildExpenseAdjustable, expenseViews, isExpenseActive, type ExpenseState } from "./index.js";

function ctxAt(month: number): AdjustmentContext {
  return { month, rng: createRandomSource("expense-test"), referenceData: referenceData2026, taxBasis: initialTaxBasis(2026, "single") };
}

const rent: ExpenseState = {
  config: { id: "rent", label: "Rent", category: "fixed", baseMonthlyAmountCents: cents(1_800), annualInflationRate: 0.03, startMonth: 0 },
};

describe("expenses", () => {
  it("escalates by the annual inflation rate once a year, not every month", () => {
    const atStart = resolveAdjustable(ctxAt(0), buildExpenseAdjustable(rent, 0)).grossCents;
    const afterOneYear = resolveAdjustable(ctxAt(12), buildExpenseAdjustable(rent, 12)).grossCents;
    assert.ok(Math.abs(afterOneYear / atStart - 1.03) < 0.001);
  });

  it("outOfPocketCents equals totalMonthlyCents when there are no adjustments", () => {
    const result = resolveAdjustable(ctxAt(0), buildExpenseAdjustable(rent, 0));
    const views = expenseViews(result, rent.config.category);
    assert.equal(views.outOfPocketCents, views.totalMonthlyCents);
  });

  it("is inactive before startMonth and after endMonth", () => {
    const bounded: ExpenseState = { config: { ...rent.config, startMonth: 6, endMonth: 18 } };
    assert.equal(isExpenseActive(bounded, 5), false);
    assert.equal(isExpenseActive(bounded, 6), true);
    assert.equal(isExpenseActive(bounded, 17), true);
    assert.equal(isExpenseActive(bounded, 18), false);
  });
});
