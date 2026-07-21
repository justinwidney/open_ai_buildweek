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
import { applyEvent, applyEvents, forkWithEvent } from "./apply.js";
import { buyHome, changeContributionRate, changeJob, haveChild, marry, receiveWindfall, relocate } from "./catalog.js";

const FORK_MONTH = 12;

function forkSnapshot(): LifeStateSnapshot {
  const income: IncomeState = { config: { id: "job-1", label: "Engineer", baseMonthlyGrossCents: cents(9_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 } };
  const rent: ExpenseState = { config: { id: "rent", label: "Rent", category: "fixed", baseMonthlyAmountCents: cents(2_000), annualInflationRate: 0.03, startMonth: 0 } };
  const cash = initialFinancialAssetState({ id: "checking", label: "Checking", annualInterestRate: 0.005 }, cents(120_000));
  const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(50_000));
  const taxBasis = initialTaxBasis(2027, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [], debts: [], month: FORK_MONTH });
  return {
    runId: "parent", month: FORK_MONTH, parentSnapshotRef: null, decisions: [],
    incomes: [income], expenses: [rent], debts: [], financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [], taxBasis, netWorthCents, extensions: {},
  };
}

const rs = createFixedReturnsStrategy({ equity: 0.07 });
function runForward(s: LifeStateSnapshot, months: number) {
  return runSimulation(s, months, { returnsStrategy: rs, referenceData: referenceData2026, rng: createRandomSource("fwd") });
}

