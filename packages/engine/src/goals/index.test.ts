import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { createMonteCarloReturnsStrategy } from "../returns/index.js";
import type { IncomeState } from "../income/index.js";
import type { ExpenseState } from "../expenses/index.js";
import { initialDebtState } from "../debts/index.js";
import { initialFinancialAssetState } from "../assets/index.js";
import { initialHoldingState } from "../portfolio/index.js";
import type { PhysicalAssetState } from "../physical-assets/index.js";
import { computeNetWorthCents } from "../simulation/net-worth.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { runMonteCarloForecast } from "../forecast/monte-carlo-forecast.js";
import { metricValueCents } from "./metrics.js";
import { evaluateGoal, nominalTargetCents, resolveTargetMonth } from "./evaluate.js";
import { goalOutcomeDistribution } from "./outcome.js";
import type { Goal } from "./types.js";

function snapshot(month = 0): LifeStateSnapshot {
  const income: IncomeState = { config: { id: "job", label: "Job", baseMonthlyGrossCents: cents(9_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.08, startMonth: 0 } };
  const expense: ExpenseState = { config: { id: "living", label: "Living", category: "fixed", baseMonthlyAmountCents: cents(4_000), annualInflationRate: 0.03, startMonth: 0 } };
  const mortgage = initialDebtState({ id: "mortgage", label: "Mortgage", originalPrincipalCents: cents(300_000), annualRate: 0.06, termMonths: 360, startMonth: 0, monthlyEscrowCents: cents(400) });
  const studentLoan = initialDebtState({ id: "student", label: "Student loan", originalPrincipalCents: cents(20_000), annualRate: 0.05, termMonths: 120, startMonth: 0, monthlyEscrowCents: cents(0) });
  const cash = initialFinancialAssetState({ id: "cash", label: "Cash", annualInterestRate: 0.01 }, cents(40_000));
  const brokerage = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity", accountType: "taxableBrokerage" }, cents(200_000));
  const college = initialHoldingState({ id: "529", label: "529", assetClassId: "equity", accountType: "education529" }, cents(30_000));
  const house: PhysicalAssetState = { config: { id: "house", label: "Home", purchasePriceCents: cents(400_000), purchaseMonth: 0, annualValueChangeRate: 0.03, monthlyUpkeepCents: cents(300), linkedDebtId: "mortgage" } };
  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [brokerage, college] }, physicalAssets: [house], debts: [mortgage, studentLoan], month });
  return { runId: "g", month, parentSnapshotRef: null, decisions: [], incomes: [income], expenses: [expense], debts: [mortgage, studentLoan], financialAssets: [cash], portfolio: { holdings: [brokerage, college] }, physicalAssets: [house], taxBasis, netWorthCents, extensions: {} };
}

describe("goals/metrics", () => {
  const s = snapshot(0);
  it("liquid net worth excludes home equity and the mortgage, but subtracts unsecured debt", () => {
    // liquid assets = 40k cash + 200k brokerage + 30k 529 = 270k; unsecured debt = 20k student loan (mortgage is secured).
    assert.equal(metricValueCents("liquidNetWorth", s), cents(270_000) - cents(20_000));
  });
  it("home equity is house value minus its linked mortgage", () => {
    assert.equal(metricValueCents("homeEquity", s), cents(400_000) - cents(300_000));
  });
  it("college fund is only 529 balances", () => {
    assert.equal(metricValueCents("collegeFund", s), cents(30_000));
  });
  it("retirement income is investable (ex-529) balance × 4%", () => {
    // investable = 40k cash + 200k brokerage = 240k (529 excluded); × 0.04 = 9.6k.
    assert.equal(metricValueCents("retirementIncome", s), cents(9_600));
  });
  it("debtFree metric is total remaining debt", () => {
    assert.equal(metricValueCents("debtFree", s), cents(320_000));
  });
});

describe("goals/evaluate", () => {
  it("resolves a byAge due date and inflates a real target", () => {
    const goal: Goal = { id: "fi", label: "FI", metric: "netWorth", targetCents: cents(1_000_000), byAge: 60, real: true };
    assert.equal(resolveTargetMonth(goal, { ageYearsAtStart: 30 }), 360); // 30 years out
    // real $1M inflated 30y at 3% ≈ $2.427M
    const nominal = nominalTargetCents(goal, { ageYearsAtStart: 30, annualInflationRate: 0.03 });
    assert.ok(nominal > cents(2_400_000) && nominal < cents(2_450_000));
  });

  it("reports achieved / shortfall for a higher-is-better goal", () => {
    const s = snapshot(0);
    const nw = s.netWorthCents;
    const behind = evaluateGoal({ id: "g1", label: "NW", metric: "netWorth", targetCents: nw + cents(100_000), byMonth: 120 }, s);
    assert.equal(behind.achieved, false);
    assert.equal(behind.shortfallCents, cents(100_000));
    assert.ok(behind.progress < 1);

    const ahead = evaluateGoal({ id: "g2", label: "NW", metric: "netWorth", targetCents: nw - cents(50_000), byMonth: 120 }, s);
    assert.equal(ahead.achieved, true);
    assert.equal(ahead.surplusCents, cents(50_000));
    assert.equal(ahead.shortfallCents, 0);
  });

  it("debtFree is achieved when debt is at/under target (lower is better)", () => {
    const s = snapshot(0);
    const notYet = evaluateGoal({ id: "df", label: "Debt free", metric: "debtFree", targetCents: 0, byMonth: 240 }, s);
    assert.equal(notYet.achieved, false);
    assert.equal(notYet.shortfallCents, s.debts.reduce((t, d) => t + d.remainingBalanceCents, 0));
  });
});

describe("goals/goalOutcomeDistribution", () => {
  it("generalizes success probability to an arbitrary goal over a forecast", () => {
    const mc = createMonteCarloReturnsStrategy({ equity: { annualMeanReturn: 0.07, annualVolatility: 0.15 } });
    const forecast = runMonteCarloForecast({ initial: snapshot(0), monthsToSimulate: 60, paths: 150, returnsStrategy: mc, referenceData: referenceData2026, seed: "goal-seed" });
    assert.equal(forecast.terminalSnapshots.length, 150);

    const easy = goalOutcomeDistribution({ id: "e", label: "Any equity", metric: "collegeFund", targetCents: cents(1_000), byMonth: 60 }, forecast.terminalSnapshots);
    const hard = goalOutcomeDistribution({ id: "h", label: "Huge NW", metric: "netWorth", targetCents: cents(50_000_000), byMonth: 60 }, forecast.terminalSnapshots);
    assert.ok(easy.onTrackProbability > 0.9);
    assert.equal(hard.onTrackProbability, 0);
    assert.ok(easy.metricPercentileCents[10]! <= easy.metricPercentileCents[90]!);
  });
});
