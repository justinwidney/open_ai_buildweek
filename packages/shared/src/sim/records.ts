import type { Cents, Decision, GoalMetric, GoalPriority, LifeStateSnapshot, MonthKey, MonthlyStatement, TaxBasisState } from "@control-ai/engine";
import type { ReturnsStrategyConfig } from "./returns.js";
import type { RootSeed } from "./seed.js";
import type { JobStatus, RunStatus } from "./status.js";
import type { TypedBalanceRecord, TypedFlowLineItem } from "./vocabulary.js";

/**
 * The logical shape of each persisted entity, defined once so every backend
 * stores the same fields under the same names.
 *
 * The vocabulary is **run**, matching @control-ai/engine (`LifeStateSnapshot.runId`,
 * `RunRef`), @control-ai/db (`runs`), @control-ai/worker and the Cube model.
 * Convex previously called the same entity a "scenario" with `name` /
 * `parentScenarioId`; that was the only dissenting spelling and has been
 * renamed to match rather than translated at every boundary.
 *
 * These are plain ids, not branded types: Convex already brands its own
 * document ids (`Id<"runs">`), and a competing brand here would force casts
 * at exactly the boundary these types exist to smooth over.
 */
export type RunId = string;
export type DecisionId = string;
export type GoalId = string;
export type JobId = string;

/** Epoch milliseconds. Postgres stores these as `timestamptz`; Convex and localStorage store the number. */
export type Timestamp = number;

/** One simulated life, or a branch of one. A branch carries both `parentRunId` and `forkMonth`; a root run has neither. */
export interface StoredRun {
  id: RunId;
  label: string;
  parentRunId: RunId | null;
  /** The month a branch diverged from its parent. Null on a root run. */
  forkMonth: MonthKey | null;
  /** The decision label that created this branch, for the pathway UI's fork markers. Null on a root run. */
  forkDecisionLabel: string | null;
  status: RunStatus;
  rootSeed: RootSeed;
  returnsStrategy: ReturnsStrategyConfig;
  /** Denormalized from `rootSeed.ageYearsAtStart` so a run list can show age without parsing every seed. */
  ageYearsAtStart: number | null;
  /** Future per-user scoping. Null until auth exists. */
  ownerId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * One computed month.
 *
 * The two backends genuinely differ in what they can hold, and this type is
 * explicit about it rather than pretending otherwise: Postgres decomposes a
 * month into long/tidy `flow_line_items` + `balance_snapshots` rows (which is
 * what makes the Cube model possible) and stores no snapshot or statement,
 * while Convex and localStorage store the whole month as one document. The
 * fields a given backend cannot produce are optional and documented per
 * field — a reader that needs one checks for it, or rebuilds the month from
 * the run's seed.
 */
export interface StoredMonth {
  runId: RunId;
  month: MonthKey;
  netWorthCents: Cents;
  taxBasis: TaxBasisState;
  flows: readonly TypedFlowLineItem[];
  balances: readonly TypedBalanceRecord[];
  /** The UI-ready read model. Document stores keep it; the relational store rebuilds it via `buildMonthlyStatement`. */
  statement?: MonthlyStatement;
  /** The full engine state — required to fork or extend from this month. Document stores keep it; the relational store cannot. */
  snapshot?: LifeStateSnapshot;
}

/** The compact projection a timeline chart needs — one point per month, cheap to read in bulk. */
export interface NetWorthPoint {
  month: MonthKey;
  netWorthCents: Cents;
}

/**
 * A decision as persisted. Carries the engine `Decision.id`, which Convex's
 * schema previously omitted — without it a stored decision could not be read
 * back into a `LifeStateSnapshot.decisions` array, breaking round-tripping.
 */
export interface StoredDecision extends Decision {
  runId: RunId;
  /** The month the decision was *recorded* at, which may precede `effectiveFromMonth` for a planned future change. */
  month: MonthKey;
}

/** A goal target. `metric` is the engine's closed `GoalMetric` union, not the bare string Convex previously stored. */
export interface StoredGoal {
  id: GoalId;
  /** Null when the goal applies across every run rather than to one path. */
  runId: RunId | null;
  ownerId: string | null;
  label: string;
  metric: GoalMetric;
  targetCents: Cents;
  byMonth?: MonthKey;
  byAge?: number;
  real?: boolean;
  priority?: GoalPriority;
}

/** A background extension/branch job. */
export interface StoredJob {
  id: JobId;
  runId: RunId;
  fromMonth: MonthKey;
  toMonth: MonthKey;
  status: JobStatus;
  errorMessage: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
