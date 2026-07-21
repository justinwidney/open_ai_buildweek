import type { LifeStateSnapshot, MonthKey } from "@control-ai/engine";
import type { NetWorthPoint, RunId, StoredDecision, StoredGoal, StoredMonth, StoredRun } from "./records.js";
import type { ReturnsStrategyConfig } from "./returns.js";
import type { RootSeed } from "./seed.js";
import type { RunStatus } from "./status.js";

/**
 * The one API every persistence backend implements: Convex (reactive,
 * networked), Postgres via @control-ai/db (analytics-grade, feeds Cube), and
 * localStorage (offline, zero-setup). Application code depends on this
 * interface, never on a concrete backend, so "let the user make a lot of
 * changes without connecting to Convex" is a store swap at the composition
 * root rather than a second code path through the UI.
 *
 * Every method is async even where an implementation answers synchronously —
 * a networked backend cannot be synchronous, and it is the caller that must
 * not care which one it holds.
 */
export interface RunStore {
  /** Names the backend, for diagnostics and for a UI that surfaces "working offline". */
  readonly kind: RunStoreKind;

  // --- Runs ---
  createRun(params: CreateRunParams): Promise<RunId>;
  /** Creates a branch that inherits its parent's seed and returns strategy. Its own months cover only the post-fork range. */
  forkRun(params: ForkRunParams): Promise<RunId>;
  getRun(runId: RunId): Promise<StoredRun | undefined>;
  listRuns(filter?: ListRunsFilter): Promise<StoredRun[]>;
  updateRunStatus(runId: RunId, status: RunStatus, updatedAt?: number): Promise<void>;
  /** Deletes a run and everything under it (months, decisions, run-scoped goals). Does not cascade to child branches — `listRuns` still shows them, orphaned. */
  deleteRun(runId: RunId): Promise<void>;

  // --- Months ---
  /** Upserts computed months. Idempotent per (runId, month), so re-running a chunk after a crash is safe. */
  appendMonths(params: AppendMonthsParams): Promise<void>;
  getMonth(runId: RunId, month: MonthKey): Promise<StoredMonth | undefined>;
  /** The timeline chart's data. Cheap by design — implementations must not deserialize every month's full statement to answer this. */
  getNetWorthSeries(runId: RunId): Promise<NetWorthPoint[]>;
  /** The furthest month computed for a run, i.e. where an extension resumes from. */
  getLatestMonth(runId: RunId): Promise<StoredMonth | undefined>;

  // --- Decisions ---
  listDecisions(runId: RunId): Promise<StoredDecision[]>;

  // --- Goals ---
  setGoal(goal: SetGoalParams): Promise<string>;
  listGoals(filter?: ListGoalsFilter): Promise<StoredGoal[]>;
  removeGoal(goalId: string): Promise<void>;
}

export type RunStoreKind = "local" | "memory" | "convex" | "postgres";

export interface CreateRunParams {
  /** Omit to let the store generate one. Supply it to make a create idempotent, or to mirror an id across backends. */
  id?: RunId;
  label: string;
  rootSeed: RootSeed;
  returnsStrategy: ReturnsStrategyConfig;
  ownerId?: string;
}

export interface ForkRunParams {
  id?: RunId;
  parentRunId: RunId;
  forkMonth: MonthKey;
  label: string;
  /** The decision that caused the fork, shown as a marker on the pathway UI. */
  forkDecisionLabel?: string;
}

export interface ListRunsFilter {
  ownerId?: string;
  /** Only branches of this run. */
  parentRunId?: RunId;
}

export interface AppendMonthsParams {
  runId: RunId;
  /** `runId` is filled in by the store, so a caller can hand over engine output without rewriting every row. */
  months: readonly Omit<StoredMonth, "runId">[];
  decisions?: readonly Omit<StoredDecision, "runId">[];
  /** Sets the run's status once the batch lands. Defaults to leaving it untouched. */
  status?: RunStatus;
}

export interface SetGoalParams extends Omit<StoredGoal, "id" | "runId" | "ownerId"> {
  /** Omit to update an existing goal in place; otherwise a new goal is created. */
  id?: string;
  runId?: RunId;
  ownerId?: string;
}

export interface ListGoalsFilter {
  runId?: RunId;
  ownerId?: string;
}

/**
 * Turns a `RunSimulationResult` into the `appendMonths` payload.
 *
 * `runSimulation` returns `snapshots.length === details.length + 1`: the
 * first snapshot is the *input* month the chunk started from, not a month
 * this chunk computed. Pairing them off by index is the single most
 * error-prone step in every persistence layer, so it lives here once.
 * `includeStartSnapshot` defaults to false — the start month is already
 * stored, by the previous chunk or (for a branch) by the parent run.
 */
export function monthsFromRunResult(
  result: { snapshots: readonly LifeStateSnapshot[]; details: readonly { month: MonthKey; flows: readonly unknown[]; balances: readonly unknown[] }[] },
  options: { includeStartSnapshot?: boolean } = {},
): Omit<StoredMonth, "runId">[] {
  const months: Omit<StoredMonth, "runId">[] = [];
  const [start] = result.snapshots;
  if (options.includeStartSnapshot && start) {
    months.push({ month: start.month, netWorthCents: start.netWorthCents, taxBasis: start.taxBasis, flows: [], balances: [], snapshot: start });
  }
  for (let i = 0; i < result.details.length; i++) {
    const snapshot = result.snapshots[i + 1];
    const detail = result.details[i];
    if (!snapshot || !detail) continue;
    months.push({
      month: snapshot.month,
      netWorthCents: snapshot.netWorthCents,
      taxBasis: snapshot.taxBasis,
      flows: detail.flows as StoredMonth["flows"],
      balances: detail.balances as StoredMonth["balances"],
      snapshot,
    });
  }
  return months;
}
