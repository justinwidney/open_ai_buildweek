/**
 * Public surface of `@control-ai/shared/sim` — the contracts every
 * simulation persistence layer agrees on.
 *
 * The split of responsibility with `@control-ai/engine` is deliberate and
 * one-directional: the **engine** owns the domain model (`LifeStateSnapshot`,
 * `MonthDetail`, `MonthlyStatement`, `Goal`, `Cents`, `MonthKey`) and knows
 * nothing about storage; **this package** owns what it means to *persist* one
 * (lifecycle enums, the fact-table vocabulary, the seed a run replays from,
 * the stored record shapes, the store interface) and imports engine types to
 * do it. Nothing here may be imported by the engine, which stays free of
 * persistence concerns.
 *
 * Consumers: @control-ai/db (Postgres/Drizzle), @control-ai/convex,
 * @control-ai/worker, @control-ai/web, and — by test rather than by import,
 * since it is YAML — @control-ai/cube.
 */

export * from "../life-sim/index.js";

export { JOB_STATUSES, RUN_STATUSES, isJobStatus, isRunStatus, parseJobStatus, parseRunStatus, type JobStatus, type RunStatus } from "./status.js";

export {
  BALANCE_DOMAINS,
  BALANCE_METRIC_KEYS,
  BALANCE_METRIC_KEYS_BY_DOMAIN,
  DEBT_VIEW_KEYS,
  EXPENSE_VIEW_KEYS,
  FLOW_DOMAINS,
  FLOW_VIEW_KEYS_BY_DOMAIN,
  INCOME_VIEW_KEYS,
  isBalanceDomain,
  isFlowDomain,
  isValidBalance,
  isValidFlow,
  type BalanceDomain,
  type BalanceMetricKey,
  type DebtViewKey,
  type ExpenseViewKey,
  type FlowDomain,
  type FlowViewKey,
  type IncomeViewKey,
  type TypedBalanceRecord,
  type TypedFlowLineItem,
} from "./vocabulary.js";

export { buildReturnsStrategy, isReturnsStrategyConfig, type ReturnsStrategyConfig } from "./returns.js";

export { EMPTY_ROOT_SEED_FIELDS, buildInitialSnapshot, isRootSeed, type OpeningBalance, type RootSeed } from "./seed.js";

export type { DecisionId, GoalId, JobId, NetWorthPoint, RunId, StoredDecision, StoredGoal, StoredJob, StoredMonth, StoredRun, Timestamp } from "./records.js";

export {
  monthsFromRunResult,
  type AppendMonthsParams,
  type CreateRunParams,
  type ForkRunParams,
  type ListGoalsFilter,
  type ListRunsFilter,
  type RunStore,
  type RunStoreKind,
  type SetGoalParams,
} from "./store.js";

export { createMemoryStorage, isQuotaExceededError, resolveBrowserStorage, type KeyValueStorage } from "./storage.js";

export { createLocalRunStore, createMemoryRunStore, type LocalRunStore, type LocalRunStoreOptions, type QuotaEvent } from "./local-store.js";
