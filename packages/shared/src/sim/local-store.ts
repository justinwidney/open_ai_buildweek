import type { MonthKey, TaxBasisState } from "@control-ai/engine";
import type { NetWorthPoint, RunId, StoredDecision, StoredGoal, StoredMonth, StoredRun } from "./records.js";
import type { AppendMonthsParams, CreateRunParams, ForkRunParams, ListGoalsFilter, ListRunsFilter, RunStore, SetGoalParams } from "./store.js";
import type { RunStatus } from "./status.js";
import { createMemoryStorage, isQuotaExceededError, resolveBrowserStorage, type KeyValueStorage } from "./storage.js";

/**
 * A `RunStore` on top of Web Storage, so the app works with no Convex
 * deployment, no network, and no sign-in — the user can make as many changes
 * as they like offline and sync later.
 *
 * The design problem is that localStorage holds roughly 5 MB per origin while
 * one 480-month run carrying a full `LifeStateSnapshot` and `MonthlyStatement`
 * per month serializes to about 2.5 MB. Storing every month verbatim would
 * fit one run and fail on the second, mid-write, with a `QuotaExceededError`.
 * Three properties follow from that:
 *
 * 1. **Light and heavy data are split.** Each run keeps one small index of
 *    `{ month, netWorthCents, taxBasis }` — everything the timeline chart and
 *    a resume need — and each month's bulky snapshot/statement/flows lives
 *    under its own key. Eviction only ever touches heavy keys, so the chart
 *    and the run list survive a full disk intact.
 * 2. **Heavy detail is sampled, not stored wholesale** (`persistDetail:
 *    "keyframes"`, every 12th month plus the newest). The engine is
 *    deterministic and a 480-month run takes milliseconds, so a seed plus a
 *    nearby keyframe reconstructs any month far more cheaply than storing it.
 * 3. **Quota is a normal condition, not an exception.** A write that trips it
 *    evicts the oldest heavy months and retries; if it still fails the light
 *    index is already committed, and the store reports the degradation
 *    through `onQuotaExceeded` rather than throwing into a save handler.
 */
export interface LocalRunStoreOptions {
  /** Key prefix, so two apps on one origin don't collide. Includes a version segment for future migrations. */
  namespace?: string;
  /** Injectable for tests and for Node. Defaults to `localStorage` when writable, else an in-memory fallback. */
  storage?: KeyValueStorage;
  /**
   * How much per-month detail to persist.
   * - `keyframes` (default): every `keyframeInterval`th month plus the newest — bounded growth, any month rebuildable from a nearby anchor.
   * - `all`: every month. Only safe for short horizons.
   * - `none`: index only. Smallest; months are always rebuilt from the seed.
   */
  persistDetail?: "all" | "keyframes" | "none";
  /** Months between persisted keyframes. Default 12 (one per simulated year). */
  keyframeInterval?: number;
  /** Called when heavy data had to be dropped, so the UI can say "older detail was trimmed to free space". */
  onQuotaExceeded?: (info: QuotaEvent) => void;
  /** Injectable clock and id source, so tests are deterministic. */
  now?: () => number;
  generateId?: () => string;
}

export interface QuotaEvent {
  runId: RunId;
  /** Heavy month keys discarded to make room. */
  evictedMonths: readonly MonthKey[];
  /** True when even after eviction the write could not complete — the month's light index is stored, its detail is not. */
  stillFailing: boolean;
}

/** What the run's index holds per month: enough to draw the timeline and resume, without any bulk. */
interface LightMonth {
  month: MonthKey;
  netWorthCents: number;
  taxBasis: TaxBasisState;
  /** True when a heavy record was written for this month, so a read knows whether to bother. */
  heavy: boolean;
}

type HeavyMonth = Pick<StoredMonth, "flows" | "balances" | "statement" | "snapshot">;

const DEFAULT_NAMESPACE = "control-ai/sim/v1";
const DEFAULT_KEYFRAME_INTERVAL = 12;

export interface LocalRunStore extends RunStore {
  readonly kind: "local" | "memory";
  /** Approximate bytes held, for a "storage used" indicator. Counts key and value lengths, not the browser's real per-entry overhead. */
  approximateBytesUsed(): number;
  /** The nearest month at or before `month` whose full snapshot is stored — where a caller restarts the engine to rebuild `month`. */
  nearestAnchorBefore(runId: RunId, month: MonthKey): Promise<StoredMonth | undefined>;
  /** Drops everything under this store's namespace. Leaves other namespaces alone. */
  clear(): Promise<void>;
}

