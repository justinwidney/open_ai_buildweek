import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { createFixedReturnsStrategy } from "../returns/index.js";
import type { IncomeState } from "../income/index.js";
import type { ExpenseState } from "../expenses/index.js";
import { initialFinancialAssetState } from "../assets/index.js";
import { initialHoldingState } from "../portfolio/index.js";
import { computeNetWorthCents } from "../simulation/net-worth.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { runSimulation } from "../simulation/run.js";
import { rootRun } from "../simulation/branch.js";
import { forkWithEvent, receiveWindfall } from "../events/index.js";
import type { Goal } from "../goals/index.js";
import { metricValueCents } from "../goals/index.js";
import { compareTrajectories, goalGapTrajectory } from "./trajectory.js";
import { rankGoalImpacts } from "./attribution.js";
import { divergenceReport } from "./report.js";

const FORK_MONTH = 24;
const HORIZON = 60;

function initial(): LifeStateSnapshot {
  const income: IncomeState = { config: { id: "job", label: "Job", baseMonthlyGrossCents: cents(9_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 } };
  const expense: ExpenseState = { config: { id: "living", label: "Living", category: "fixed", baseMonthlyAmountCents: cents(4_000), annualInflationRate: 0.03, startMonth: 0 } };
  const cash = initialFinancialAssetState({ id: "cash", label: "Cash", annualInterestRate: 0.01 }, cents(30_000));
  const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(60_000));
  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [], debts: [], month: 0 });
  return { runId: "parent", month: 0, parentSnapshotRef: null, decisions: [], incomes: [income], expenses: [expense], debts: [], financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [], taxBasis, netWorthCents, extensions: {} };
}

const rs = createFixedReturnsStrategy({ equity: 0.07 });
const opts = () => ({ returnsStrategy: rs, referenceData: referenceData2026, rng: createRandomSource("analysis") });

// Materialize the paths once: a baseline run, and a branch that receives a $100k windfall at the fork.
const parentPath = runSimulation(initial(), HORIZON, opts()).snapshots;
const parentAtFork = parentPath[FORK_MONTH]!;
const windfall = forkWithEvent({ parent: rootRun("parent"), forkMonth: FORK_MONTH, newRunId: "windfall", parentSnapshotAtFork: parentAtFork, effect: receiveWindfall({ id: "inherit", amountCents: cents(100_000), effectiveFromMonth: FORK_MONTH }) });
const windfallPath = runSimulation(windfall.snapshot, HORIZON - FORK_MONTH, opts()).snapshots;

describe("analysis/compareTrajectories (method A)", () => {
  it("finds the fork month and a widening divergence that isn't reconverging", () => {
    const d = compareTrajectories(parentPath, windfallPath); // metric defaults to netWorth
    assert.equal(d.forkMonth, FORK_MONTH, "the windfall changes net worth right at the fork month");
    assert.ok(d.maxDivergence);
    assert.ok(d.maxDivergence!.absCents >= cents(100_000), "the gap is at least the windfall amount");
    assert.equal(d.converging, false, "cash grows, so the gap doesn't shrink");
    // Only the shared months (fork..horizon) are compared.
    assert.equal(d.series[0]!.month, FORK_MONTH);
    assert.equal(d.series.at(-1)!.month, HORIZON);
  });

  it("reports zero divergence when comparing a path to itself", () => {
    const d = compareTrajectories(parentPath, parentPath);
    assert.equal(d.forkMonth, null);
    assert.equal(d.maxDivergence!.absCents, 0);
  });
});

describe("analysis/goalGapTrajectory (method C)", () => {
  const goal: Goal = { id: "nw", label: "Net worth", metric: "netWorth", targetCents: cents(1_000_000), byMonth: HORIZON };

  it("finds the age of maximum shortfall, and the windfall path is less behind at the terminus", () => {
    const baseGap = goalGapTrajectory(goal, parentPath, { ageYearsAtStart: 30 });
    assert.ok(baseGap.maxShortfall, "the path is behind a $1M goal");
    assert.ok(baseGap.maxShortfall!.ageYears !== undefined);
    const baseTerminalShortfall = baseGap.series.at(-1)!.shortfallCents;
    const windfallGap = goalGapTrajectory(goal, windfallPath, { ageYearsAtStart: 30 });
    assert.ok(windfallGap.series.at(-1)!.shortfallCents < baseTerminalShortfall, "the windfall narrows the gap to the goal");
  });
});

describe("analysis/rankGoalImpacts (method B)", () => {
  it("ranks decisions by their impact on the goal and flags on-track flips", () => {
    // Two counterfactual re-runs off the same fork: a big inheritance vs a small bonus.
    const bigTerminal = windfallPath.at(-1)!;
    const smallFork = forkWithEvent({ parent: rootRun("parent"), forkMonth: FORK_MONTH, newRunId: "bonus", parentSnapshotAtFork: parentAtFork, effect: receiveWindfall({ id: "bonus", amountCents: cents(10_000), effectiveFromMonth: FORK_MONTH }) });
    const smallTerminal = runSimulation(smallFork.snapshot, HORIZON - FORK_MONTH, opts()).snapshots.at(-1)!;
    const baselineTerminal = parentPath.at(-1)!;

    // Target set just above the baseline terminal so the big windfall flips it on-track, the small one doesn't.
    const baselineNw = metricValueCents("netWorth", baselineTerminal);
    const goal: Goal = { id: "nw", label: "Net worth", metric: "netWorth", targetCents: baselineNw + cents(50_000), byMonth: HORIZON };

    const ranked = rankGoalImpacts(goal, baselineTerminal, [
      { decisionId: "bonus", label: "Small bonus", terminal: smallTerminal },
      { decisionId: "inherit", label: "Big inheritance", terminal: bigTerminal },
    ], {});

    assert.equal(ranked[0]!.decisionId, "inherit", "the biggest-impact decision ranks first");
    assert.ok(ranked[0]!.impactCents > ranked[1]!.impactCents);
    assert.equal(ranked[0]!.onTrack.baseline, false);
    assert.equal(ranked[0]!.onTrack.counterfactual, true, "the big inheritance flips the goal to on-track");
  });
});

describe("analysis/divergenceReport", () => {
  it("bundles temporal + goal-gap for a baseline vs variant", () => {
    const goal: Goal = { id: "nw", label: "Net worth", metric: "netWorth", targetCents: cents(500_000), byMonth: HORIZON };
    const report = divergenceReport(goal, parentPath, windfallPath, { ageYearsAtStart: 30 });
    assert.equal(report.temporal.forkMonth, FORK_MONTH);
    assert.equal(report.baselineGoal.goalId, "nw");
    assert.equal(report.variantGoal.series.length, windfallPath.length);
  });
});
