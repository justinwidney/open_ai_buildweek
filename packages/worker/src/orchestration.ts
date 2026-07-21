import type Piscina from "piscina";
import type { LifeStateSnapshot, RunSimulationResult } from "@control-ai/engine";
import { appendMonths, createBranch, enqueueJob, updateJobStatus, type Database } from "@control-ai/db";
import type { ReturnsStrategyConfig } from "./returns-config.js";
import type { TickJobPayload } from "./tick-worker.js";

const DEFAULT_CHUNK_MONTHS = 60;

export interface ExtendRunParams {
  runId: string;
  fromSnapshot: LifeStateSnapshot;
  toMonth: number;
  returnsStrategyConfig: ReturnsStrategyConfig;
  seed: string | number;
  /** Months computed per pool dispatch; default 60 so "zoom ahead" to a distant month doesn't eagerly compute the whole horizon up front. */
  chunkMonths?: number;
  /**
   * True when `fromSnapshot` is a fork point borrowed from a parent run (a
   * branch), so its month is already persisted under the parent and must not
   * be written into this run's own `run_months`. Set by `branchRun`; a plain
   * root-run extension leaves it false so the genesis month header is stored.
   */
  startSnapshotOwnedByParent?: boolean;
}

/**
 * Extends a run from `fromSnapshot.month` to `toMonth` in bounded chunks.
 * Each chunk's computation runs on the pool (a real OS thread, so it
 * doesn't block whatever else the main thread is doing); persistence for
 * that chunk runs on the caller's own `db` connection right after it comes
 * back, before the next chunk is dispatched — so a crash partway through a
 * long extension leaves every already-completed chunk durably saved.
 */
export async function extendRun(pool: Piscina, db: Database, params: ExtendRunParams): Promise<LifeStateSnapshot> {
  const chunkSize = params.chunkMonths ?? DEFAULT_CHUNK_MONTHS;
  let current = params.fromSnapshot;
  let remaining = params.toMonth - params.fromSnapshot.month;
  if (remaining <= 0) return current;

  const jobId = `${params.runId}:${params.fromSnapshot.month}-${params.toMonth}`;
  await enqueueJob(db, { id: jobId, runId: params.runId, fromMonth: params.fromSnapshot.month, toMonth: params.toMonth });
  await updateJobStatus(db, jobId, "running");

  try {
    let isFirstChunk = true;
    while (remaining > 0) {
      const monthsToCompute = Math.min(chunkSize, remaining);
      const payload: TickJobPayload = {
        fromSnapshot: current,
        monthsToCompute,
        returnsStrategyConfig: params.returnsStrategyConfig,
        seed: params.seed,
      };
      const result: RunSimulationResult = await pool.run(payload);
      // The first snapshot of every chunk is the input month, already persisted by
      // either the previous chunk (its last snapshot) or, for chunk one, the parent
      // run when this is a branch. Only a genuine root-run genesis month needs its
      // header written here.
      const includeFirstSnapshotHeader = isFirstChunk && !params.startSnapshotOwnedByParent;
      await appendMonths(db, params.runId, result, { includeFirstSnapshotHeader });
      current = result.snapshots[result.snapshots.length - 1]!;
      remaining -= monthsToCompute;
      isFirstChunk = false;
    }
    await updateJobStatus(db, jobId, "done");
    return current;
  } catch (error) {
    await updateJobStatus(db, jobId, "error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export interface BranchRunParams {
  parentRunId: string;
  forkMonth: number;
  newRunId: string;
  label: string;
  /** The parent's snapshot at `forkMonth`, with whatever decision changed already applied — see `@control-ai/engine`'s simulation README on why decision effects are the caller's responsibility, not the kernel's. */
  forkSnapshot: LifeStateSnapshot;
  toMonth: number;
  returnsStrategyConfig: ReturnsStrategyConfig;
  seed: string | number;
  chunkMonths?: number;
}

/** Creates a branch row and computes only its post-fork months — the shared prefix with its parent is never recomputed or duplicated. */
export async function branchRun(pool: Piscina, db: Database, params: BranchRunParams): Promise<LifeStateSnapshot> {
  await createBranch(db, { parentRunId: params.parentRunId, forkMonth: params.forkMonth, newRunId: params.newRunId, label: params.label });
  return extendRun(pool, db, {
    runId: params.newRunId,
    fromSnapshot: { ...params.forkSnapshot, runId: params.newRunId, parentSnapshotRef: { runId: params.parentRunId, month: params.forkMonth } },
    toMonth: params.toMonth,
    returnsStrategyConfig: params.returnsStrategyConfig,
    seed: params.seed,
    chunkMonths: params.chunkMonths,
    startSnapshotOwnedByParent: true,
  });
}
