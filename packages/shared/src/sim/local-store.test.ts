import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents, createRandomSource, referenceData2026, runSimulation } from "@control-ai/engine";
import { createLocalRunStore, type QuotaEvent } from "./local-store.js";
import { buildReturnsStrategy, type ReturnsStrategyConfig } from "./returns.js";
import { buildInitialSnapshot, type RootSeed } from "./seed.js";
import { monthsFromRunResult } from "./store.js";
import { createMemoryStorage, type KeyValueStorage } from "./storage.js";

const SEED: RootSeed = {
  version: 1,
  startCalendarYear: 2026,
  filingStatus: "single",
  ageYearsAtStart: 24,
  incomes: [{ id: "job", label: "Job", baseMonthlyGrossCents: cents(7500), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 }],
  expenses: [{ id: "living", label: "Living", category: "fixed", baseMonthlyAmountCents: cents(3800), annualInflationRate: 0.03, startMonth: 0 }],
  debts: [],
  financialAssets: [{ config: { id: "cash", label: "Cash", annualInterestRate: 0.01 }, openingBalanceCents: cents(16000) }],
  holdings: [{ config: { id: "brokerage", label: "Investments", assetClassId: "equity", accountType: "taxableBrokerage" }, openingBalanceCents: cents(9000) }],
  physicalAssets: [],
  rngSeed: "local-store-test",
};

const STRATEGY: ReturnsStrategyConfig = { kind: "fixed", annualRatesByAssetClass: { equity: 0.07 } };

function simulate(months: number) {
  return runSimulation(buildInitialSnapshot("r", SEED), months, {
    returnsStrategy: buildReturnsStrategy(STRATEGY),
    referenceData: referenceData2026,
    rng: createRandomSource(SEED.rngSeed),
  });
}

let idCounter = 0;
const options = () => ({ storage: createMemoryStorage(), now: () => 1_000, generateId: () => `id-${++idCounter}` });

describe("local run store — runs", () => {
  it("creates, reads back, and lists a run", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });

    const run = await store.getRun(runId);
    assert.equal(run?.label, "Baseline");
    assert.equal(run?.status, "draft");
    assert.equal(run?.parentRunId, null);
    assert.equal(run?.ageYearsAtStart, 24, "age is denormalized off the seed so a run list needn't parse every seed");
    assert.deepEqual(await store.listRuns(), [run]);
  });

  it("a fork inherits its parent's seed and strategy, and records where it diverged", async () => {
    const store = createLocalRunStore(options());
    const parentId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    const branchId = await store.forkRun({ parentRunId: parentId, forkMonth: 36, label: "Grad school", forkDecisionLabel: "Go back to school" });

    const branch = await store.getRun(branchId);
    assert.equal(branch?.parentRunId, parentId);
    assert.equal(branch?.forkMonth, 36);
    assert.equal(branch?.forkDecisionLabel, "Go back to school");
    assert.deepEqual(branch?.rootSeed, SEED);
    assert.deepEqual(branch?.returnsStrategy, STRATEGY);
    assert.deepEqual(await store.listRuns({ parentRunId: parentId }), [branch]);
  });

  it("refuses to fork a run that does not exist", async () => {
    const store = createLocalRunStore(options());
    await assert.rejects(() => store.forkRun({ parentRunId: "nope", forkMonth: 1, label: "x" }), /not found/);
  });

  it("deleting a run removes its months, decisions and run-scoped goals", async () => {
    const opts = options();
    const store = createLocalRunStore(opts);
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(24)) });
    await store.setGoal({ runId, label: "Emergency fund", metric: "netWorth", targetCents: cents(20000) });
    const globalGoalId = await store.setGoal({ label: "Retire at 60", metric: "netWorth", targetCents: cents(2_000_000) });

    await store.deleteRun(runId);

    assert.equal(await store.getRun(runId), undefined);
    assert.deepEqual(await store.getNetWorthSeries(runId), []);
    assert.deepEqual((await store.listGoals()).map((g) => g.id), [globalGoalId], "a goal not scoped to the run survives");
    const leftover = [];
    for (let i = 0; i < opts.storage.length; i++) {
      const key = opts.storage.key(i);
      if (key?.includes(runId)) leftover.push(key);
    }
    assert.deepEqual(leftover, [], "no orphaned month keys left behind");
  });
});

