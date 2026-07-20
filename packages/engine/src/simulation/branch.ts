import type { MonthKey } from "../types/month.js";
import type { LifeStateSnapshot } from "./state.js";

/**
 * A run's identity plus, if it's a branch, exactly where it diverged from
 * its parent. Months at or before `forkMonth` are never recomputed or
 * duplicated in the child's own storage — `resolveSnapshot` delegates to
 * the parent for them. This is what makes "turn 180 degrees for an
 * alternate life from the same fork point" cheap regardless of how far
 * into the parent's timeline the fork happens.
 */
export interface RunRef {
  runId: string;
  parentRunId: string | null;
  forkMonth: MonthKey | null;
}

export function rootRun(runId: string): RunRef {
  return { runId, parentRunId: null, forkMonth: null };
}

export function forkRun(parent: RunRef, atMonth: MonthKey, newRunId: string): RunRef {
  return { runId: newRunId, parentRunId: parent.runId, forkMonth: atMonth };
}

/**
 * Resolves the snapshot for `(ref, month)` by delegating to the parent run
 * for any month at or before the fork point, and to the run's own storage
 * otherwise. `fetch` is supplied by the caller so the exact same algorithm
 * works against an in-memory array (tests, interactive use) or a
 * database-backed lookup (`@control-ai/db`) without this function knowing
 * which.
 */
export function resolveSnapshot(
  ref: RunRef,
  month: MonthKey,
  fetch: (runId: string, month: MonthKey) => LifeStateSnapshot | undefined,
): LifeStateSnapshot | undefined {
  if (ref.parentRunId !== null && ref.forkMonth !== null && month <= ref.forkMonth) {
    return fetch(ref.parentRunId, month);
  }
  return fetch(ref.runId, month);
}
