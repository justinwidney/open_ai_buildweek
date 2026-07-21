import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";

/**
 * What a goal measures. All but `debtFree` are "higher is better" (you want
 * to reach or exceed the target); `debtFree` is "lower is better" (you want
 * to be at or under it, usually 0).
 */
export type GoalMetric =
  | "netWorth" // total net worth
  | "liquidNetWorth" // liquid assets (cash + investments) minus unsecured debt — excludes home equity
  | "retirementIncome" // sustainable annual income from investable assets (balance × withdrawal rate)
  | "collegeFund" // combined balance of 529 accounts
  | "homeEquity" // physical-asset value minus its linked debt
  | "debtFree"; // total remaining debt (target usually 0)

export type GoalPriority = "must" | "want" | "nice";

/**
 * A target keyed to an age or month — the "desired result at a certain age"
 * the whole divergence analysis measures against. `real: true` means the
 * target is expressed in month-0 (today's) dollars and is inflated to its due
 * date before comparison, so a "$2M in today's money by 60" goal isn't quietly
 * undershot by inflation.
 */
export interface Goal {
  id: string;
  label: string;
  metric: GoalMetric;
  targetCents: Cents;
  /** Due date as an absolute run-month. Provide this or `byAge`. */
  byMonth?: MonthKey;
  /** Due date as the primary person's age; resolved via `GoalContext.ageYearsAtStart`. */
  byAge?: number;
  /** Target is in today's dollars and should be inflation-adjusted to its due date. Default false (nominal). */
  real?: boolean;
  priority?: GoalPriority;
}

export interface GoalContext {
  /** Primary person's whole-year age at run month 0 — required to resolve a `byAge` goal. */
  ageYearsAtStart?: number;
  /** Inflation rate for `real` targets. Default 0.03. */
  annualInflationRate?: number;
  /** Withdrawal rate for the `retirementIncome` metric. Default 0.04. */
  safeWithdrawalRate?: number;
}