describe("local run store — months", () => {
  it("stores a full simulation and serves the timeline", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    const result = simulate(120);

    await store.appendMonths({ runId, months: monthsFromRunResult(result), status: "done" });

    const series = await store.getNetWorthSeries(runId);
    assert.equal(series.length, 120, "one point per computed month");
    assert.equal(series[0]?.month, 1, "the start snapshot is not a computed month");
    assert.equal(series[119]?.month, 120);
    assert.equal(series[119]?.netWorthCents, result.snapshots[120]?.netWorthCents);
    assert.equal((await store.getRun(runId))?.status, "done");
  });

  it("includes the start snapshot only when asked", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(12), { includeStartSnapshot: true }) });
    const series = await store.getNetWorthSeries(runId);
    assert.equal(series.length, 13);
    assert.equal(series[0]?.month, 0);
  });

  it("is idempotent per month, so a retried chunk neither duplicates nor errors", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    const months = monthsFromRunResult(simulate(24));

    await store.appendMonths({ runId, months });
    await store.appendMonths({ runId, months });

    assert.equal((await store.getNetWorthSeries(runId)).length, 24);
  });

  it("keeps the timeline for every month but full detail only at keyframes", async () => {
    const store = createLocalRunStore({ ...options(), persistDetail: "keyframes", keyframeInterval: 12 });
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(60)) });

    assert.equal((await store.getNetWorthSeries(runId)).length, 60, "every month stays on the timeline");

    const keyframe = await store.getMonth(runId, 24);
    assert.ok(keyframe, "month 24 is on the timeline");
    assert.ok(keyframe.snapshot, "a keyframe month keeps its snapshot");
    assert.ok(keyframe.flows.length > 0);

    const between = await store.getMonth(runId, 25);
    assert.equal(between?.snapshot, undefined, "a non-keyframe month is index-only");
    assert.deepEqual(between?.flows, []);
    assert.ok(between && between.netWorthCents > 0, "…but still carries the figure the chart needs");

    const newest = await store.getMonth(runId, 60);
    assert.ok(newest?.snapshot, "the newest month always keeps its snapshot — an extension resumes from it");
  });

  it("finds the nearest anchor to rebuild an unstored month from", async () => {
    const store = createLocalRunStore({ ...options(), persistDetail: "keyframes", keyframeInterval: 12 });
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(60)) });

    const anchor = await store.nearestAnchorBefore(runId, 29);
    assert.equal(anchor?.month, 24);
    assert.ok(anchor?.snapshot, "an anchor is only useful if it carries a snapshot");
  });

  it("getLatestMonth reports where an extension resumes", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(36)) });
    const latest = await store.getLatestMonth(runId);
    assert.equal(latest?.month, 36);
    assert.ok(latest?.snapshot);
  });

  it("persists decisions with the engine id intact, so they round-trip", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({
      runId,
      months: monthsFromRunResult(simulate(12)),
      decisions: [{ id: "d1", month: 6, domain: "career", optionId: "new-job", label: "Take the offer", effectiveFromMonth: 6 }],
    });

    const decisions = await store.listDecisions(runId);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.id, "d1");
    assert.equal(decisions[0]?.runId, runId);
    assert.equal(decisions[0]?.label, "Take the offer");
  });

  it("records a decision passed with no months", async () => {
    // A caller registering a fork before recomputing it passes `months: []`.
    // Dropping the decision there would lose the only record of the choice —
    // which is exactly what a replay-from-seed restore reads back.
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });

    await store.appendMonths({ runId, months: [], decisions: [{ id: "d1", month: 12, domain: "life-event", optionId: "buy", label: "Bought a home", effectiveFromMonth: 12 }] });

    assert.deepEqual((await store.listDecisions(runId)).map((d) => d.id), ["d1"]);
  });

  it("re-recording the same decision id updates rather than duplicates it", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    const decision = { id: "d1", month: 12, domain: "life-event", optionId: "buy", label: "Bought a home", effectiveFromMonth: 12 };

    await store.appendMonths({ runId, months: [], decisions: [decision] });
    await store.appendMonths({ runId, months: [], decisions: [{ ...decision, label: "Bought a bigger home" }] });

    const decisions = await store.listDecisions(runId);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.label, "Bought a bigger home");
  });

  it("keeps decisions ordered by when they take effect", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({
      runId,
      months: [],
      decisions: [
        { id: "late", month: 120, domain: "life-event", optionId: "b", label: "Later", effectiveFromMonth: 120 },
        { id: "early", month: 24, domain: "life-event", optionId: "a", label: "Earlier", effectiveFromMonth: 24 },
      ],
    });
    assert.deepEqual((await store.listDecisions(runId)).map((d) => d.id), ["early", "late"], "replay depends on decisions coming back in effect order");
  });
});

describe("local run store — goals", () => {
  it("creates, filters, updates in place, and removes", async () => {
    const store = createLocalRunStore(options());
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    const scoped = await store.setGoal({ runId, label: "House", metric: "homeEquity", targetCents: cents(80000), byAge: 32 });
    await store.setGoal({ label: "FI", metric: "netWorth", targetCents: cents(1_500_000), byAge: 55, real: true, priority: "must" });

    assert.equal((await store.listGoals()).length, 2);
    assert.deepEqual((await store.listGoals({ runId })).map((g) => g.id), [scoped]);

    await store.setGoal({ id: scoped, runId, label: "House (bigger)", metric: "homeEquity", targetCents: cents(120000), byAge: 34 });
    const updated = (await store.listGoals({ runId }))[0];
    assert.equal(updated?.label, "House (bigger)");
    assert.equal(updated?.targetCents, cents(120000));
    assert.equal((await store.listGoals()).length, 2, "updating reuses the id rather than adding a row");

    await store.removeGoal(scoped);
    assert.equal((await store.listGoals()).length, 1);
  });
});

