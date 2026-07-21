import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import type { Goal, GoalContext, GoalMetric } from "./types.js";
import { HIGHER_IS_BETTER, metricValueCents } from "./metrics.js";

const DEFAULT_INFLATION = 0.03;

/** The absolute run-month a goal is due, from `byMonth` or `byAge` + the start age. */
export function resolveTargetMonth(goal: Goal, context: GoalContext = {}): MonthKey {
  if (goal.byMonth !== undefined) return goal.byMonth;
  if (goal.byAge !== undefined) {
    if (context.ageYearsAtStart === undefined) throw new Error(`Goal "${goal.id}" is keyed byAge but no ageYearsAtStart was given`);
    return (goal.byAge - context.ageYearsAtStart) * 12;
  }
  throw new Error(`Goal "${goal.id}" must specify byMonth or byAge`);
}

/** The goal's target in nominal (as-of-due-date) dollars: the raw target, or the real target inflated to its due month. */
export function nominalTargetCents(goal: Goal, context: GoalContext = {}): Cents {
  if (!goal.real) return goal.targetCents;
  const targetMonth = resolveTargetMonth(goal, context);
  const inflation = context.annualInflationRate ?? DEFAULT_INFLATION;
  return Math.round(goal.targetCents * Math.pow(1 + inflation, targetMonth / 12));
}

export interface GoalProgress {
  goalId: string;
  label: string;
  metric: GoalMetric;
  /** The month this evaluation is for (the snapshot's month). */
  month: MonthKey;
  targetMonth: MonthKey;
  /** True once the evaluation is at or past the due date — `achieved` is then a final verdict, not a pacing check. */
  due: boolean;
  actualCents: Cents;
  nominalTargetCents: Cents;
  achieved: boolean;
  /** Fraction toward the target (higher-is-better metrics); ≥1 means at/ahead of target. Binary for `debtFree`. */
  progress: number;
  /** actual − target in the metric's "good" direction: positive = ahead of goal, negative = behind. */
  surplusCents: Cents;
  /** How far behind (0 when at/ahead). The number the divergence analysis charts as the gap. */
  shortfallCents: Cents;
}

/**
 * Evaluates a goal against a single snapshot: how the metric stands now
 * relative to the (due-date) target. This is a point-in-time read; sweeping it
 * across a run's months yields the goal's "gap trajectory," and the age of
 * maximum shortfall is exactly the "greatest divergence from desired results"
 * the product is after. Pure.
 */
export function evaluateGoal(goal: Goal, snapshot: LifeStateSnapshot, context: GoalContext = {}): GoalProgress {
  const targetMonth = resolveTargetMonth(goal, context);
  const nominalTarget = nominalTargetCents(goal, context);
  const actual = metricValueCents(goal.metric, snapshot, context);
  const higherIsBetter = HIGHER_IS_BETTER[goal.metric];

  const surplusCents = higherIsBetter ? actual - nominalTarget : nominalTarget - actual;
  const achieved = surplusCents >= 0;
  const shortfallCents = Math.max(0, -surplusCents);
  const progress = higherIsBetter ? (nominalTarget !== 0 ? Math.max(0, actual / nominalTarget) : achieved ? 1 : 0) : achieved ? 1 : 0;

  return {
    goalId: goal.id,
    label: goal.label,
    metric: goal.metric,
    month: snapshot.month,
    targetMonth,
    due: snapshot.month >= targetMonth,
    actualCents: actual,
    nominalTargetCents: nominalTarget,
    achieved,
    progress,
    surplusCents,
    shortfallCents,
  };
}

/** Evaluates several goals against one snapshot. */
export function evaluateGoals(goals: readonly Goal[], snapshot: LifeStateSnapshot, context: GoalContext = {}): GoalProgress[] {
  return goals.map((goal) => evaluateGoal(goal, snapshot, context));
}
