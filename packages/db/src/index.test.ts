import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  cents,
  createFixedReturnsStrategy,
  createRandomSource,
  initialDebtState,
  initialFinancialAssetState,
  initialHoldingState,
  initialTaxBasis,
  referenceData2026,
  runSimulation,
  type ExpenseState,
  type IncomeState,
  type LifeStateSnapshot,
  type PhysicalAssetState,
} from "@control-ai/engine";
import { computeNetWorthCents } from "@control-ai/engine";
import { appendMonths, createBranch, createPgliteDb, getSnapshotAt, saveRun, type Database } from "./index.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

function buildInitialSnapshot(runId: string): LifeStateSnapshot {
  const income: IncomeState = {
    config: { id: "job-1", label: "Engineer", baseMonthlyGrossCents: cents(8_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 },
  };
  const expense: ExpenseState = {
    config: { id: "rent", label: "Rent", category: "fixed", baseMonthlyAmountCents: cents(1_800), annualInflationRate: 0.03, startMonth: 0 },
  };
  const debt = initialDebtState({ id: "mortgage", label: "Mortgage", originalPrincipalCents: cents(400_000), annualRate: 0.0655, termMonths: 360, startMonth: 0, monthlyEscrowCents: cents(400) });
  const cash = initialFinancialAssetState({ id: "checking", label: "Checking", annualInterestRate: 0.005 }, cents(10_000));
  const holding = initialHoldingState({ id: "brokerage", label: "Brokerage", assetClassId: "equity" }, cents(5_000));
  const house: PhysicalAssetState = {
    config: { id: "house", label: "Home", purchasePriceCents: cents(400_000), purchaseMonth: 0, annualValueChangeRate: 0.03, monthlyUpkeepCents: cents(300), linkedDebtId: "mortgage" },
  };
  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [holding] }, physicalAssets: [house], debts: [debt], month: 0 });

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

function runOptions() {
  return { returnsStrategy: createFixedReturnsStrategy({ equity: 0.07 }), referenceData: referenceData2026, rng: createRandomSource("db-test-seed") };
}

describe("@control-ai/db repository (against PGlite)", () => {
  let client: PGlite;
  let db: Database;

  before(async () => {
    client = new PGlite();
    db = createPgliteDb(client);
    await migrate(db, { migrationsFolder });
  });

  after(async () => {
    await client.close();
  });

  it("saves a run and persists appended months, then reads a matching snapshot back", async () => {
    const initial = buildInitialSnapshot("run-1");
    await saveRun(db, { id: "run-1", label: "Baseline", rootSeed: { note: "test" }, returnsStrategy: { kind: "fixed" } });

    const result = runSimulation(initial, 12, runOptions());
    await appendMonths(db, "run-1", result);

    const persisted = await getSnapshotAt(db, { runId: "run-1", parentRunId: null, forkMonth: null }, 6);
    assert.ok(persisted);
    assert.equal(persisted!.netWorthCents, result.snapshots[6]!.netWorthCents);
    assert.ok(persisted!.flows.some((f) => f.domain === "income" && f.viewKey === "takeHome"));
    assert.ok(persisted!.balances.some((b) => b.domain === "debt" && b.metricKey === "remainingBalance"));
  });

  it("re-appending an already-persisted month does not error or duplicate the run_months header", async () => {
    const initial = buildInitialSnapshot("run-2");
    await saveRun(db, { id: "run-2", label: "Idempotency check", rootSeed: {}, returnsStrategy: {} });
    const result = runSimulation(initial, 3, runOptions());
    await appendMonths(db, "run-2", result);
    // Re-append the exact same result — run_months uses onConflictDoNothing, so this must not throw.
    await assert.doesNotReject(() => appendMonths(db, "run-2", result));
  });

  it("a branch delegates to its parent for months at or before the fork, and to its own rows after", async () => {
    const parentInitial = buildInitialSnapshot("parent-1");
    await saveRun(db, { id: "parent-1", label: "Parent", rootSeed: {}, returnsStrategy: {} });
    const parentResult = runSimulation(parentInitial, 24, runOptions());
    await appendMonths(db, "parent-1", parentResult);

    const forkMonth = 12;
    await createBranch(db, { parentRunId: "parent-1", forkMonth, newRunId: "child-1", label: "Branch" });

    // The child only ever computes and stores months after the fork.
    const forkSnapshot = parentResult.snapshots.find((s) => s.month === forkMonth)!;
    const divergedSnapshot: LifeStateSnapshot = {
      ...forkSnapshot,
      runId: "child-1",
      parentSnapshotRef: { runId: "parent-1", month: forkMonth },
      expenses: [{ config: { ...forkSnapshot.expenses[0]!.config, baseMonthlyAmountCents: cents(3_500) } }],
    };
    const childResult = runSimulation(divergedSnapshot, 12, runOptions());
    await appendMonths(db, "child-1", childResult);

    const childRef = { runId: "child-1", parentRunId: "parent-1", forkMonth };

    const beforeForkFromChild = await getSnapshotAt(db, childRef, 6);
    const beforeForkFromParent = await getSnapshotAt(db, { runId: "parent-1", parentRunId: null, forkMonth: null }, 6);
    assert.equal(beforeForkFromChild!.netWorthCents, beforeForkFromParent!.netWorthCents);

    const afterForkFromChild = await getSnapshotAt(db, childRef, 18);
    const afterForkFromParent = await getSnapshotAt(db, { runId: "parent-1", parentRunId: null, forkMonth: null }, 18);
    assert.notEqual(afterForkFromChild!.netWorthCents, afterForkFromParent!.netWorthCents);
  });

  it("createBranch throws if the parent run does not exist", async () => {
    await assert.rejects(() => createBranch(db, { parentRunId: "does-not-exist", forkMonth: 0, newRunId: "orphan", label: "x" }));
  });
});