/** A storage that refuses writes past a byte budget, the way a browser does at ~5 MB. */
function createQuotaLimitedStorage(maxBytes: number): KeyValueStorage {
  const inner = createMemoryStorage();
  const used = () => {
    let total = 0;
    for (let i = 0; i < inner.length; i++) {
      const key = inner.key(i);
      if (key !== null) total += key.length + (inner.getItem(key)?.length ?? 0);
    }
    return total;
  };
  return {
    get length() {
      return inner.length;
    },
    key: (i) => inner.key(i),
    getItem: (k) => inner.getItem(k),
    removeItem: (k) => inner.removeItem(k),
    setItem: (k, v) => {
      const existing = inner.getItem(k)?.length ?? 0;
      if (used() - existing + k.length + v.length > maxBytes) {
        const error = new Error("quota");
        error.name = "QuotaExceededError";
        throw error;
      }
      inner.setItem(k, v);
    },
  };
}

describe("local run store — quota pressure", () => {
  it("evicts old detail to fit new months, and keeps the timeline whole", async () => {
    const events: QuotaEvent[] = [];
    const store = createLocalRunStore({
      storage: createQuotaLimitedStorage(120_000),
      persistDetail: "keyframes",
      keyframeInterval: 6,
      onQuotaExceeded: (info) => events.push(info),
      now: () => 1_000,
      generateId: () => `id-${++idCounter}`,
    });
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });

    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(240)) });

    assert.ok(events.length > 0, "eviction should have been needed at this budget");
    assert.equal((await store.getNetWorthSeries(runId)).length, 240, "the timeline survives eviction intact");
    assert.ok(await store.getRun(runId), "the run header survives eviction");

    const newest = await store.getMonth(runId, 240);
    assert.ok(newest?.snapshot, "the newest month's snapshot is never the eviction victim");

    const evicted = events.flatMap((e) => e.evictedMonths);
    assert.ok(
      evicted.every((m) => m !== 240),
      "eviction never targets the resume point",
    );
  });

  it("a month whose detail could not be stored still reads back cleanly", async () => {
    const store = createLocalRunStore({
      // Enough for the run header and index, far too little for any month detail.
      storage: createQuotaLimitedStorage(40_000),
      persistDetail: "all",
      onQuotaExceeded: () => {},
      now: () => 1_000,
      generateId: () => `id-${++idCounter}`,
    });
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(60)) });

    const month = await store.getMonth(runId, 30);
    assert.ok(month, "the month is still known");
    assert.equal(month.snapshot, undefined, "…without detail");
    assert.deepEqual(month.flows, [], "an unstored detail reads as empty, never as a dangling key");
    assert.ok(month.taxBasis, "tax basis lives in the light index, so it survives");
  });
});

describe("local run store — durability", () => {
  it("survives a reload: a second store over the same storage sees everything", async () => {
    const storage = createMemoryStorage();
    const first = createLocalRunStore({ storage, now: () => 1_000, generateId: () => `id-${++idCounter}` });
    const runId = await first.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await first.appendMonths({ runId, months: monthsFromRunResult(simulate(36)), status: "done" });

    const second = createLocalRunStore({ storage });
    const run = await second.getRun(runId);
    assert.equal(run?.label, "Baseline");
    assert.equal(run?.status, "done");
    assert.equal((await second.getNetWorthSeries(runId)).length, 36);
    assert.deepEqual(run?.rootSeed, SEED, "the seed round-trips through JSON, so the run can be recomputed from scratch");
  });

  it("treats a corrupt entry as absent rather than throwing", async () => {
    const storage = createMemoryStorage();
    const store = createLocalRunStore({ storage, namespace: "ns" });
    storage.setItem("ns:runs", "{not json");
    assert.deepEqual(await store.listRuns(), []);
    await assert.doesNotReject(() => store.createRun({ label: "Fresh", rootSeed: SEED, returnsStrategy: STRATEGY }));
    assert.equal((await store.listRuns()).length, 1);
  });

  it("namespaces isolate two stores on one origin", async () => {
    const storage = createMemoryStorage();
    const a = createLocalRunStore({ storage, namespace: "app-a" });
    const b = createLocalRunStore({ storage, namespace: "app-b" });
    await a.createRun({ label: "A", rootSeed: SEED, returnsStrategy: STRATEGY });

    assert.equal((await b.listRuns()).length, 0);
    await b.clear();
    assert.equal((await a.listRuns()).length, 1, "clearing one namespace leaves the other alone");
  });

  it("reports roughly how much space it is using", async () => {
    const store = createLocalRunStore(options());
    const before = store.approximateBytesUsed();
    const runId = await store.createRun({ label: "Baseline", rootSeed: SEED, returnsStrategy: STRATEGY });
    await store.appendMonths({ runId, months: monthsFromRunResult(simulate(60)) });
    assert.ok(store.approximateBytesUsed() > before);
  });
});
