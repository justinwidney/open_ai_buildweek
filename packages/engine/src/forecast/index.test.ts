import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { referenceData2026 } from "../reference-data/index.js";
import { createMonteCarloReturnsStrategy } from "../returns/index.js";
import type { IncomeState } from "../income/index.js";
import type { ExpenseState } from "../expenses/index.js";
import { initialFinancialAssetState } from "../assets/index.js";
import { initialHoldingState } from "../portfolio/index.js";
import { computeNetWorthCents } from "../simulation/net-worth.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { runMonteCarloForecast } from "./monte-carlo-forecast.js";
import { meanOf, percentileOfSorted } from "./percentile.js";

/** A portfolio-heavy starting point so return volatility clearly drives the spread of outcomes. */
function buildInitialSnapshot(): LifeStateSnapshot {
  const income: IncomeState = {
    config: { id: "job-1", label: "Engineer", baseMonthlyGrossCents: cents(9_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.1, startMonth: 0 },
  };
  const expense: ExpenseState = {
    config: { id: "living", label: "Living costs", category: "fixed", baseMonthlyAmountCents: cents(4_000), annualInflationRate: 0.03, startMonth: 0 },
  };
  const cash = initialFinancialAssetState({ id: "checking", label: "Checking", annualInterestRate: 0.005 }, cents(20_000));
  const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(250_000));
  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [], debts: [], month: 0 });

  return {
    runId: "forecast-subject",
    month: 0,
    parentSnapshotRef: null,
    decisions: [],
    incomes: [income],
    expenses: [expense],
    debts: [],
    financialAssets: [cash],
    portfolio: { holdings: [holding] },
    physicalAssets: [],
    taxBasis,
    netWorthCents,
    extensions: {},
  };
}

const monteCarlo = createMonteCarloReturnsStrategy({ equity: { annualMeanReturn: 0.07, annualVolatility: 0.18 } });

function forecast(overrides?: Partial<Parameters<typeof runMonteCarloForecast>[0]>) {
  return runMonteCarloForecast({
    initial: buildInitialSnapshot(),
    monthsToSimulate: 60,
    paths: 200,
    returnsStrategy: monteCarlo,
    referenceData: referenceData2026,
    seed: "forecast-seed",
    ...overrides,
  });
}

describe("forecast/percentile", () => {
  it("interpolates percentiles the way NumPy/spreadsheets do", () => {
    const xs = [1, 2, 3, 4];
    assert.equal(percentileOfSorted(xs, 0), 1);
    assert.equal(percentileOfSorted(xs, 100), 4);
    assert.equal(percentileOfSorted(xs, 50), 2.5);
    assert.equal(percentileOfSorted(xs, 25), 1.75);
    assert.equal(percentileOfSorted([42], 50), 42);
  });

  it("meanOf averages a non-empty array", () => {
    assert.equal(meanOf([2, 4, 6]), 4);
  });
});

describe("forecast/runMonteCarloForecast", () => {
  it("is reproducible: same (seed, paths, months) yields identical bands and terminal distribution", () => {
    const a = forecast();
    const b = forecast();
    assert.deepEqual(a.bands, b.bands);
    assert.deepEqual(a.terminalNetWorthCents, b.terminalNetWorthCents);
    assert.equal(a.successProbability, b.successProbability);
  });

  it("produces one band per month including month 0, each with every requested percentile", () => {
    const result = forecast({ percentiles: [10, 50, 90] });
    assert.equal(result.bands.length, 61);
    assert.equal(result.bands[0]!.month, 0);
    assert.equal(result.bands[60]!.month, 60);
    for (const band of result.bands) {
      assert.deepEqual(Object.keys(band.percentileCents).map(Number).sort((x, y) => x - y), [10, 50, 90]);
    }
  });

  it("percentiles are monotonic within each month (P10 ≤ P50 ≤ P90)", () => {
    const result = forecast({ percentiles: [10, 50, 90] });
    for (const band of result.bands) {
      assert.ok(band.percentileCents[10]! <= band.percentileCents[50]!);
      assert.ok(band.percentileCents[50]! <= band.percentileCents[90]!);
    }
  });

  it("the P10–P90 spread widens as the horizon lengthens (volatility compounds)", () => {
    const result = forecast({ percentiles: [10, 90] });
    const spread = (m: number) => result.bands[m]!.percentileCents[90]! - result.bands[m]!.percentileCents[10]!;
    // Month 0 is the shared starting point, so its spread is exactly zero.
    assert.equal(spread(0), 0);
    assert.ok(spread(60) > spread(12), "the fan of outcomes should be wider at 5 years than at 1");
  });

  it("terminal distribution has one entry per path, ascending, and probabilities are fractions in [0,1]", () => {
    const result = forecast();
    assert.equal(result.terminalNetWorthCents.length, 200);
    for (let i = 1; i < result.terminalNetWorthCents.length; i++) {
      assert.ok(result.terminalNetWorthCents[i]! >= result.terminalNetWorthCents[i - 1]!);
    }
    assert.ok(result.successProbability >= 0 && result.successProbability <= 1);
    assert.ok(result.ruinProbability >= 0 && result.ruinProbability <= 1);
  });

  it("a high net-worth goal is harder to clear than a low one (success probability is monotonic in the goal)", () => {
    const median = forecast().terminalNetWorthCents[100]!; // ~P50 of the 200-path terminal distribution
    const easy = forecast({ goalCents: 0 }).successProbability;
    const hard = forecast({ goalCents: median * 3 }).successProbability;
    assert.ok(easy >= hard);
    assert.ok(easy > 0.9, "with positive drift and a strong starting portfolio, staying above zero should be very likely");
  });

  it("rejects a non-positive path count", () => {
    assert.throws(() => forecast({ paths: 0 }), /at least one path/);
  });
});
