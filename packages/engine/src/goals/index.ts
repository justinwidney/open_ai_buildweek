export type { Goal, GoalMetric, GoalPriority, GoalContext } from "./types.js";
export { HIGHER_IS_BETTER, metricValueCents } from "./metrics.js";
export { evaluateGoal, evaluateGoals, resolveTargetMonth, nominalTargetCents, type GoalProgress } from "./evaluate.js";
export { goalOutcomeDistribution, type GoalOutcome } from "./outcome.js";
