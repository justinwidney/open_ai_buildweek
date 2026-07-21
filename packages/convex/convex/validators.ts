import { v, type Infer } from "convex/values";
import type { BalanceDomain, BalanceMetricKey, FlowDomain, FlowViewKey, JobStatus, ReturnsStrategyConfig, RunStatus } from "@control-ai/shared/sim";
import type { GoalMetric, GoalPriority } from "@control-ai/engine";

/**
 * Convex validators for the closed sets defined in `@control-ai/shared/sim`
 * and `@control-ai/engine`.
 *
 * Convex validators are runtime values and cannot be generated from a TS
 * union, so each one is spelled out — and then pinned to its source type by
 * the `assertSameUnion` checks below. Adding a status or a view key in the
 * shared package without adding it here is a compile error, which is the
 * whole point: this file is the only place the two representations can drift,
 * so it is the only place that has to be guarded.
 *
 * ## Why some fields stay `v.any()`
 *
 * `statement`, `snapshot` and `rootSeed` are large structures owned by
 * @control-ai/engine (a `MonthlyStatement` alone has ~60 nested fields).
 * Restating them as Convex validators would fork the engine's definition into
 * a second, hand-maintained copy that silently rots — precisely the drift
 * this package is being cleaned up to remove. They are stored as `v.any()`
 * and typed at the boundary instead, via the `Stored*` types in
 * `@control-ai/shared/sim`. The small, closed, slow-changing sets below are
 * the ones worth validating, because those are the ones a client can
 * plausibly get wrong.
 */

/** Compile-time proof that a validator's inferred type is exactly the shared union — neither wider nor narrower. */
type AssertSameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : { error: "validator and shared type have drifted"; validator: A; shared: B }) : { error: "validator and shared type have drifted"; validator: A; shared: B };

export const runStatusValidator = v.union(v.literal("draft"), v.literal("running"), v.literal("done"), v.literal("error"));
const _runStatusMatches: AssertSameUnion<Infer<typeof runStatusValidator>, RunStatus> = true;

export const jobStatusValidator = v.union(v.literal("queued"), v.literal("running"), v.literal("done"), v.literal("error"));
const _jobStatusMatches: AssertSameUnion<Infer<typeof jobStatusValidator>, JobStatus> = true;

export const goalMetricValidator = v.union(
  v.literal("netWorth"),
  v.literal("liquidNetWorth"),
  v.literal("retirementIncome"),
  v.literal("collegeFund"),
  v.literal("homeEquity"),
  v.literal("debtFree"),
);
const _goalMetricMatches: AssertSameUnion<Infer<typeof goalMetricValidator>, GoalMetric> = true;

export const goalPriorityValidator = v.union(v.literal("must"), v.literal("want"), v.literal("nice"));
const _goalPriorityMatches: AssertSameUnion<Infer<typeof goalPriorityValidator>, GoalPriority> = true;

export const flowDomainValidator = v.union(v.literal("income"), v.literal("expense"), v.literal("debt"));
const _flowDomainMatches: AssertSameUnion<Infer<typeof flowDomainValidator>, FlowDomain> = true;

export const flowViewKeyValidator = v.union(
  v.literal("gross"),
  v.literal("afterPayrollDeductions"),
  v.literal("afterTax"),
  v.literal("taxFree"),
  v.literal("socialSecurityWage"),
  v.literal("takeHome"),
  v.literal("federalTax"),
  v.literal("stateTax"),
  v.literal("fica"),
  v.literal("total"),
  v.literal("outOfPocket"),
  v.literal("totalPayment"),
  v.literal("principalPortion"),
  v.literal("interestPortion"),
  v.literal("escrowPortion"),
);
const _flowViewKeyMatches: AssertSameUnion<Infer<typeof flowViewKeyValidator>, FlowViewKey> = true;

export const balanceDomainValidator = v.union(v.literal("debt"), v.literal("financialAsset"), v.literal("portfolio"), v.literal("physicalAsset"));
const _balanceDomainMatches: AssertSameUnion<Infer<typeof balanceDomainValidator>, BalanceDomain> = true;

export const balanceMetricKeyValidator = v.union(v.literal("remainingBalance"), v.literal("balance"), v.literal("costBasis"), v.literal("value"));
const _balanceMetricKeyMatches: AssertSameUnion<Infer<typeof balanceMetricKeyValidator>, BalanceMetricKey> = true;

/** The serializable returns strategy. Small and closed enough to validate properly, and it must round-trip exactly for a run to replay. */
export const returnsStrategyValidator = v.union(
  v.object({ kind: v.literal("fixed"), annualRatesByAssetClass: v.record(v.string(), v.number()) }),
  v.object({
    kind: v.literal("monte-carlo"),
    distributionsByAssetClass: v.record(v.string(), v.object({ annualMeanReturn: v.number(), annualVolatility: v.number() })),
  }),
  v.object({ kind: v.literal("historical-backtest"), assetClassIds: v.array(v.string()), startYear: v.optional(v.number()) }),
);
/** One-directional: the validator must produce a valid config. (The reverse fails only on `readonly` variance, not a real difference.) */
const _returnsStrategyAssignable: Infer<typeof returnsStrategyValidator> extends ReturnsStrategyConfig ? true : never = true;

/** One monthly flow line item, matching @control-ai/db's `flow_line_items` grain exactly. */
export const flowValidator = v.object({
  domain: flowDomainValidator,
  entityId: v.string(),
  entityLabel: v.string(),
  viewKey: flowViewKeyValidator,
  amountCents: v.number(),
});

/** One point-in-time balance, matching @control-ai/db's `balance_snapshots` grain exactly. */
export const balanceValidator = v.object({
  domain: balanceDomainValidator,
  entityId: v.string(),
  metricKey: balanceMetricKeyValidator,
  amountCents: v.number(),
});

export const decisionValidator = v.object({
  /** The engine's `Decision.id`, distinct from Convex's own `_id`. Without it a stored decision cannot be read back into a `LifeStateSnapshot`. */
  id: v.string(),
  month: v.number(),
  domain: v.string(),
  optionId: v.string(),
  label: v.string(),
  effectiveFromMonth: v.number(),
});

// Referenced so the assertions above are not elided as unused bindings.
void [
  _runStatusMatches,
  _jobStatusMatches,
  _goalMetricMatches,
  _goalPriorityMatches,
  _flowDomainMatches,
  _flowViewKeyMatches,
  _balanceDomainMatches,
  _balanceMetricKeyMatches,
  _returnsStrategyAssignable,
];