export function createLocalRunStore(options: LocalRunStoreOptions = {}): LocalRunStore {
  const storage = options.storage ?? resolveBrowserStorage();
  const ns = options.namespace ?? DEFAULT_NAMESPACE;
  const persistDetail = options.persistDetail ?? "keyframes";
  const keyframeInterval = Math.max(1, options.keyframeInterval ?? DEFAULT_KEYFRAME_INTERVAL);
  const now = options.now ?? (() => Date.now());
  const generateId = options.generateId ?? defaultIdGenerator;
  // "local" only when genuinely backed by durable localStorage — a private-mode
  // fallback or an injected fake reports "memory", so a UI can tell the user
  // their work is not actually being saved.
  const kind: "local" | "memory" = storage === (globalThis as { localStorage?: unknown }).localStorage ? "local" : "memory";

  // --- key layout ---
  const runsKey = `${ns}:runs`;
  const goalsKey = `${ns}:goals`;
  const indexKey = (runId: RunId) => `${ns}:run:${runId}:index`;
  const decisionsKey = (runId: RunId) => `${ns}:run:${runId}:decisions`;
  const monthKey = (runId: RunId, month: MonthKey) => `${ns}:run:${runId}:m:${month}`;
  const runPrefix = (runId: RunId) => `${ns}:run:${runId}:`;

  function readJson<T>(key: string, fallback: T): T {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // A corrupt entry (a half-written value, a manual edit) must not brick the
      // whole app — treat it as absent and let it be overwritten on next write.
      return fallback;
    }
  }

  /** Writes a value that must not be lost. Quota here is genuinely fatal for the operation, so it propagates. */
  function writeJson(key: string, value: unknown): void {
    storage.setItem(key, JSON.stringify(value));
  }

  function readRuns(): Record<RunId, StoredRun> {
    return readJson<Record<RunId, StoredRun>>(runsKey, {});
  }

  function readIndex(runId: RunId): LightMonth[] {
    return readJson<LightMonth[]>(indexKey(runId), []);
  }

  /** Every key under this namespace, collected up front — removing entries while walking `storage.key(i)` would skip siblings. */
  function keysMatching(prefix: string): string[] {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null && key.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }

  function shouldPersistHeavy(month: MonthKey, isNewest: boolean): boolean {
    if (persistDetail === "none") return false;
    if (persistDetail === "all") return true;
    return isNewest || month % keyframeInterval === 0;
  }

  /**
   * Writes one month's bulk record, making room if the store is full.
   * Eviction walks the run's own heavy months oldest-first and spares the
   * newest, since that is the month an extension resumes from.
   */
  function writeHeavy(runId: RunId, month: MonthKey, heavy: HeavyMonth, index: LightMonth[]): boolean {
    const attempt = (): boolean => {
      try {
        storage.setItem(monthKey(runId, month), JSON.stringify(heavy));
        return true;
      } catch (error) {
        if (!isQuotaExceededError(error)) throw error;
        return false;
      }
    };

    if (attempt()) return true;

    const newest = index.length > 0 ? Math.max(...index.map((m) => m.month)) : month;
    const evictable = index
      .filter((m) => m.heavy && m.month !== month && m.month !== newest)
      .map((m) => m.month)
      .sort((a, b) => a - b);

    const evicted: MonthKey[] = [];
    for (const victim of evictable) {
      storage.removeItem(monthKey(runId, victim));
      const entry = index.find((m) => m.month === victim);
      if (entry) entry.heavy = false;
      evicted.push(victim);
      if (attempt()) {
        options.onQuotaExceeded?.({ runId, evictedMonths: evicted, stillFailing: false });
        return true;
      }
    }

    options.onQuotaExceeded?.({ runId, evictedMonths: evicted, stillFailing: true });
    return false;
  }

  /** Upserts decisions by their engine id, so re-appending a chunk that carries the same decisions updates rather than duplicates them. */
  function writeDecisions(runId: RunId, decisions: AppendMonthsParams["decisions"]): void {
    if (!decisions || decisions.length === 0) return;
    const existing = readJson<StoredDecision[]>(decisionsKey(runId), []);
    const byId = new Map(existing.map((d) => [d.id, d]));
    for (const decision of decisions) byId.set(decision.id, { ...decision, runId });
    writeJson(
      decisionsKey(runId),
      [...byId.values()].sort((a, b) => a.effectiveFromMonth - b.effectiveFromMonth),
    );
  }

  function touchRun(runId: RunId, patch: Partial<StoredRun>): void {
    const runs = readRuns();
    const existing = runs[runId];
    if (!existing) return;
    runs[runId] = { ...existing, ...patch, updatedAt: now() };
    writeJson(runsKey, runs);
  }

  const store: LocalRunStore = {
    kind,

    // --- Runs ---
    async createRun(params: CreateRunParams): Promise<RunId> {
      const runs = readRuns();
      const id = params.id ?? generateId();
      const timestamp = now();
      runs[id] = {
        id,
        label: params.label,
        parentRunId: null,
        forkMonth: null,
        forkDecisionLabel: null,
        status: "draft",
        rootSeed: params.rootSeed,
        returnsStrategy: params.returnsStrategy,
        ageYearsAtStart: params.rootSeed.ageYearsAtStart ?? null,
        ownerId: params.ownerId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      writeJson(runsKey, runs);
      return id;
    },

    async forkRun(params: ForkRunParams): Promise<RunId> {
      const runs = readRuns();
      const parent = runs[params.parentRunId];
      if (!parent) throw new Error(`Cannot fork: run "${params.parentRunId}" not found`);
      const id = params.id ?? generateId();
      const timestamp = now();
      runs[id] = {
        id,
        label: params.label,
        parentRunId: params.parentRunId,
        forkMonth: params.forkMonth,
        forkDecisionLabel: params.forkDecisionLabel ?? null,
        status: "draft",
        // A branch inherits its parent's seed and strategy verbatim; what makes it
        // different is the decision applied at the fork month, not a new seed.
        rootSeed: parent.rootSeed,
        returnsStrategy: parent.returnsStrategy,
        ageYearsAtStart: parent.ageYearsAtStart,
        ownerId: parent.ownerId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      writeJson(runsKey, runs);
      return id;
    },

    async getRun(runId: RunId): Promise<StoredRun | undefined> {
      return readRuns()[runId];
    },

    async listRuns(filter: ListRunsFilter = {}): Promise<StoredRun[]> {
      return Object.values(readRuns())
        .filter((run) => (filter.ownerId === undefined || run.ownerId === filter.ownerId) && (filter.parentRunId === undefined || run.parentRunId === filter.parentRunId))
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async updateRunStatus(runId: RunId, status: RunStatus, updatedAt?: number): Promise<void> {
      const runs = readRuns();
      const existing = runs[runId];
      if (!existing) return;
      runs[runId] = { ...existing, status, updatedAt: updatedAt ?? now() };
      writeJson(runsKey, runs);
    },

    async deleteRun(runId: RunId): Promise<void> {
      const runs = readRuns();
      delete runs[runId];
      writeJson(runsKey, runs);
      // Sweep by prefix rather than by the index's month list: if the index was
      // lost or truncated by an eviction, precise deletion would leak month keys.
      for (const key of keysMatching(runPrefix(runId))) storage.removeItem(key);

      const goals = readJson<Record<string, StoredGoal>>(goalsKey, {});
      for (const [goalId, goal] of Object.entries(goals)) {
        if (goal.runId === runId) delete goals[goalId];
      }
      writeJson(goalsKey, goals);
    },

    // --- Months ---
    async appendMonths(params: AppendMonthsParams): Promise<void> {
      const { runId, months } = params;
      // Decisions are written whether or not any months came with them: a
      // caller recording a fork it has not recomputed yet passes `months: []`,
      // and dropping the decision there would lose the only record of the
      // choice — the thing a replay-from-seed restore depends on.
      writeDecisions(runId, params.decisions);
      if (months.length === 0) {
        if (params.status) await store.updateRunStatus(runId, params.status);
        else touchRun(runId, {});
        return;
      }

      const index = readIndex(runId);
      const positionByMonth = new Map(index.map((entry, i) => [entry.month, i]));
      const newestIncoming = Math.max(...months.map((m) => m.month));

      // The light index is written before any heavy record so that a quota
      // failure mid-batch leaves the timeline complete and only detail missing.
      const heavyWrites: { month: MonthKey; heavy: HeavyMonth }[] = [];
      for (const month of months) {
        const wantsHeavy = shouldPersistHeavy(month.month, month.month === newestIncoming);
        const entry: LightMonth = { month: month.month, netWorthCents: month.netWorthCents, taxBasis: month.taxBasis, heavy: wantsHeavy };
        const at = positionByMonth.get(month.month);
        if (at === undefined) {
          positionByMonth.set(month.month, index.length);
          index.push(entry);
        } else {
          index[at] = entry;
        }
        if (wantsHeavy) {
          heavyWrites.push({ month: month.month, heavy: { flows: month.flows, balances: month.balances, statement: month.statement, snapshot: month.snapshot } });
        } else {
          // A month downgraded to light-only (a re-fork changing which months are
          // keyframes) must not leave its stale heavy record behind.
          storage.removeItem(monthKey(runId, month.month));
        }
      }
      index.sort((a, b) => a.month - b.month);
      writeJson(indexKey(runId), index);

      for (const write of heavyWrites) {
        const stored = writeHeavy(runId, write.month, write.heavy, index);
        if (!stored) {
          const entry = index.find((m) => m.month === write.month);
          if (entry) entry.heavy = false;
        }
      }
      // Re-persist the index: eviction and failed writes both flip `heavy` flags,
      // and a stale `true` would make reads look for a key that isn't there.
      writeJson(indexKey(runId), index);

      touchRun(runId, params.status ? { status: params.status } : {});
    },

    async getMonth(runId: RunId, month: MonthKey): Promise<StoredMonth | undefined> {
      const entry = readIndex(runId).find((m) => m.month === month);
      if (!entry) return undefined;
      const heavy = entry.heavy ? readJson<HeavyMonth | null>(monthKey(runId, month), null) : null;
      return {
        runId,
        month: entry.month,
        netWorthCents: entry.netWorthCents,
        taxBasis: entry.taxBasis,
        flows: heavy?.flows ?? [],
        balances: heavy?.balances ?? [],
        statement: heavy?.statement,
        snapshot: heavy?.snapshot,
      };
    },

    async getNetWorthSeries(runId: RunId): Promise<NetWorthPoint[]> {
      return readIndex(runId).map((m) => ({ month: m.month, netWorthCents: m.netWorthCents }));
    },

    async getLatestMonth(runId: RunId): Promise<StoredMonth | undefined> {
      const index = readIndex(runId);
      const last = index[index.length - 1];
      return last ? store.getMonth(runId, last.month) : undefined;
    },

    async nearestAnchorBefore(runId: RunId, month: MonthKey): Promise<StoredMonth | undefined> {
      const candidates = readIndex(runId).filter((m) => m.heavy && m.month <= month);
      const anchor = candidates[candidates.length - 1];
      if (!anchor) return undefined;
      const stored = await store.getMonth(runId, anchor.month);
      return stored?.snapshot ? stored : undefined;
    },

    // --- Decisions ---
    async listDecisions(runId: RunId): Promise<StoredDecision[]> {
      return readJson<StoredDecision[]>(decisionsKey(runId), []);
    },

    // --- Goals ---
    async setGoal(goal: SetGoalParams): Promise<string> {
      const goals = readJson<Record<string, StoredGoal>>(goalsKey, {});
      const id = goal.id ?? generateId();
      goals[id] = {
        id,
        runId: goal.runId ?? null,
        ownerId: goal.ownerId ?? null,
        label: goal.label,
        metric: goal.metric,
        targetCents: goal.targetCents,
        byMonth: goal.byMonth,
        byAge: goal.byAge,
        real: goal.real,
        priority: goal.priority,
      };
      writeJson(goalsKey, goals);
      return id;
    },

    async listGoals(filter: ListGoalsFilter = {}): Promise<StoredGoal[]> {
      return Object.values(readJson<Record<string, StoredGoal>>(goalsKey, {})).filter(
        (goal) => (filter.runId === undefined || goal.runId === filter.runId) && (filter.ownerId === undefined || goal.ownerId === filter.ownerId),
      );
    },

    async removeGoal(goalId: string): Promise<void> {
      const goals = readJson<Record<string, StoredGoal>>(goalsKey, {});
      delete goals[goalId];
      writeJson(goalsKey, goals);
    },

    // --- Maintenance ---
    approximateBytesUsed(): number {
      let total = 0;
      for (const key of keysMatching(`${ns}:`)) total += key.length + (storage.getItem(key)?.length ?? 0);
      return total * 2; // UTF-16 code units, the unit browsers charge quota in.
    },

    async clear(): Promise<void> {
      for (const key of keysMatching(`${ns}:`)) storage.removeItem(key);
    },
  };

  return store;
}

function defaultIdGenerator(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * An in-memory store with identical semantics — for tests, SSR, and "try it
 * without saving anything". Defaults to `persistDetail: "all"` since there is
 * no 5 MB ceiling to sample around; it reports `kind: "memory"` automatically,
 * because its storage is not the browser's.
 */
export function createMemoryRunStore(options: Omit<LocalRunStoreOptions, "storage"> = {}): LocalRunStore {
  return createLocalRunStore({ ...options, storage: createMemoryStorage(), persistDetail: options.persistDetail ?? "all" });
}
