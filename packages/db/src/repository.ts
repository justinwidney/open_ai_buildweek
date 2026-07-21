import { and, eq } from "drizzle-orm";
import type { MonthKey, RunSimulationResult, TaxBasisState } from "@control-ai/engine";
import { isValidBalance, isValidFlow, type ReturnsStrategyConfig, type RootSeed, type RunStatus, type TypedBalanceRecord, type TypedFlowLineItem } from "@control-ai/shared/sim";
import type { Database } from "./client.js";
import { balanceSnapshots, decisions, flowLineItems, runMonths, runs } from "./schema.js";

export interface SaveRunParams {
  id: string;
  parentRunId?: string | null;
  forkMonth?: number | null;
  label: string;
  forkDecisionLabel?: string | null;
  /**
   * The static entity configs this run replays from. Typed as `RootSeed`
   * rather than `unknown`: paired with `buildInitialSnapshot` it is what
   * makes a persisted run resumable at all, since the fact tables below store
   * aggregate *results* and never an income's growth rate or a debt's term.
   */
  rootSeed: RootSeed;
  /** Strategy kind + params, so the exact same run can be recomputed later. */
  returnsStrategy: ReturnsStrategyConfig;
  ownerId?: string | null;
}

export async function saveRun(db: Database, params: SaveRunParams): Promise<void> {
  await db.insert(runs).values({
    id: params.id,
    parentRunId: params.parentRunId ?? null,
    forkMonth: params.forkMonth ?? null,
    label: params.label,
    forkDecisionLabel: params.forkDecisionLabel ?? null,
    rootSeed: params.rootSeed,
    returnsStrategy: params.returnsStrategy,
    status: "draft",
    ageYearsAtStart: params.rootSeed.ageYearsAtStart ?? null,
    ownerId: params.ownerId ?? null,
  });
}

/** Moves a run through its lifecycle. Typed against the shared `RunStatus`, so an unknown status can't reach the column. */
export async function updateRunStatus(db: Database, runId: string, status: RunStatus): Promise<void> {
  await db.update(runs).set({ status, updatedAt: new Date() }).where(eq(runs.id, runId));
}

export interface AppendMonthsOptions {
  /**
   * Whether to persist a `run_months` header for the result's first
   * snapshot. Every `RunSimulationResult.snapshots[0]` is the *input*
   * snapshot the chunk started from, not a month this chunk computed. For a
   * root run's genesis month that header is genuinely owned here and must be
   * written; for a branch's fork month it belongs to the parent run and must
   * not be duplicated into the child (that would violate the "a branch's own
   * rows never cover a month at or before its fork" invariant). Defaults to
   * `true` — the caller opts out only when the start snapshot is a borrowed
   * fork point. `details` never includes the start month, so flow/balance
   * rows are unaffected either way.
   */
  includeFirstSnapshotHeader?: boolean;
}

/**
 * The engine types a flow's `domain`/`viewKey` as plain `string` on purpose —
 * a new domain must not require an engine change. The database is where that
 * openness has to close: the Cube data model slices on exactly these values,
 * so a row carrying an unrecognized key is not a smaller problem than a
 * missing row, it is a *worse* one — it inflates no total and matches no
 * filter while looking perfectly healthy in the table. Checking here converts
 * that silent corruption into an immediate, named failure at the write site.
 * Extending the engine's vocabulary means extending `@control-ai/shared/sim`
 * and the Cube model in the same change, which is the intent.
 */
function narrowFlow(flow: { domain: string; viewKey: string }): Pick<TypedFlowLineItem, "domain" | "viewKey"> {
  if (!isValidFlow(flow.domain, flow.viewKey)) {
    throw new Error(`Unknown flow "${flow.domain}/${flow.viewKey}" — add it to FLOW_VIEW_KEYS_BY_DOMAIN in @control-ai/shared/sim and to the Cube model before persisting it.`);
  }
  return flow as Pick<TypedFlowLineItem, "domain" | "viewKey">;
}

function narrowBalance(balance: { domain: string; metricKey: string }): Pick<TypedBalanceRecord, "domain" | "metricKey"> {
  if (!isValidBalance(balance.domain, balance.metricKey)) {
    throw new Error(
      `Unknown balance "${balance.domain}/${balance.metricKey}" — add it to BALANCE_METRIC_KEYS_BY_DOMAIN in @control-ai/shared/sim and to the Cube model before persisting it.`,
    );
  }
  return balance as Pick<TypedBalanceRecord, "domain" | "metricKey">;
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
export async function appendMonths(db: Database, runId: string, result: RunSimulationResult, options: AppendMonthsOptions = {}): Promise<void> {
  const { snapshots, details } = result;
  if (snapshots.length === 0) return;

  const includeFirstSnapshotHeader = options.includeFirstSnapshotHeader ?? true;
  const headerSnapshots = includeFirstSnapshotHeader ? snapshots : snapshots.slice(1);
  const runMonthRows = headerSnapshots.map((s) => ({
    runId,
    month: s.month,
    netWorthCents: s.netWorthCents,
    taxBasis: s.taxBasis,
  }));
  if (runMonthRows.length > 0) await db.insert(runMonths).values(runMonthRows).onConflictDoNothing();

  const flowRows = details.flatMap((d) =>
    d.flows.map((f) => ({
      runId,
      month: d.month,
      ...narrowFlow(f),
      entityId: f.entityId,
      entityLabel: f.entityLabel,
      amountCents: f.amountCents,
    })),
  );
  if (flowRows.length > 0) await db.insert(flowLineItems).values(flowRows);

  const balanceRows = details.flatMap((d) =>
    d.balances.map((b) => ({
      runId,
      month: d.month,
      ...narrowBalance(b),
      entityId: b.entityId,
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

/**
 * Previously declared here as structural copies with `domain: string`. They
 * are the shared vocabulary-narrowed records now, so a reader of a persisted
 * flow gets the same closed union the Convex and localStorage backends serve.
 */
export type PersistedFlow = TypedFlowLineItem;
export type PersistedBalance = TypedBalanceRecord;

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
