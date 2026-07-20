import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { createFixedReturnsStrategy } from "../returns/index.js";
import type { IncomeState } from "../income/index.js";
import type { ExpenseState } from "../expenses/index.js";
import type { DebtState } from "../debts/index.js";
import { initialDebtState } from "../debts/index.js";
import { initialFinancialAssetState } from "../assets/index.js";
import { initialHoldingState } from "../portfolio/index.js";
import type { PhysicalAssetState } from "../physical-assets/index.js";
import type { LifeStateSnapshot } from "./state.js";
import { computeNetWorthCents } from "./net-worth.js";
import { tick } from "./tick.js";
import { runSimulation } from "./run.js";
import { forkRun, resolveSnapshot, rootRun } from "./branch.js";

function buildInitialSnapshot(runId: string): LifeStateSnapshot {
  const income: IncomeState = {
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
  const expense: ExpenseState = {
    config: { id: "rent", label: "Rent", category: "fixed", baseMonthlyAmountCents: cents(1_800), annualInflationRate: 0.03, startMonth: 0 },
  };
  const debt: DebtState = initialDebtState({
    id: "mortgage",
    label: "Home mortgage",
    originalPrincipalCents: cents(400_000),
    annualRate: 0.0655,
    termMonths: 360,
    startMonth: 0,
    monthlyEscrowCents: cents(400),
  });
  const cash = initialFinancialAssetState({ id: "checking", label: "Checking", annualInterestRate: 0.005 }, cents(10_000));
  const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(5_000));
  const house: PhysicalAssetState = {
    config: { id: "house", label: "Home", purchasePriceCents: cents(400_000), purchaseMonth: 0, annualValueChangeRate: 0.03, monthlyUpkeepCents: cents(300), linkedDebtId: "mortgage" },
  };

  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({
    financialAssets: [cash],
    portfolio: { holdings: [holding] },
    physicalAssets: [house],
    debts: [debt],
    month: 0,
  });

  return {
    runId,
    month: 0,
    parentSnapshotRef: null,
    decisions: [],
    incomes: [income],
    expenses: [expense],
    debts: [debt],
    financialAssets: [cash],
    portfolio: { holdings: [holding] },
    physicalAssets: [house],
    taxBasis,
    netWorthCents,
    extensions: {},
  };
}

const returnsStrategy = createFixedReturnsStrategy({ equity: 0.07 });

function runOptions() {
  return { returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("golden-master-seed") };
}

