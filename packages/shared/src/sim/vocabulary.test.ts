import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents, createRandomSource, referenceData2026, runSimulation } from "@control-ai/engine";
import { buildInitialSnapshot, type RootSeed } from "./seed.js";
import { buildReturnsStrategy } from "./returns.js";
import { BALANCE_DOMAINS, BALANCE_METRIC_KEYS_BY_DOMAIN, FLOW_DOMAINS, FLOW_VIEW_KEYS_BY_DOMAIN, isValidBalance, isValidFlow } from "./vocabulary.js";

/**
 * The vocabulary in this package is only worth anything if it matches what
 * the engine actually emits. Rather than restating the literals, this runs a
 * real simulation over a seed exercising every domain and asserts the two
 * agree in *both* directions — an engine view key missing from the
 * vocabulary, and a vocabulary entry the engine never produces, are both
 * failures. The second direction is what catches a stale enum after a
 * domain is removed.
 */

const SEED: RootSeed = {
  version: 1,
  startCalendarYear: 2026,
  filingStatus: "single",
  ageYearsAtStart: 30,
  incomes: [{ id: "job", label: "Job", baseMonthlyGrossCents: cents(8000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 }],
  expenses: [{ id: "living", label: "Living", category: "fixed", baseMonthlyAmountCents: cents(3000), annualInflationRate: 0.03, startMonth: 0 }],
  debts: [{ id: "mortgage", label: "Mortgage", originalPrincipalCents: cents(300000), annualRate: 0.06, termMonths: 360, startMonth: 0, monthlyEscrowCents: cents(400) }],
  financialAssets: [{ config: { id: "cash", label: "Cash", annualInterestRate: 0.01 }, openingBalanceCents: cents(20000) }],
  holdings: [{ config: { id: "brokerage", label: "Brokerage", assetClassId: "equity", accountType: "taxableBrokerage" }, openingBalanceCents: cents(50000) }],
  physicalAssets: [{ id: "home", label: "Home", purchasePriceCents: cents(375000), purchaseMonth: 0, annualValueChangeRate: 0.03, monthlyUpkeepCents: cents(250), linkedDebtId: "mortgage" }],
  rngSeed: "vocabulary-test",
};

function simulate() {
  return runSimulation(buildInitialSnapshot("run-under-test", SEED), 24, {
    returnsStrategy: buildReturnsStrategy({ kind: "fixed", annualRatesByAssetClass: { equity: 0.07 } }),
    referenceData: referenceData2026,
    rng: createRandomSource(SEED.rngSeed),
  });
}

describe("flow/balance vocabulary matches the engine", () => {
  const { details } = simulate();
  const flows = details.flatMap((d) => d.flows);
  const balances = details.flatMap((d) => d.balances);

  it("simulates every domain, so the comparison below is meaningful", () => {
    assert.ok(flows.length > 0, "no flows produced");
    assert.ok(balances.length > 0, "no balances produced");
  });

  it("every emitted flow is in the vocabulary", () => {
    for (const flow of flows) {
      assert.ok(isValidFlow(flow.domain, flow.viewKey), `engine emitted flow ${flow.domain}/${flow.viewKey}, absent from FLOW_VIEW_KEYS_BY_DOMAIN`);
    }
  });

  it("every emitted balance is in the vocabulary", () => {
    for (const balance of balances) {
      assert.ok(isValidBalance(balance.domain, balance.metricKey), `engine emitted balance ${balance.domain}/${balance.metricKey}, absent from BALANCE_METRIC_KEYS_BY_DOMAIN`);
    }
  });

  it("every vocabulary flow entry is actually emitted", () => {
    const emitted = new Set(flows.map((f) => `${f.domain}/${f.viewKey}`));
    for (const domain of FLOW_DOMAINS) {
      for (const viewKey of FLOW_VIEW_KEYS_BY_DOMAIN[domain]) {
        assert.ok(emitted.has(`${domain}/${viewKey}`), `vocabulary declares flow ${domain}/${viewKey}, which the engine never emits`);
      }
    }
  });

  it("every vocabulary balance entry is actually emitted", () => {
    const emitted = new Set(balances.map((b) => `${b.domain}/${b.metricKey}`));
    for (const domain of BALANCE_DOMAINS) {
      for (const metricKey of BALANCE_METRIC_KEYS_BY_DOMAIN[domain]) {
        assert.ok(emitted.has(`${domain}/${metricKey}`), `vocabulary declares balance ${domain}/${metricKey}, which the engine never emits`);
      }
    }
  });

  it("rejects a cross-domain key mix-up", () => {
    assert.equal(isValidFlow("income", "escrowPortion"), false);
    assert.equal(isValidFlow("debt", "gross"), false);
    assert.equal(isValidBalance("financialAsset", "costBasis"), false);
    assert.equal(isValidFlow("nonsense", "gross"), false);
  });
});

describe("buildInitialSnapshot", () => {
  it("reconstructs a month-0 snapshot with every entity from the seed", () => {
    const snapshot = buildInitialSnapshot("r1", SEED);
    assert.equal(snapshot.month, 0);
    assert.equal(snapshot.runId, "r1");
    assert.equal(snapshot.incomes.length, 1);
    assert.equal(snapshot.expenses.length, 1);
    assert.equal(snapshot.debts.length, 1);
    assert.equal(snapshot.financialAssets.length, 1);
    assert.equal(snapshot.portfolio.holdings.length, 1);
    assert.equal(snapshot.physicalAssets.length, 1);
    assert.equal(snapshot.taxBasis.calendarYear, 2026);
    assert.equal(snapshot.debts[0]?.remainingBalanceCents, cents(300000), "a debt starts at its full original principal");
  });

  it("is deterministic — the same seed always yields the same snapshot", () => {
    assert.deepEqual(buildInitialSnapshot("r1", SEED), buildInitialSnapshot("r1", SEED));
  });

  it("nets assets against debts", () => {
    const snapshot = buildInitialSnapshot("r1", SEED);
    // cash 20k + brokerage 50k + home 375k - mortgage 300k
    assert.equal(snapshot.netWorthCents, cents(145000));
  });
});
