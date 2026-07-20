import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRandomSource } from "../rng/index.js";
import { referenceData2026 } from "../reference-data/index.js";
import {
  annualToMonthlyRate,
  createFixedReturnsStrategy,
  createHistoricalBacktestStrategy,
  createMonteCarloReturnsStrategy,
} from "./index.js";

describe("returns", () => {
  it("fixed strategy compounds monthly to exactly the annual rate over 12 months", () => {
    const strategy = createFixedReturnsStrategy({ equity: 0.08 });
    const rng = createRandomSource("unused");
    let balance = 1;
    for (let m = 0; m < 12; m++) {
      const { nominalReturn } = strategy.nextReturn({ month: m, assetClassId: "equity", rng });
      balance *= 1 + nominalReturn;
    }
    assert.ok(Math.abs(balance - 1.08) < 1e-9);
  });

  it("fixed strategy never consumes the rng (ignores it entirely)", () => {
    const strategy = createFixedReturnsStrategy({ equity: 0.05 });
    const rngA = createRandomSource(1);
    const rngB = createRandomSource(2);
    const a = strategy.nextReturn({ month: 0, assetClassId: "equity", rng: rngA });
    const b = strategy.nextReturn({ month: 0, assetClassId: "equity", rng: rngB });
    assert.equal(a.nominalReturn, b.nominalReturn);
  });

  it("monte carlo is deterministic for a given seed and varies with a different one", () => {
    const distributions = { equity: { annualMeanReturn: 0.07, annualVolatility: 0.15 } };
    const strategyA = createMonteCarloReturnsStrategy(distributions);
    const strategyB = createMonteCarloReturnsStrategy(distributions);
    const resultA = strategyA.nextReturn({ month: 0, assetClassId: "equity", rng: createRandomSource("seed-x") });
    const resultB = strategyB.nextReturn({ month: 0, assetClassId: "equity", rng: createRandomSource("seed-x") });
    assert.equal(resultA.nominalReturn, resultB.nominalReturn);

    const resultC = strategyA.nextReturn({ month: 0, assetClassId: "equity", rng: createRandomSource("seed-y") });
    assert.notEqual(resultA.nominalReturn, resultC.nominalReturn);
  });

  it("monte carlo's sampled monthly returns average close to the target annual mean over many draws", () => {
    const strategy = createMonteCarloReturnsStrategy({ equity: { annualMeanReturn: 0.07, annualVolatility: 0.15 } });
    const rng = createRandomSource("monte-carlo-mean-check");
    let balance = 1;
    const months = 12 * 200; // long horizon to let the sample mean converge
    for (let m = 0; m < months; m++) {
      const { nominalReturn } = strategy.nextReturn({ month: m, assetClassId: "equity", rng });
      balance *= 1 + nominalReturn;
    }
    const impliedAnnualCAGR = Math.pow(balance, 1 / (months / 12)) - 1;
    // Lognormal CAGR is below the arithmetic mean by roughly sigma^2/2; a loose band is appropriate here.
    assert.ok(impliedAnnualCAGR > -0.02 && impliedAnnualCAGR < 0.09, `CAGR ${impliedAnnualCAGR} outside a sane band`);
  });

  it("historical backtest replays the real dated 2008 downturn and 2009 recovery", () => {
    const strategy = createHistoricalBacktestStrategy({
      datasetsByAssetClass: referenceData2026.historicalReturns,
      startYear: 2008,
    });
    const rng = createRandomSource("historical-test");
    let balance2008 = 1;
    for (let m = 0; m < 12; m++) {
      const { nominalReturn } = strategy.nextReturn({ month: m, assetClassId: "us-equity-large-cap", rng });
      balance2008 *= 1 + nominalReturn;
    }
    assert.ok(balance2008 < 0.7, `expected a steep 2008 drawdown, got a balance multiple of ${balance2008}`);

    let balance2009 = 1;
    for (let m = 12; m < 24; m++) {
      const { nominalReturn } = strategy.nextReturn({ month: m, assetClassId: "us-equity-large-cap", rng });
      balance2009 *= 1 + nominalReturn;
    }
    assert.ok(balance2009 > 1.15, `expected a strong 2009 recovery, got a balance multiple of ${balance2009}`);
  });

  it("historical backtest wraps around rather than erroring past the dataset's span", () => {
    const strategy = createHistoricalBacktestStrategy({
      datasetsByAssetClass: referenceData2026.historicalReturns,
      startYear: 2025,
    });
    const rng = createRandomSource("wrap-test");
    // 2025 is the last year in the dataset; the next year should wrap back to 1928 rather than throwing.
    assert.doesNotThrow(() => {
      for (let m = 0; m < 24; m++) strategy.nextReturn({ month: m, assetClassId: "us-equity-large-cap", rng });
    });
  });

  it("annualToMonthlyRate compounds back to the original annual rate over 12 months", () => {
    const monthly = annualToMonthlyRate(0.1);
    assert.ok(Math.abs(Math.pow(1 + monthly, 12) - 1.1) < 1e-9);
  });
});