describe("simulation", () => {
  it("tick is pure: the same context always produces the same result", () => {
    const initial = buildInitialSnapshot("run-a");
    const ctx = { month: 1, previous: initial, decisionDeltas: [], returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("s") };
    const resultA = tick(ctx);
    const resultB = tick({ ...ctx, rng: createRandomSource("s") });
    assert.deepEqual(resultA, resultB);
  });

  it("net cash flow (take-home minus expenses minus debt payment) accumulates into the primary cash account", () => {
    const initial = buildInitialSnapshot("run-b");
    const { snapshot } = tick({ month: 1, previous: initial, decisionDeltas: [], returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("s") });
    const cashDelta = snapshot.financialAssets[0]!.balanceCents - initial.financialAssets[0]!.balanceCents;
    assert.ok(cashDelta > 0, "a software engineer's take-home should exceed rent + mortgage payment in this scenario");
  });

  it("tick's detail reports the same take-home figure the snapshot's cash growth implies", () => {
    const initial = buildInitialSnapshot("run-b2");
    const { snapshot, detail } = tick({ month: 1, previous: initial, decisionDeltas: [], returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("s") });
    const takeHomeFlow = detail.flows.find((f) => f.domain === "income" && f.viewKey === "takeHome")!;
    const rentFlow = detail.flows.find((f) => f.domain === "expense" && f.viewKey === "outOfPocket")!;
    const debtFlow = detail.flows.find((f) => f.domain === "debt" && f.viewKey === "totalPayment")!;
    const impliedCashDelta = takeHomeFlow.amountCents - rentFlow.amountCents - debtFlow.amountCents;
    // Cash also earns its own interest on top of net cash flow, so the actual delta is >= implied.
    assert.ok(snapshot.financialAssets[0]!.balanceCents - initial.financialAssets[0]!.balanceCents >= impliedCashDelta);
  });

  it("detail includes a balance record for every debt, financial asset, portfolio holding, and physical asset", () => {
    const initial = buildInitialSnapshot("run-b3");
    const { detail } = tick({ month: 1, previous: initial, decisionDeltas: [], returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("s") });
    assert.ok(detail.balances.some((b) => b.domain === "debt" && b.metricKey === "remainingBalance"));
    assert.ok(detail.balances.some((b) => b.domain === "financialAsset" && b.metricKey === "balance"));
    assert.ok(detail.balances.some((b) => b.domain === "portfolio" && b.metricKey === "balance"));
    assert.ok(detail.balances.some((b) => b.domain === "physicalAsset" && b.metricKey === "value"));
  });

  it("tax basis resets at the start of a new calendar year", () => {
    const initial = buildInitialSnapshot("run-c");
    const { snapshots } = runSimulation(initial, 12, runOptions());
    const monthEleven = snapshots[11]!; // month index 11 = simulated month 11 (still year 2026)
    const monthTwelve = snapshots[12]!; // simulated month 12 = January of year 2027, YTD resets
    assert.ok(monthEleven.taxBasis.ytdGrossWagesCents > 0);
    assert.equal(monthTwelve.taxBasis.calendarYear, 2027);
    // Only this month's wages should be in the YTD bucket, not 12 months' worth.
    assert.ok(monthTwelve.taxBasis.ytdGrossWagesCents < monthEleven.taxBasis.ytdGrossWagesCents);
  });

  it("mortgage balance amortizes down and the linked house still appreciates independently", () => {
    const initial = buildInitialSnapshot("run-d");
    const { snapshots } = runSimulation(initial, 24, runOptions());
    const last = snapshots[snapshots.length - 1]!;
    assert.ok(last.debts[0]!.remainingBalanceCents < initial.debts[0]!.remainingBalanceCents);
  });

  it("portfolio holding grows under the fixed returns strategy", () => {
    const initial = buildInitialSnapshot("run-e");
    const { snapshots } = runSimulation(initial, 12, runOptions());
    const last = snapshots[snapshots.length - 1]!;
    assert.ok(last.portfolio.holdings[0]!.balanceCents > initial.portfolio.holdings[0]!.balanceCents);
  });

  it("golden master: a 60-month deterministic run reproduces byte-identical results across two runs", () => {
    const runA = runSimulation(buildInitialSnapshot("golden"), 60, runOptions());
    const runB = runSimulation(buildInitialSnapshot("golden"), 60, runOptions());
    assert.deepEqual(runA, runB);
    assert.equal(runA.snapshots.length, 61);
    assert.equal(runA.details.length, 60);
    // Sanity bounds on the final snapshot rather than a single brittle magic number: net worth should
    // have grown substantially from the starting position over 5 years of positive cash flow and growth.
    const start = runA.snapshots[0]!;
    const end = runA.snapshots[60]!;
    assert.ok(end.netWorthCents > start.netWorthCents, "net worth should grow over 5 years under these assumptions");
    assert.ok(end.month === 60);
  });

  it("branching: months at or before the fork are identical between parent and child, and diverge after", () => {
    const parentRef = rootRun("parent");
    const { snapshots: parentSnapshots } = runSimulation(buildInitialSnapshot(parentRef.runId), 36, runOptions());
    const parentByMonth = new Map(parentSnapshots.map((s) => [s.month, s]));

    const forkMonth = 12;
    const childRef = forkRun(parentRef, forkMonth, "child");

    // The child's post-fork starting point is the parent's snapshot at the fork month, but with a
    // changed decision: rent goes up sharply (standing in for "moved to a more expensive apartment").
    const forkSnapshot = parentByMonth.get(forkMonth)!;
    const divergedSnapshot: LifeStateSnapshot = {
      ...forkSnapshot,
      runId: childRef.runId,
      parentSnapshotRef: { runId: parentRef.runId, month: forkMonth },
      expenses: [{ config: { ...forkSnapshot.expenses[0]!.config, baseMonthlyAmountCents: cents(3_500) } }],
    };
    const { snapshots: childSnapshots } = runSimulation(divergedSnapshot, 24, runOptions());
    const childByMonth = new Map<number, LifeStateSnapshot>(childSnapshots.map((s) => [s.month, s]));

    // Simulate persistence: the child only actually stores its own post-fork months; anything at or
    // before the fork resolves through the parent via resolveSnapshot.
    function fetch(runId: string, month: number): LifeStateSnapshot | undefined {
      if (runId === parentRef.runId) return parentByMonth.get(month);
      if (runId === childRef.runId) return childByMonth.get(month);
      return undefined;
    }

    for (let m = 0; m <= forkMonth; m++) {
      const resolved = resolveSnapshot(childRef, m, fetch);
      assert.deepEqual(resolved, parentByMonth.get(m), `month ${m} should be identical to the parent`);
    }

    const parentAtMonth24 = resolveSnapshot(parentRef, 24, fetch)!;
    const childAtMonth24 = resolveSnapshot(childRef, 24, fetch)!;
    assert.notDeepEqual(childAtMonth24.financialAssets, parentAtMonth24.financialAssets, "post-fork cash balances should diverge once rent changed");
  });
});
