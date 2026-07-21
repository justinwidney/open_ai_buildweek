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
import { tick } from "../simulation/tick.js";
import { buildMonthlyStatement, type MonthlyStatement } from "../statement/index.js";
import { evaluateBudget } from "./evaluate.js";

function statementAtMonth3(): MonthlyStatement {
  const income: IncomeState = { config: { id: "job-1", label: "Engineer", baseMonthlyGrossCents: cents(9_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 } };
  const rent: ExpenseState = { config: { id: "rent", label: "Rent", category: "fixed", baseMonthlyAmountCents: cents(1_800), annualInflationRate: 0, startMonth: 0 } };
  const dining: ExpenseState = { config: { id: "dining", label: "Dining out", category: "discretionary", baseMonthlyAmountCents: cents(800), annualInflationRate: 0, startMonth: 0 } };
  const cash = initialFinancialAssetState({ id: "checking", label: "Checking", annualInterestRate: 0.005 }, cents(30_000));
  const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(50_000));
  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [], debts: [], month: 0 });

  let current: LifeStateSnapshot = {
    runId: "budget-subject", month: 0, parentSnapshotRef: null, decisions: [],
    incomes: [income], expenses: [rent, dining], debts: [], financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [], taxBasis, netWorthCents, extensions: {},
  };
  const rs = createFixedReturnsStrategy({ equity: 0.07 });
  let detail;
  for (let m = 1; m <= 3; m++) {
    const r = tick({ month: m, previous: current, decisionDeltas: [], returnsStrategy: rs, referenceData: referenceData2026, rng: createRandomSource("s") });
    current = r.snapshot;
    detail = r.detail;
  }
  return buildMonthlyStatement({ snapshot: current, detail: detail! });
}

describe("budget/evaluateBudget", () => {
  const statement = statementAtMonth3();

  it("an empty budget is trivially on track", () => {
    const report = evaluateBudget({}, statement);
    assert.equal(report.onTrack, true);
    assert.equal(report.lines.length, 0);
    assert.equal(report.totalSpending, undefined);
  });

  it("flags total spending over its cap and passes it under", () => {
    const actual = statement.spending.totalCents;
    const over = evaluateBudget({ totalMonthlySpendingCents: actual - cents(500) }, statement);
    assert.equal(over.totalSpending!.overBudget, true);
    assert.equal(over.totalSpending!.varianceCents, cents(500));
    assert.equal(over.onTrack, false);

    const under = evaluateBudget({ totalMonthlySpendingCents: actual + cents(500) }, statement);
    assert.equal(under.totalSpending!.overBudget, false);
    assert.equal(under.onTrack, true);
  });

  it("checks a savings-rate goal against the statement's actual rate", () => {
    const actual = statement.cashFlow.savingsRate;
    const tooHigh = evaluateBudget({ savingsRateTarget: actual + 0.1 }, statement);
    assert.equal(tooHigh.savingsRate!.met, false);
    assert.ok(tooHigh.savingsRate!.variance < 0);
    assert.equal(tooHigh.onTrack, false);

    const achievable = evaluateBudget({ savingsRateTarget: Math.max(0, actual - 0.05) }, statement);
    assert.equal(achievable.savingsRate!.met, true);
  });

  it("caps by category and by entity, ranking overages worst-first", () => {
    const report = evaluateBudget(
      {
        lines: [
          { key: "discretionary", match: "category", limitCents: cents(500), label: "Fun money" }, // dining is 800 → over by 300
          { key: "dining", match: "entity", limitCents: cents(1_000) }, // under
          { key: "fixed", match: "category", limitCents: cents(100) }, // rent 1800 → over by 1700
        ],
      },
      statement,
    );
    const dining = report.lines.find((l) => l.key === "discretionary")!;
    assert.equal(dining.actualCents, cents(800));
    assert.equal(dining.varianceCents, cents(300));
    assert.equal(dining.overBudget, true);
    assert.equal(report.lines.find((l) => l.key === "dining")!.overBudget, false);
    assert.equal(report.onTrack, false);
    // Worst overage (rent, +1700) ranks ahead of dining (+300).
    assert.deepEqual(report.overBudgetLines.map((l) => l.key), ["fixed", "discretionary"]);
  });
});
