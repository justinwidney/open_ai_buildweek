import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { initialFinancialAssetState } from "../assets/index.js";
import { computeNetWorthCents } from "../simulation/net-worth.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { applyEvent } from "../events/apply.js";
import {
  initialLifeContext,
  lifeGraph2026,
  recommendedBudget,
  resolveBranch,
  rollYear,
  type DecisionNode,
  type FinancialSummary,
  type LifeContext,
} from "./index.js";

const graph = lifeGraph2026;
const node = (id: string): DecisionNode => graph.nodes.find((n) => n.id === id)!;

function fin(over: Partial<FinancialSummary> = {}): FinancialSummary {
  return {
    liquidCents: cents(60_000),
    cashCents: cents(20_000),
    monthlyGrossCents: cents(6_000),
    monthlyTakeHomeCents: cents(4_500),
    monthlySpendingCents: cents(3_000),
    monthlyDebtPaymentCents: 0,
    netWorthCents: cents(60_000),
    emergencyFundMonths: 6,
    savingsRate: 0.1,
    ...over,
  };
}

function workingCtx(finances?: FinancialSummary, flags: Record<string, string | number | boolean> = {}): LifeContext {
  return { ...initialLifeContext({ ageYears: 30 }), stage: "working", month: 144, stageStartedMonth: 24, flags: { degreeEarned: true, ...flags }, finances };
}

function seedSnapshot(): LifeStateSnapshot {
  const income = { config: { id: "job", label: "Job", baseMonthlyGrossCents: cents(4_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.05, startMonth: 0 } };
  const living = { config: { id: "living", label: "Living costs", category: "fixed" as const, baseMonthlyAmountCents: cents(2_000), annualInflationRate: 0.03, startMonth: 0 } };
  const cash = initialFinancialAssetState({ id: "cash", label: "Cash", annualInterestRate: 0.01 }, cents(30_000));
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [] }, physicalAssets: [], debts: [], month: 0 });
  return { runId: "t", month: 0, parentSnapshotRef: null, decisions: [], incomes: [income], expenses: [living], debts: [], financialAssets: [cash], portfolio: { holdings: [] }, physicalAssets: [], taxBasis: initialTaxBasis(2026, "single"), netWorthCents, extensions: {} };
}

describe("rules/threshold gating", () => {
  it("buying a home requires liquidity and a runway — and reports why when short", () => {
    const home = node("first-home");
    assert.equal(home.available(workingCtx(fin())).eligible, true);
    assert.equal(home.available(workingCtx()).eligible, false, "no finances attached → not eligible");

    const brokeReasons = home.available(workingCtx(fin({ liquidCents: cents(10_000) }))).reasons;
    assert.ok(brokeReasons.some((r) => /down payment/i.test(r)));

    const noRunway = home.available(workingCtx(fin({ emergencyFundMonths: 1 }))).reasons;
    assert.ok(noRunway.some((r) => /emergency fund/i.test(r)));
  });

  it("buying a car unlocks on cash-on-hand and hides once you own one", () => {
    const car = node("buy-car");
    assert.equal(car.available(workingCtx(fin({ cashCents: cents(20_000) }))).eligible, true);
    assert.equal(car.available(workingCtx(fin({ cashCents: cents(2_000) }))).eligible, false);
    assert.equal(car.available(workingCtx(fin(), { hasCar: true })).eligible, false);
  });

  it("boost-retirement only offers when the savings rate is low", () => {
    const boost = node("boost-retirement");
    assert.equal(boost.available(workingCtx(fin({ savingsRate: 0.08 }))).eligible, true);
    assert.equal(boost.available(workingCtx(fin({ savingsRate: 0.3 }))).eligible, false);
  });
});

