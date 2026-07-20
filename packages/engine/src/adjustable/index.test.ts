import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { findLineItem, resolveAdjustable, sumLineItems, type Adjustable, type AdjustmentContext } from "./index.js";

function makeContext(overrides: Partial<AdjustmentContext> = {}): AdjustmentContext {
  return {
    month: 0,
    rng: createRandomSource("test"),
    referenceData: referenceData2026,
    taxBasis: initialTaxBasis(2026, "single"),
    ...overrides,
  };
}

describe("adjustable", () => {
  it("always reconciles: netCents === grossCents + sum(lineItems)", () => {
    const adjustable: Adjustable = {
      id: "paycheck",
      label: "Paycheck",
      grossCents: () => cents(5_000),
      adjustments: [
        { key: "flatTax", label: "Flat tax", compute: (_ctx, gross) => -Math.round(gross * 0.2) },
        { key: "benefits", label: "Benefits premium", compute: () => -cents(200) },
      ],
    };
    const result = resolveAdjustable(makeContext(), adjustable);
    const sumLineItemsTotal = result.lineItems.reduce((s, li) => s + li.amountCents, 0);
    assert.equal(result.netCents, result.grossCents + sumLineItemsTotal);
    assert.equal(result.grossCents, cents(5_000));
  });

  it("later adjustments can see and react to earlier line items (order matters)", () => {
    const adjustable: Adjustable = {
      id: "paycheck",
      label: "Paycheck",
      grossCents: () => cents(4_000),
      adjustments: [
        { key: "pretax401k", label: "401(k) pretax deferral", compute: () => -cents(400) },
        {
          key: "tax",
          label: "Tax on remaining taxable wages",
          compute: (_ctx, gross, prior) => {
            const pretax = findLineItem(prior, "pretax401k");
            const taxable = gross + pretax; // pretax is negative
            return -Math.round(taxable * 0.1);
          },
        },
      ],
    };
    const result = resolveAdjustable(makeContext(), adjustable);
    assert.equal(result.lineItems[1]!.amountCents, -Math.round((cents(4_000) - cents(400)) * 0.1));
  });

  it("sumLineItems totals a named subset regardless of pipeline order", () => {
    const adjustable: Adjustable = {
      id: "x",
      label: "x",
      grossCents: () => cents(100),
      adjustments: [
        { key: "a", label: "a", compute: () => -cents(10) },
        { key: "b", label: "b", compute: () => -cents(5) },
        { key: "c", label: "c", compute: () => cents(2) },
      ],
    };
    const result = resolveAdjustable(makeContext(), adjustable);
    assert.equal(sumLineItems(result.lineItems, ["a", "b"]), -cents(15));
  });

  it("throws if an adjustment produces a non-integer or unsafe amount", () => {
    const adjustable: Adjustable = {
      id: "bad",
      label: "bad",
      grossCents: () => cents(10),
      adjustments: [{ key: "broken", label: "broken", compute: () => 1.5 }],
    };
    assert.throws(() => resolveAdjustable(makeContext(), adjustable), RangeError);
  });
});
