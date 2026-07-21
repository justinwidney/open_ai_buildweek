import type { Cents } from "../money/index.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { percentileOfSorted } from "../forecast/percentile.js";
import type { Goal, GoalContext, GoalMetric } from "./types.js";
import { HIGHER_IS_BETTER, metricValueCents } from "./metrics.js";
import { nominalTargetCents } from "./evaluate.js";

const DEFAULT_PERCENTILES = [10, 50, 90] as const;

export interface GoalOutcome {
  goalId: string;
  metric: GoalMetric;
  paths: number;
  /** Fraction of paths whose terminal metric meets the goal — the generalization of the forecast's net-worth `successProbability` to any goal. */
  onTrackProbability: number;
  nominalTargetCents: Cents;
  /** Distribution of the goal's metric across paths at the terminus. */
  metricPercentileCents: Record<number, Cents>;
}

/**
 * Evaluates a goal across the terminal snapshots of a Monte Carlo forecast:
 * the probability the goal is met, plus the spread of its metric. Pair with
 * `runMonteCarloForecast(...).terminalSnapshots`. This is what turns "here's a
 * fan of net-worth outcomes" into "here's the chance you actually hit *this
 * specific goal*," for any metric — retirement income, college fund, debt-free.
 */
export function goalOutcomeDistribution(
  goal: Goal,
  terminalSnapshots: readonly LifeStateSnapshot[],
  context: GoalContext = {},
  percentiles: readonly number[] = DEFAULT_PERCENTILES,
): GoalOutcome {
  if (terminalSnapshots.length === 0) throw new Error("goalOutcomeDistribution requires at least one terminal snapshot");

  const target = nominalTargetCents(goal, context);
  const higherIsBetter = HIGHER_IS_BETTER[goal.metric];
  const values = terminalSnapshots.map((s) => metricValueCents(goal.metric, s, context));
  const met = values.filter((v) => (higherIsBetter ? v >= target : v <= target)).length;

  const sorted = [...values].sort((a, b) => a - b);
  const metricPercentileCents: Record<number, Cents> = {};
  for (const p of percentiles) metricPercentileCents[p] = Math.round(percentileOfSorted(sorted, p));

  return {
    goalId: goal.id,
    metric: goal.metric,
    paths: values.length,
    onTrackProbability: met / values.length,
    nominalTargetCents: target,
    metricPercentileCents,
  };
}
