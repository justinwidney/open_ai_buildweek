import type { Cents } from "../money/index.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import type { Goal, GoalContext } from "../goals/index.js";
import { HIGHER_IS_BETTER, metricValueCents, nominalTargetCents } from "../goals/index.js";

/** A counterfactual outcome: the terminal snapshot of a run with exactly one decision changed from the baseline. */
export interface Counterfactual {
  decisionId: string;
  label: string;
  /** The terminal snapshot produced by re-running the scenario with this one decision flipped. */
  terminal: LifeStateSnapshot;
}

export interface GoalImpact {
  decisionId: string;
  label: string;
  baselineMetricCents: Cents;
  counterfactualMetricCents: Cents;
  /** counterfactual − baseline, in the metric's raw units (net worth cents, annual income cents, …). Signed. */
  impactCents: Cents;
  /** Whether the goal is met under baseline vs this counterfactual — the "did this decision flip on-track?" view. */
  onTrack: { baseline: boolean; counterfactual: boolean };
}

function meets(goal: Goal, terminal: LifeStateSnapshot, context: GoalContext, target: Cents): boolean {
  const value = metricValueCents(goal.metric, terminal, context);
  return HIGHER_IS_BETTER[goal.metric] ? value >= target : value <= target;
}

/**
 * Method B — counterfactual decision attribution. Given the baseline terminal
 * snapshot and a set of counterfactuals (each the terminal of a re-run with
 * one decision changed), ranks decisions by their impact on a goal's metric,
 * largest absolute impact first. Answers "which choice mattered most?" — often
 * not the one with the biggest sticker price.
 *
 * Pure arithmetic over outcomes the caller produced: this module does not run
 * simulations. The caller re-runs each single-decision-flipped branch (via
 * `runSimulation` / `@control-ai/worker`) and passes the terminal snapshots in.
 */
export function rankGoalImpacts(goal: Goal, baselineTerminal: LifeStateSnapshot, counterfactuals: readonly Counterfactual[], context: GoalContext = {}): GoalImpact[] {
  const target = nominalTargetCents(goal, context);
  const baselineMetric = metricValueCents(goal.metric, baselineTerminal, context);
  const baselineOnTrack = meets(goal, baselineTerminal, context, target);

  return counterfactuals
    .map((cf): GoalImpact => {
      const counterfactualMetric = metricValueCents(goal.metric, cf.terminal, context);
      return {
        decisionId: cf.decisionId,
        label: cf.label,
        baselineMetricCents: baselineMetric,
        counterfactualMetricCents: counterfactualMetric,
        impactCents: counterfactualMetric - baselineMetric,
        onTrack: { baseline: baselineOnTrack, counterfactual: meets(goal, cf.terminal, context, target) },
      };
    })
    .sort((a, b) => Math.abs(b.impactCents) - Math.abs(a.impactCents));
}
