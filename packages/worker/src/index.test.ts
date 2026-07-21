import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import type Piscina from "piscina";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { cents, type LifeStateSnapshot } from "@control-ai/engine";
import { buildInitialSnapshot as buildFromSeed, type RootSeed } from "@control-ai/shared/sim";
import { createPgliteDb, getSnapshotAt, saveRun, schema, type Database } from "@control-ai/db";
import { branchRun, createPool, extendRun, type ReturnsStrategyConfig } from "./index.js";

// db package's own migrations — reused here rather than duplicated, since this package only ever
// runs against @control-ai/db's schema.
const migrationsFolder = fileURLToPath(new URL("../../db/drizzle", import.meta.url));

/** The run these tests extend and branch, as the `RootSeed` actually written to `root_seed`. */
const TEST_SEED: RootSeed = {
  version: 1,
  startCalendarYear: 2026,
  filingStatus: "single",
  ageYearsAtStart: 30,
  incomes: [{ id: "job-1", label: "Engineer", baseMonthlyGrossCents: cents(8_000), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.06, startMonth: 0 }],
  expenses: [{ id: "rent", label: "Rent", category: "fixed", baseMonthlyAmountCents: cents(1_800), annualInflationRate: 0.03, startMonth: 0 }],
  debts: [{ id: "mortgage", label: "Mortgage", originalPrincipalCents: cents(400_000), annualRate: 0.0655, termMonths: 360, startMonth: 0, monthlyEscrowCents: cents(400) }],
  financialAssets: [{ config: { id: "checking", label: "Checking", annualInterestRate: 0.005 }, openingBalanceCents: cents(10_000) }],
  holdings: [{ config: { id: "brokerage", label: "Brokerage", assetClassId: "equity" }, openingBalanceCents: cents(5_000) }],
  physicalAssets: [{ id: "house", label: "Home", purchasePriceCents: cents(400_000), purchaseMonth: 0, annualValueChangeRate: 0.03, monthlyUpkeepCents: cents(300), linkedDebtId: "mortgage" }],
  rngSeed: "worker-test-seed",
};

function buildInitialSnapshot(runId: string): LifeStateSnapshot {
  return buildFromSeed(runId, TEST_SEED);
}

const returnsStrategyConfig: ReturnsStrategyConfig = { kind: "fixed", annualRatesByAssetClass: { equity: 0.07 } };

describe("@control-ai/worker", () => {
  it("a pool can dispatch pure computation to a real worker thread and get a result back", async () => {
    const pool = createPool();
    try {
      const result = await pool.run({
        fromSnapshot: buildInitialSnapshot("smoke-test"),
        monthsToCompute: 6,
        returnsStrategyConfig,
        seed: "smoke-test-seed",
      });
      assert.equal(result.snapshots.length, 7);
      assert.equal(result.details.length, 6);
      assert.equal(result.snapshots[6].month, 6);
    } finally {
      await pool.destroy();
    }
  });

  describe("persistence and branching (against PGlite)", () => {
    let client: PGlite;
    let db: Database;
    let pool: Piscina;

    before(async () => {
      client = new PGlite();
      db = createPgliteDb(client);
      await migrate(db, { migrationsFolder });
      pool = createPool();
    });

    after(async () => {
      await pool.destroy();
      await client.close();
    });

    it("extendRun computes in bounded chunks and persists every chunk", async () => {
      const initial = buildInitialSnapshot("extend-1");
      await saveRun(db, { id: "extend-1", label: "Extend test", rootSeed: TEST_SEED, returnsStrategy: returnsStrategyConfig });

      // 10-month chunks over a 30-month horizon => 3 dispatches to the pool.
      const final = await extendRun(pool, db, { runId: "extend-1", fromSnapshot: initial, toMonth: 30, returnsStrategyConfig, seed: "extend-seed", chunkMonths: 10 });
      assert.equal(final.month, 30);

      const persistedMonth30 = await getSnapshotAt(db, { runId: "extend-1", parentRunId: null, forkMonth: null }, 30);
      assert.ok(persistedMonth30);
      assert.equal(persistedMonth30!.netWorthCents, final.netWorthCents);

      const persistedMonth15 = await getSnapshotAt(db, { runId: "extend-1", parentRunId: null, forkMonth: null }, 15);
      assert.ok(persistedMonth15, "an intermediate chunk boundary month should also be persisted");
    });

    it("branchRun creates a branch and only computes/persists months after the fork", async () => {
      const initial = buildInitialSnapshot("branch-parent");
      await saveRun(db, { id: "branch-parent", label: "Parent", rootSeed: TEST_SEED, returnsStrategy: returnsStrategyConfig });
      const parentFinal = await extendRun(pool, db, { runId: "branch-parent", fromSnapshot: initial, toMonth: 24, returnsStrategyConfig, seed: "parent-seed", chunkMonths: 24 });
      assert.equal(parentFinal.month, 24);

      const forkMonth = 12;
      const forkSnapshot = await getSnapshotAt(db, { runId: "branch-parent", parentRunId: null, forkMonth: null }, forkMonth);
      assert.ok(forkSnapshot);

      // The full parent snapshot at the fork month (needed to resume ticking) — see the
      // repository's PersistedMonthSnapshot doc comment on why the DB alone can't reconstruct one;
      // this test constructs it the same way an in-process caller with the parent's in-memory
      // snapshots already available would.
      const parentInMemorySnapshotAtFork: LifeStateSnapshot = {
        ...initial,
        month: forkMonth,
        netWorthCents: forkSnapshot!.netWorthCents,
        taxBasis: forkSnapshot!.taxBasis,
      };
      const divergedForkSnapshot: LifeStateSnapshot = {
        ...parentInMemorySnapshotAtFork,
        expenses: [{ config: { ...parentInMemorySnapshotAtFork.expenses[0]!.config, baseMonthlyAmountCents: cents(3_500) } }],
      };

      await branchRun(pool, db, {
        parentRunId: "branch-parent",
        forkMonth,
        newRunId: "branch-child",
        label: "Child",
        forkSnapshot: divergedForkSnapshot,
        toMonth: 18,
        returnsStrategyConfig,
        seed: "child-seed",
        chunkMonths: 30,
      });

      // The child's own run_months rows must never include anything at or before the fork.
      const childOwnRows = await db.select().from(schema.runMonths).where(eq(schema.runMonths.runId, "branch-child"));
      assert.ok(childOwnRows.length > 0);
      assert.ok(childOwnRows.every((row) => row.month > forkMonth), "the child must never store a month at or before its fork point");

      const childRef = { runId: "branch-child", parentRunId: "branch-parent", forkMonth };
      const resolvedPreFork = await getSnapshotAt(db, childRef, 6);
      const parentPreFork = await getSnapshotAt(db, { runId: "branch-parent", parentRunId: null, forkMonth: null }, 6);
      assert.equal(resolvedPreFork!.netWorthCents, parentPreFork!.netWorthCents, "pre-fork months should resolve through the parent");
    });
  });
});
