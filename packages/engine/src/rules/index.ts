/**
 * rules/ — the life-graph rule engine (Layer 5 navigation).
 *
 * The financial kernel forks and ticks; `events/` interprets a chosen option
 * into a diverged snapshot. This module decides *which crossroads are reachable
 * when* — the stateful decision-tree navigation the events README named as the
 * one unbuilt piece. A `LifeContext` (stage + flags + timers) is walked against
 * a `LifeGraph` of `DecisionNode`s whose `available` preconditions gate them and
 * whose branches transition the context. Pure and serializable end to end.
 */
export type { LifeContext, Eligibility, LifeStage, InitialLifeContextParams, FinancialSummary } from "./context.js";
export {
  KNOWN_LIFE_STAGES,
  eligible,
  ineligible,
  gate,
  allOf,
  moneyGate,
  withFinances,
  monthsInStage,
  yearsInStage,
  flag,
  hasFlag,
  numberFlag,
  initialLifeContext,
  advanceLifeContext,
} from "./context.js";

export type { LifeGraph, DecisionNode, DecisionBranch, BranchOutcome, DecisionTrigger, LifeDecisionCategory, RandomChance } from "./graph.js";
export { availableDecisions, nextMilestone, availableOpportunities, findNode, findBranch, branchEligibility, resolveBranch } from "./graph.js";
export { rollYear, randomEvents } from "./random.js";
export { recommendedBudget, type RecommendedBudget, type BudgetCategory, type BudgetCategoryKey } from "./budgets.js";

export {
  PRIMARY_JOB_ID,
  LIVING_EXPENSE_ID,
  TUITION_EXPENSE_ID,
  setPrimaryJob,
  clearPrimaryJob,
  setTuition,
  dropTuition,
  setLivingCost,
  spendCash,
  gainCash,
  scalePrimaryJob,
  scaleLiving,
  buildEffect,
} from "./effects.js";
export type { JobParams, EffectParams } from "./effects.js";

export { lifeGraph2026 } from "./catalog.js";
