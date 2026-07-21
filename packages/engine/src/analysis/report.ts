import type { Goal, GoalContext } from "../goals/index.js";
import { compareTrajectories, goalGapTrajectory, type GoalGapTrajectory, type Path, type TemporalDivergence } from "./trajectory.js";

export interface DivergenceReport {
  goalId: string;
  /** How the two paths separate over time on the goal's own metric (method A). */
  temporal: TemporalDivergence;
  /** Each path's gap-to-goal trajectory and its worst-shortfall age (method C). */
  baselineGoal: GoalGapTrajectory;
  variantGoal: GoalGapTrajectory;
}

/**
 * Ties methods A and C together for a baseline path vs a variant path against
 * one goal: where the two lives diverge most on the goal's metric, and where
 * each falls furthest short of the goal. Add `rankGoalImpacts` (method B)
 * separately to attribute the divergence to specific decisions.
 */
export function divergenceReport(goal: Goal, baselinePath: Path, variantPath: Path, context: GoalContext = {}): DivergenceReport {
  return {
    goalId: goal.id,
    temporal: compareTrajectories(baselinePath, variantPath, { metric: goal.metric, context }),
    baselineGoal: goalGapTrajectory(goal, baselinePath, context),
    variantGoal: goalGapTrajectory(goal, variantPath, context),
  };
}
