import { and, eq } from "drizzle-orm";
import type { MonthKey, RunSimulationResult, TaxBasisState } from "@control-ai/engine";
import type { Database } from "./client.js";
import { balanceSnapshots, decisions, flowLineItems, runMonths, runs } from "./schema.js";

export interface SaveRunParams {
  id: string;
  parentRunId?: string | null;
  forkMonth?: number | null;
  label: string;
  /** Initial decisions/config a run was seeded with — opaque to this layer, interpreted by whatever reconstructs a LifeStateSnapshot from it. */
  rootSeed: unknown;
  /** Strategy kind + params + rng seed, so the exact same run can be recomputed later. */
  returnsStrategy: unknown;
}

export async function saveRun(db: Database, params: SaveRunParams): Promise<void> {
  await db.insert(runs).values({
    id: params.id,
    parentRunId: params.parentRunId ?? null,
    forkMonth: params.forkMonth ?? null,
    label: params.label,
    rootSeed: params.rootSeed,
    returnsStrategy: params.returnsStrategy,
    status: "draft",
  });
}

/**
 * Persists every snapshot/detail from a `runSimulation` (or worker-chunk)
 * result. Safe to call repeatedly for the same run as later chunks are
 * computed — `run_months`/`decisions` rows use `onConflictDoNothing` so
 * re-appending an already-stored month (e.g. a retried worker job) doesn't
 * error or duplicate. `flow_line_items`/`balance_snapshots` rows are not
 * conflict-guarded since they have no natural unique key and a caller is
 * expected to only append months once each has genuinely been computed.
 */
export async function appendMonths(db: Database, runId: string, result: RunSimulationResult): Promise<void> {
  const { snapshots, details } = result;
  if (snapshots.length === 0) return;

  const runMonthRows = snapshots.map((s) => ({
    runId,
    month: s.month,
    netWorthCents: s.netWorthCents,
    taxBasis: s.taxBasis,
  }));
  await db.insert(runMonths).values(runMonthRows).onConflictDoNothing();

  const flowRows = details.flatMap((d) =>
    d.flows.map((f) => ({
      runId,
      month: d.month,
      domain: f.domain,
      entityId: f.entityId,
      entityLabel: f.entityLabel,
      viewKey: f.viewKey,
      amountCents: f.amountCents,
    })),
  );
  if (flowRows.length > 0) await db.insert(flowLineItems).values(flowRows);

  const balanceRows = details.flatMap((d) =>
    d.balances.map((b) => ({
      runId,
      month: d.month,
      domain: b.domain,
      entityId: b.entityId,
      metricKey: b.metricKey,
      amountCents: b.amountCents,
    })),
  );
  if (balanceRows.length > 0) await db.insert(balanceSnapshots).values(balanceRows);

  const latestSnapshot = snapshots[snapshots.length - 1]!;
  if (latestSnapshot.decisions.length > 0) {
    const decisionRows = latestSnapshot.decisions.map((d) => ({
      id: `${runId}:${d.id}`,
      runId,
      month: d.effectiveFromMonth,
      domain: d.domain,
      optionId: d.optionId,
      label: d.label,
      effectiveFromMonth: d.effectiveFromMonth,
    }));
    await db.insert(decisions).values(decisionRows).onConflictDoNothing();
  }
}

/** Mirrors @control-ai/engine's `RunRef` without importing its branching logic — this layer re-derives the same one-line delegation rule against the database instead of an in-memory `fetch`. */
export interface RunRef {
  runId: string;
  parentRunId: string | null;
  forkMonth: MonthKey | null;
}

export interface PersistedFlow {
  domain: string;
  entityId: string;
  entityLabel: string;
  viewKey: string;
  amountCents: number;
}

export interface PersistedBalance {
  domain: string;
  entityId: string;
  metricKey: string;
  amountCents: number;
}

/**
 * A database-shaped projection of one month, not a full reconstructed
 * `LifeStateSnapshot` — the database stores aggregate results (net worth,
 * tax basis, named flow/balance line items), not each entity's static
 * config (an income source's growth rate, a debt's term), so it cannot by
 * itself resurrect a `LifeStateSnapshot` capable of computing the *next*
 * tick. Resuming computation needs those configs from wherever a run's
 * `rootSeed` (plus any decisions since) are interpreted — a follow-up
 * concern once decisions can change entity configs mid-run, not something
 * this repository layer solves today.
 */
export interface PersistedMonthSnapshot {
  runId: string;
  month: MonthKey;
  netWorthCents: number;
  taxBasis: TaxBasisState;
  flows: readonly PersistedFlow[];
  balances: readonly PersistedBalance[];
}

/**
 * The database-backed analogue of @control-ai/engine's `resolveSnapshot`:
 * delegates to the parent run for any month at or before the fork point,
 * and to the run's own storage otherwise. A branch's own rows never need
 * to include anything at or before its fork month.
 */
export async function getSnapshotAt(db: Database, ref: RunRef, month: MonthKey): Promise<PersistedMonthSnapshot | undefined> {
  const resolvedRunId = ref.parentRunId !== null && ref.forkMonth !== null && month <= ref.forkMonth ? ref.parentRunId : ref.runId;

  const [header] = await db
    .select()
    .from(runMonths)
    .where(and(eq(runMonths.runId, resolvedRunId), eq(runMonths.month, month)));
  if (!header) return undefined;

  const flows = await db
    .select()
    .from(flowLineItems)
    .where(and(eq(flowLineItems.runId, resolvedRunId), eq(flowLineItems.month, month)));
  const balances = await db
    .select()
    .from(balanceSnapshots)
    .where(and(eq(balanceSnapshots.runId, resolvedRunId), eq(balanceSnapshots.month, month)));

  return {
    runId: resolvedRunId,
    month,
    netWorthCents: header.netWorthCents,
    taxBasis: header.taxBasis as TaxBasisState,
    flows,
    balances,
  };
}

export interface CreateBranchParams {
  parentRunId: string;
  forkMonth: number;
  newRunId: string;
  label: string;
}

/** Inserts a new run row that inherits its parent's root seed and returns strategy, marked with the fork point that makes it a branch. */
export async function createBranch(db: Database, params: CreateBranchParams): Promise<void> {
  const [parent] = await db.select().from(runs).where(eq(runs.id, params.parentRunId));
  if (!parent) {
    throw new Error(`Cannot branch: parent run "${params.parentRunId}" not found`);
  }
  await db.insert(runs).values({
    id: params.newRunId,
    parentRunId: params.parentRunId,
    forkMonth: params.forkMonth,
    label: params.label,
    rootSeed: parent.rootSeed,
    returnsStrategy: parent.returnsStrategy,
    status: "draft",
  });
}
