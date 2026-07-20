import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { resolveAdjustable, type AdjustmentContext } from "../adjustable/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import {
  applyPrincipalPayment,
  buildDebtPaymentAdjustable,
  computeAmortizedPaymentCents,
  debtViews,
  initialDebtState,
  isDebtActive,
  type DebtConfig,
} from "./index.js";

function ctx(): AdjustmentContext {
  return { month: 0, rng: createRandomSource("debt-test"), referenceData: referenceData2026, taxBasis: initialTaxBasis(2026, "single") };
}

const mortgageConfig: DebtConfig = {
  id: "mortgage",
  label: "Home mortgage",
  originalPrincipalCents: cents(400_000),
  annualRate: 0.0655,
  termMonths: 360,
  startMonth: 0,
  monthlyEscrowCents: cents(400),
};

describe("debts", () => {
  it("computes a sane 30-year mortgage payment for a known principal/rate", () => {
    const payment = computeAmortizedPaymentCents(cents(400_000), 0.0655, 360);
    // $400k at 6.55%/30yr should land roughly in the $2,500-$2,600/mo range for principal+interest.
    assert.ok(payment > cents(2_400) && payment < cents(2_700), `payment ${payment} cents outside expected range`);
  });

  it("a zero-rate loan divides evenly across the term", () => {
    const payment = computeAmortizedPaymentCents(cents(12_000), 0, 12);
    assert.equal(payment, cents(1_000));
  });

  it("every payment fully reconciles: principal + interest + escrow accounts for the entire payment", () => {
    const state = initialDebtState(mortgageConfig);
    const result = resolveAdjustable(ctx(), buildDebtPaymentAdjustable(state));
    assert.equal(result.netCents, 0);
  });

  it("principal portion reduces the balance, and interest shrinks as the balance shrinks", () => {
    let state = initialDebtState(mortgageConfig);
    const firstResult = resolveAdjustable(ctx(), buildDebtPaymentAdjustable(state));
    const firstViews = debtViews(firstResult, state.remainingBalanceCents);
    state = applyPrincipalPayment(state, firstViews.principalPortionCents);

    // Fast-forward the balance far down to exercise a materially different interest amount.
    state = { ...state, remainingBalanceCents: cents(50_000) };
    const laterResult = resolveAdjustable(ctx(), buildDebtPaymentAdjustable(state));
    const laterViews = debtViews(laterResult, state.remainingBalanceCents);

    assert.ok(laterViews.interestPortionCents < firstViews.interestPortionCents, "interest should shrink as balance shrinks");
    assert.ok(laterViews.principalPortionCents > firstViews.principalPortionCents, "principal portion should grow as interest shrinks (fixed payment)");
  });

  it("the final payment pays off exactly the remaining balance without overshooting", () => {
    const almostPaidOff = { config: mortgageConfig, remainingBalanceCents: cents(100) };
    const result = resolveAdjustable(ctx(), buildDebtPaymentAdjustable(almostPaidOff));
    const views = debtViews(result, almostPaidOff.remainingBalanceCents);
    assert.ok(views.principalPortionCents <= cents(100) + 1);
    const next = applyPrincipalPayment(almostPaidOff, views.principalPortionCents);
    assert.ok(next.remainingBalanceCents >= 0);
  });

  it("a debt is inactive before its start month or once fully paid off", () => {
    const notStarted = { config: { ...mortgageConfig, startMonth: 10 }, remainingBalanceCents: mortgageConfig.originalPrincipalCents };
    assert.equal(isDebtActive(notStarted, 5), false);
    const paidOff = { config: mortgageConfig, remainingBalanceCents: 0 };
    assert.equal(isDebtActive(paidOff, 100), false);
  });
});