describe("rules/rollYear (RNG simulator)", () => {
  it("is deterministic for a given seed", () => {
    const ctx = workingCtx(fin());
    const a = rollYear(graph, ctx, () => createRandomSource("year-31").next());
    const b = rollYear(graph, ctx, () => createRandomSource("year-31").next());
    assert.equal(a?.id, b?.id);
  });

  it("an always-hit roll returns the most-disruptive eligible event first", () => {
    const fired = rollYear(graph, workingCtx(fin()), () => 0);
    assert.equal(fired?.id, "rng-layoff", "layoff is ordered first and is eligible for an earner");
  });

  it("a resolved/blocked once-per-life event is skipped on the next roll", () => {
    const ctx = { ...workingCtx(fin()), resolvedNodeIds: ["rng-layoff"] };
    const fired = rollYear(graph, ctx, () => 0);
    assert.equal(fired?.id, "rng-medical", "the next eligible event fires instead");
  });

  it("a repeatable event reopens itself so it can recur", () => {
    const medical = node("rng-medical");
    const handle = medical.branches[0]!;
    const after = resolveBranch({ ...workingCtx(fin()), resolvedNodeIds: [] }, medical, handle);
    assert.ok(!after.resolvedNodeIds.includes("rng-medical"), "repeatable events do not stay resolved");
  });

  it("car/home shocks are gated on owning the asset", () => {
    assert.equal(node("rng-car-repair").available(workingCtx(fin())).eligible, false);
    assert.equal(node("rng-car-repair").available(workingCtx(fin(), { hasCar: true })).eligible, true);
    assert.equal(node("rng-home-repair").available(workingCtx(fin(), { homeowner: true })).eligible, true);
  });
});

describe("rules/effects on the snapshot", () => {
  it("a promotion scales only the primary job, not a spouse's income", () => {
    const snap = { ...seedSnapshot(), incomes: [seedSnapshot().incomes[0]!, { config: { id: "spouse", label: "Partner", baseMonthlyGrossCents: cents(5_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.05, startMonth: 0 } }] };
    const promo = node("rng-promotion").branches[0]!;
    const after = applyEvent(snap, promo.effect!(workingCtx(fin())));
    assert.equal(after.incomes.find((i) => i.config.id === "job")!.config.baseMonthlyGrossCents, cents(4_600)); // 4000 * 1.15
    assert.equal(after.incomes.find((i) => i.config.id === "spouse")!.config.baseMonthlyGrossCents, cents(5_000)); // untouched
  });

  it("buying a used car in cash adds a depreciating asset and no loan", () => {
    const car = node("buy-car");
    const cash = car.branches.find((b) => b.id === "used-cash")!;
    const after = applyEvent(seedSnapshot(), cash.effect!(workingCtx(fin())));
    assert.equal(after.physicalAssets.length, 1);
    assert.equal(after.debts.length, 0);
    assert.equal(after.financialAssets[0]!.balanceCents, cents(30_000) - cents(12_000));
    assert.ok(after.physicalAssets[0]!.config.annualValueChangeRate < 0, "cars depreciate");
  });

  it("financing a car adds an auto loan for the balance", () => {
    const car = node("buy-car");
    const finance = car.branches.find((b) => b.id === "used-finance")!;
    const after = applyEvent(seedSnapshot(), finance.effect!(workingCtx(fin())));
    assert.equal(after.debts.length, 1);
    assert.equal(after.debts[0]!.remainingBalanceCents, cents(15_000)); // 18k - 3k down
  });
});

describe("rules/recommendedBudget", () => {
  it("picks a profile from the life stage and recent events", () => {
    assert.equal(recommendedBudget({ ...workingCtx(fin()), stage: "school" }).profile, "student");
    assert.equal(recommendedBudget(workingCtx(fin())).profile, "new-grad");
    assert.equal(recommendedBudget(workingCtx(fin(), { married: true })).profile, "married");
    assert.equal(recommendedBudget(workingCtx(fin(), { hasChild: true })).profile, "new-parent");
  });

  it("a new parent's budget gains a childcare line", () => {
    const budget = recommendedBudget(workingCtx(fin(), { hasChild: true }));
    assert.ok(budget.categories.some((c) => c.key === "childcare"));
  });

  it("category amounts are shares of take-home that sum to roughly the whole", () => {
    const budget = recommendedBudget(workingCtx(fin()));
    const total = budget.categories.reduce((sum, c) => sum + c.monthlyCents, 0);
    // Percentages sum to 100, so category cents sum to take-home within rounding.
    assert.ok(Math.abs(total - fin().monthlyTakeHomeCents) <= budget.categories.length);
    assert.equal(budget.savingsRatePct, 25);
  });
});
