import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { createRandomSource } from "../rng/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { createFixedReturnsStrategy } from "../returns/index.js";
import type { IncomeState } from "../income/index.js";
import type { ExpenseState } from "../expenses/index.js";
import { initialDebtState } from "../debts/index.js";
import { initialFinancialAssetState } from "../assets/index.js";
import { initialHoldingState } from "../portfolio/index.js";
import type { PhysicalAssetState } from "../physical-assets/index.js";
import { computeNetWorthCents } from "../simulation/net-worth.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { tick } from "../simulation/tick.js";
import { buildMonthlyStatement } from "./monthly-statement.js";

function buildInitialSnapshot(): LifeStateSnapshot {
  const income: IncomeState = {
    config: { id: "job-1", label: "Engineer", baseMonthlyGrossCents: cents(9_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 },
  };
  const rent: ExpenseState = { config: { id: "rent", label: "Rent", category: "fixed", baseMonthlyAmountCents: cents(1_800), annualInflationRate: 0.03, startMonth: 0 } };
  const fun: ExpenseState = { config: { id: "fun", label: "Dining out", category: "discretionary", baseMonthlyAmountCents: cents(600), annualInflationRate: 0.03, startMonth: 0 } };
  const debt = initialDebtState({ id: "mortgage", label: "Mortgage", originalPrincipalCents: cents(400_000), annualRate: 0.0655, termMonths: 360, startMonth: 0, monthlyEscrowCents: cents(400) });
  const cash = initialFinancialAssetState({ id: "checking", label: "Checking", annualInterestRate: 0.005 }, cents(30_000));
  const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(80_000));
  const house: PhysicalAssetState = {
    config: { id: "house", label: "Home", purchasePriceCents: cents(400_000), purchaseMonth: 0, annualValueChangeRate: 0.03, monthlyUpkeepCents: cents(300), linkedDebtId: "mortgage" },
  };
  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [house], debts: [debt], month: 0 });

  return {
    runId: "statement-subject",
    month: 0,
    parentSnapshotRef: null,
    decisions: [],
    incomes: [income],
    expenses: [rent, fun],
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

/** Ticks a fresh initial snapshot forward `months` months, returning the final snapshot + that month's detail. */
function tickTo(months: number) {
  let current = buildInitialSnapshot();
  let detail = undefined as ReturnType<typeof tick>["detail"] | undefined;
  for (let m = 1; m <= months; m++) {
    const r = tick({ month: m, previous: current, decisionDeltas: [], returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("s") });
    current = r.snapshot;
    detail = r.detail;
  }
  return { snapshot: current, detail: detail! };
}

function tickOnce() {
  return tickTo(1);
}

describe("statement/buildMonthlyStatement", () => {
  it("reports the tax breakdown and the withholding identity reconciles", () => {
    // Tick to month 3: federal withholding is cumulative and only becomes positive once YTD
    // wages clear the standard deduction (roughly month 2–3), so month 1 alone shows $0 federal.
    const { snapshot, detail } = tickTo(3);
    const s = buildMonthlyStatement({ snapshot, detail });

    assert.ok(s.income.grossCents > 0);
    assert.ok(s.income.takeHomeCents < s.income.grossCents);
    assert.ok(s.taxes.federalCents > 0, "federal tax should be withheld once YTD wages clear the standard deduction");
    assert.equal(s.taxes.stateCents, 0, "TX has no state income tax");
    assert.ok(s.taxes.ficaCents > 0, "FICA should be withheld");
    assert.equal(s.taxes.totalCents, s.taxes.federalCents + s.taxes.stateCents + s.taxes.ficaCents);
    // gross − takeHome − pretax contribution === total tax
    assert.equal(s.income.grossCents - s.income.takeHomeCents - s.income.pretaxContributionCents, s.taxes.totalCents);
    assert.ok(Math.abs(s.taxes.effectiveRate - s.taxes.totalCents / s.income.grossCents) < 1e-9);
  });

  it("the balance sheet ties out to the snapshot's cached net worth", () => {
    const { snapshot, detail } = tickOnce();
    const s = buildMonthlyStatement({ snapshot, detail });
    assert.equal(s.balanceSheet.netWorthCents, snapshot.netWorthCents);
    assert.equal(s.balanceSheet.totalAssetsCents - s.balanceSheet.totalLiabilitiesCents, s.balanceSheet.netWorthCents);
    assert.equal(s.balanceSheet.totalAssetsCents, s.balanceSheet.cashCents + s.balanceSheet.investmentsCents + s.balanceSheet.physicalCents);
    assert.equal(s.balanceSheet.assets.length, 3); // checking + brokerage + house
    assert.equal(s.balanceSheet.liabilities.length, 1); // mortgage
  });

  it("splits spending into fixed, discretionary, and debt, summing to the total", () => {
    const { snapshot, detail } = tickOnce();
    const s = buildMonthlyStatement({ snapshot, detail });
    assert.ok(s.spending.fixedCents > 0, "rent is fixed");
    assert.ok(s.spending.discretionaryCents > 0, "dining out is discretionary");
    assert.ok(s.spending.debtPaymentCents > 0, "mortgage payment");
    assert.equal(s.spending.totalCents, s.spending.fixedCents + s.spending.discretionaryCents + s.spending.debtPaymentCents);
    assert.equal(s.spending.debtPaymentCents, s.debt.totalPaymentCents);
  });

  it("derives planning metrics and age from context", () => {
    const { snapshot, detail } = tickOnce();
    const s = buildMonthlyStatement({ snapshot, detail, context: { ageYearsAtStart: 30 } });
    assert.equal(s.ageYears, 30); // month 1 is still age 30
    assert.ok(s.planning.emergencyFundMonths > 0);
    assert.ok(s.planning.fiNumberCents > 0);
    assert.ok(s.planning.fiProgress > 0 && s.planning.fiProgress < 1, "not yet financially independent");
    assert.ok(s.cashFlow.savingsRate > 0 && s.cashFlow.savingsRate < 1);
  });

  it("derives age and dependents from a household context", () => {
    const { snapshot, detail } = tickOnce();
    const s = buildMonthlyStatement({
      snapshot,
      detail,
      context: {
        household: {
          filingStatus: "single",
          members: [{ id: "you", label: "You", birthMonth: -360, role: "primary" }],
          dependents: [{ id: "kid", label: "Kid", birthMonth: -24, kind: "child" }],
        },
      },
    });
    assert.equal(s.ageYears, 30, "household drives age at month 1");
    assert.ok(s.household);
    assert.equal(s.household!.dependentCount, 1);
    assert.equal(s.household!.qualifyingChildrenForCtc, 1);
  });

  it("advances age once a full year has elapsed", () => {
    const initial = buildInitialSnapshot();
    // Tick to month 13 by chaining (cheap): reuse runSimulation-style loop via repeated tick.
    let current = initial;
    let detail;
    for (let m = 1; m <= 13; m++) {
      const r = tick({ month: m, previous: current, decisionDeltas: [], returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("s") });
      current = r.snapshot;
      detail = r.detail;
    }
    const s = buildMonthlyStatement({ snapshot: current, detail, context: { ageYearsAtStart: 30 } });
    assert.equal(s.ageYears, 31, "month 13 is the second year → age 31");
  });

  it("groups the balance sheet by account tax treatment", () => {
    const initial = buildInitialSnapshot();
    // Give the household a Roth IRA and a 401(k) alongside the default taxable brokerage.
    const withAccounts: LifeStateSnapshot = {
      ...initial,
      portfolio: {
        holdings: [
          initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity", accountType: "taxableBrokerage" }, cents(80_000)),
          initialHoldingState({ id: "401k", label: "401(k)", assetClassId: "equity", accountType: "traditional401k" }, cents(150_000)),
          initialHoldingState({ id: "roth", label: "Roth IRA", assetClassId: "equity", accountType: "rothIra" }, cents(40_000)),
        ],
      },
    };
    const s = buildMonthlyStatement({ snapshot: withAccounts });
    // Cash ($30k) is taxable too, so taxable = 30k cash + 80k brokerage.
    assert.equal(s.balanceSheet.byTaxTreatment.taxable, cents(110_000));
    assert.equal(s.balanceSheet.byTaxTreatment.taxDeferred, cents(150_000));
    assert.equal(s.balanceSheet.byTaxTreatment.roth, cents(40_000));
    const grouped = s.balanceSheet.byTaxTreatment;
    const groupedTotal = grouped.taxable + grouped.taxDeferred + grouped.roth + grouped.hsa + grouped.education529;
    assert.equal(groupedTotal, s.balanceSheet.cashCents + s.balanceSheet.investmentsCents, "grouped financial balances cover all cash + investments");
  });

  it("builds for a month-0 snapshot with no detail: zeroed flows, full balance sheet", () => {
    const initial = buildInitialSnapshot();
    const s = buildMonthlyStatement({ snapshot: initial });
    assert.equal(s.income.grossCents, 0);
    assert.equal(s.spending.totalCents, 0);
    assert.equal(s.planning.emergencyFundMonths, 0, "no spending → runway metric is 0, not Infinity");
    assert.equal(s.balanceSheet.netWorthCents, initial.netWorthCents);
    assert.ok(s.balanceSheet.totalAssetsCents > 0);
  });
});
