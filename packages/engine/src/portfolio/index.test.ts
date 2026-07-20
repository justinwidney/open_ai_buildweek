import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import type { AdjustmentContext } from "../adjustable/index.js";
import { createFixedReturnsStrategy } from "../returns/index.js";
import { applyContribution, initialHoldingState, portfolioViews, tickHoldingGrowth, withdrawFromHolding } from "./index.js";

function ctxAt(ytdWages: number): AdjustmentContext {
  return {
    month: 0,
    rng: createRandomSource("portfolio-test"),
    referenceData: referenceData2026,
    taxBasis: { ...initialTaxBasis(2026, "single"), ytdFederalTaxableWagesCents: ytdWages },
  };
}

describe("portfolio", () => {
  it("growth increases balance without touching cost basis", () => {
    const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(10_000));
    const strategy = createFixedReturnsStrategy({ equity: 0.12 });
    const grown = tickHoldingGrowth(holding, strategy, 0, createRandomSource("x"));
    assert.ok(grown.balanceCents > holding.balanceCents);
    assert.equal(grown.costBasisCents, holding.costBasisCents);
  });

  it("a contribution raises balance and cost basis by the same amount, creating no gain", () => {
    const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(1_000));
    const afterContribution = applyContribution(holding, cents(500));
    assert.equal(afterContribution.balanceCents, cents(1_500));
    assert.equal(afterContribution.costBasisCents, cents(1_500));
  });

  it("withdrawal realizes gain proportionally and taxes only the gain portion", () => {
    // $10,000 balance, $6,000 cost basis => 40% of the balance is unrealized gain.
    const holding = { config: { id: "brokerage", label: "Brokerage", assetClassId: "equity" }, balanceCents: cents(10_000), costBasisCents: cents(6_000) };
    const ctx = ctxAt(cents(500_000)); // well past standard deduction so gains tax is non-zero
    const result = withdrawFromHolding(holding, cents(1_000), ctx);

    assert.equal(result.grossWithdrawalCents, cents(1_000));
    assert.equal(result.realizedGainCents, cents(400)); // 40% of $1,000
    assert.ok(result.capitalGainsTaxCents > 0);
    assert.equal(result.netProceedsCents, result.grossWithdrawalCents - result.capitalGainsTaxCents);
    assert.equal(result.nextState.balanceCents, cents(9_000));
    assert.equal(result.nextState.costBasisCents, cents(6_000) - cents(600)); // 60% of $1,000 returned as basis
  });

  it("a withdrawal request larger than the balance is capped, never overdrawing", () => {
    const holding = { config: { id: "brokerage", label: "Brokerage", assetClassId: "equity" }, balanceCents: cents(500), costBasisCents: cents(500) };
    const result = withdrawFromHolding(holding, cents(10_000), ctxAt(0));
    assert.equal(result.grossWithdrawalCents, cents(500));
    assert.equal(result.nextState.balanceCents, 0);
  });

  it("a withdrawal of an all-cost-basis holding realizes zero gain and owes zero tax", () => {
    const holding = { config: { id: "brokerage", label: "Brokerage", assetClassId: "equity" }, balanceCents: cents(1_000), costBasisCents: cents(1_000) };
    const result = withdrawFromHolding(holding, cents(200), ctxAt(cents(500_000)));
    assert.equal(result.realizedGainCents, 0);
    assert.equal(result.capitalGainsTaxCents, 0);
    assert.equal(result.netProceedsCents, cents(200));
  });

  it("portfolioViews aggregates balance, cost basis, and gain across multiple holdings", () => {
    const state = {
      holdings: [
        { config: { id: "a", label: "A", assetClassId: "equity" }, balanceCents: cents(1_000), costBasisCents: cents(800) },
        { config: { id: "b", label: "B", assetClassId: "bond" }, balanceCents: cents(500), costBasisCents: cents(600) }, // underwater, gain clamps to 0
      ],
    };
    const views = portfolioViews(state);
    assert.equal(views.totalBalanceCents, cents(1_500));
    assert.equal(views.totalCostBasisCents, cents(1_400));
    assert.equal(views.unrealizedGainCents, cents(200)); // only "a"'s gain counts; "b" clamps at 0
  });
});
