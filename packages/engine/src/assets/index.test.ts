import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { initialFinancialAssetState, tickFinancialAsset } from "./index.js";

describe("assets", () => {
  it("grows a balance by one month of interest before applying cash flow", () => {
    const state = initialFinancialAssetState({ id: "savings", label: "Savings", annualInterestRate: 0.12 }, cents(10_000));
    const next = tickFinancialAsset(state, 0);
    // 12%/yr -> 1%/mo -> $100 on $10,000.
    assert.equal(next.balanceCents, cents(10_100));
  });

  it("applies deposits and withdrawals on top of growth", () => {
    const state = initialFinancialAssetState({ id: "savings", label: "Savings", annualInterestRate: 0 }, cents(1_000));
    const afterDeposit = tickFinancialAsset(state, cents(200));
    assert.equal(afterDeposit.balanceCents, cents(1_200));
    const afterWithdrawal = tickFinancialAsset(afterDeposit, -cents(1_500));
    assert.equal(afterWithdrawal.balanceCents, 0); // clamped, not negative
  });
});