describe("events/applyEvent", () => {
  it("does not mutate the input snapshot and records the decision", () => {
    const before = forkSnapshot();
    const frozen = structuredClone(before);
    const after = applyEvent(before, receiveWindfall({ id: "inherit", amountCents: cents(50_000), effectiveFromMonth: FORK_MONTH }));
    assert.deepEqual(before, frozen, "input snapshot must be untouched");
    assert.equal(after.decisions.length, 1);
    assert.equal(after.decisions[0]!.domain, "windfall");
    assert.notEqual(after.financialAssets[0]!.balanceCents, before.financialAssets[0]!.balanceCents);
  });

  it("receiveWindfall raises cash and net worth by the amount", () => {
    const before = forkSnapshot();
    const after = applyEvent(before, receiveWindfall({ id: "bonus", amountCents: cents(50_000), effectiveFromMonth: FORK_MONTH }));
    assert.equal(after.netWorthCents, before.netWorthCents + cents(50_000));
    assert.equal(after.financialAssets[0]!.balanceCents, before.financialAssets[0]!.balanceCents + cents(50_000));
  });

  it("buyHome converts cash to equity: net worth drops by exactly the closing costs", () => {
    const before = forkSnapshot();
    const after = applyEvent(
      before,
      buyHome({ id: "house", priceCents: cents(400_000), downPaymentCents: cents(80_000), closingCostsCents: cents(12_000), mortgageAnnualRate: 0.065, termMonths: 360, monthlyEscrowCents: cents(500), monthlyMaintenanceCents: cents(300), annualAppreciationRate: 0.03, effectiveFromMonth: FORK_MONTH }),
    );
    assert.equal(after.financialAssets[0]!.balanceCents, before.financialAssets[0]!.balanceCents - cents(92_000)); // down + closing
    assert.equal(after.debts.length, 1);
    assert.equal(after.debts[0]!.remainingBalanceCents, cents(320_000)); // price − down
    assert.equal(after.physicalAssets.length, 1);
    // At the purchase month the house is worth exactly its price, so net worth only drops by closing costs.
    assert.equal(after.netWorthCents, before.netWorthCents - cents(12_000));
    // Run forward: the mortgage amortizes down and the house appreciates.
    const { snapshots } = runForward(after, 12);
    const last = snapshots[snapshots.length - 1]!;
    assert.ok(last.debts[0]!.remainingBalanceCents < cents(320_000));
  });

  it("changeContributionRate patches the deferral and changes take-home going forward", () => {
    const before = forkSnapshot();
    const higher = applyEvent(before, changeContributionRate({ incomeId: "job-1", newDeferralRate: 0.15, effectiveFromMonth: FORK_MONTH }));
    assert.equal(higher.incomes[0]!.config.pretaxDeferralRate, 0.15);
    const baseTakeHome = runForward(before, 1).details[0]!.flows.find((f) => f.domain === "income" && f.viewKey === "takeHome")!.amountCents;
    const higherTakeHome = runForward(higher, 1).details[0]!.flows.find((f) => f.domain === "income" && f.viewKey === "takeHome")!.amountCents;
    assert.ok(higherTakeHome < baseTakeHome, "deferring more lowers take-home");
  });

  it("changeJob replaces the income with a new salary and state", () => {
    const before = forkSnapshot();
    const after = applyEvent(before, changeJob({ oldIncomeId: "job-1", newJob: { id: "job-2", label: "Staff Eng", baseMonthlyGrossCents: cents(14_000), annualGrowthRate: 0.03, stateCode: "CA", pretaxDeferralRate: 0.1 }, effectiveFromMonth: FORK_MONTH }));
    assert.equal(after.incomes.length, 1);
    assert.equal(after.incomes[0]!.config.id, "job-2");
    assert.equal(after.incomes[0]!.config.stateCode, "CA");
    assert.equal(after.incomes[0]!.config.startMonth, FORK_MONTH);
  });

  it("marry sets filing status and can add a spouse income", () => {
    const before = forkSnapshot();
    const after = applyEvent(before, marry({ effectiveFromMonth: FORK_MONTH, spouseIncome: { id: "spouse-job", label: "Spouse", baseMonthlyGrossCents: cents(6_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.05 }, weddingCostCents: cents(30_000) }));
    assert.equal(after.taxBasis.filingStatus, "marriedFilingJointly");
    assert.equal(after.incomes.length, 2);
    assert.equal(after.financialAssets[0]!.balanceCents, before.financialAssets[0]!.balanceCents - cents(30_000));
  });

  it("haveChild adds a time-bounded childcare expense that raises spending", () => {
    const before = forkSnapshot();
    const after = applyEvent(before, haveChild({ childId: "kid1", effectiveFromMonth: FORK_MONTH, oneTimeBirthCostCents: cents(5_000), monthlyChildcareCents: cents(1_500), childcareEndMonth: FORK_MONTH + 60 }));
    const childcare = after.expenses.find((e) => e.config.id === "childcare-kid1")!;
    assert.ok(childcare);
    assert.equal(childcare.config.endMonth, FORK_MONTH + 60);
    const baseExpenses = runForward(before, 1).details[0]!.flows.filter((f) => f.domain === "expense" && f.viewKey === "outOfPocket").reduce((t, f) => t + f.amountCents, 0);
    const withKid = runForward(after, 1).details[0]!.flows.filter((f) => f.domain === "expense" && f.viewKey === "outOfPocket").reduce((t, f) => t + f.amountCents, 0);
    assert.ok(withKid > baseExpenses);
  });

  it("relocate changes the income's state and cost-of-living expenses", () => {
    const before = forkSnapshot();
    const after = applyEvent(before, relocate({ incomeId: "job-1", newStateCode: "CA", newBaseMonthlyGrossCents: cents(11_000), expenseAdjustments: [{ id: "rent", newMonthlyAmountCents: cents(3_500) }], effectiveFromMonth: FORK_MONTH }));
    assert.equal(after.incomes[0]!.config.stateCode, "CA");
    assert.equal(after.incomes[0]!.config.baseMonthlyGrossCents, cents(11_000));
    assert.equal(after.expenses.find((e) => e.config.id === "rent")!.config.baseMonthlyAmountCents, cents(3_500));
  });

  it("forkWithEvent produces a branch ref + diverged snapshot that runs forward differently from the parent", () => {
    const parentAtFork = forkSnapshot();
    const parentRef = rootRun("parent");
    const { ref, snapshot } = forkWithEvent({
      parent: parentRef,
      forkMonth: FORK_MONTH,
      newRunId: "child",
      parentSnapshotAtFork: parentAtFork,
      effect: changeContributionRate({ incomeId: "job-1", newDeferralRate: 0.2, effectiveFromMonth: FORK_MONTH }),
    });
    assert.equal(ref.runId, "child");
    assert.equal(ref.parentRunId, "parent");
    assert.equal(ref.forkMonth, FORK_MONTH);
    assert.equal(snapshot.runId, "child");
    assert.deepEqual(snapshot.parentSnapshotRef, { runId: "parent", month: FORK_MONTH });
    assert.equal(snapshot.month, FORK_MONTH, "the fork snapshot stays at the fork month");

    // Run both forward and confirm they diverge (child defers far more, so more ends up in retirement).
    const parentFwd = runForward(parentAtFork, 12).snapshots.at(-1)!;
    const childFwd = runForward(snapshot, 12).snapshots.at(-1)!;
    assert.notEqual(childFwd.financialAssets[0]!.balanceCents, parentFwd.financialAssets[0]!.balanceCents);
  });

  it("applyEvents chains several decisions in one month", () => {
    const before = forkSnapshot();
    const after = applyEvents(before, [
      marry({ effectiveFromMonth: FORK_MONTH }),
      buyHome({ id: "house", priceCents: cents(500_000), downPaymentCents: cents(100_000), mortgageAnnualRate: 0.065, termMonths: 360, monthlyEscrowCents: cents(600), monthlyMaintenanceCents: cents(400), annualAppreciationRate: 0.03, effectiveFromMonth: FORK_MONTH }),
    ]);
    assert.equal(after.taxBasis.filingStatus, "marriedFilingJointly");
    assert.equal(after.debts.length, 1);
    assert.equal(after.decisions.length, 2);
  });
});
