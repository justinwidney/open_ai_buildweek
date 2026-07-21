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
  normalizeLifeContext,
} from "./context.js";

export type { LifeProfileState, EducationProfile, WorkProfile, HouseholdProfile, PlaceProfile, WeeklyTimeBudget, WellbeingProfile, LifeGoal, HousingTenure } from "./life-profile.js";
export { LIFE_PROFILE_SCHEMA_VERSION, initialLifeProfile, normalizeLifeProfile } from "./life-profile.js";

export type { LifeGraph, DecisionNode, DecisionBranch, BranchOutcome, DecisionResolution, DecisionTradeoffs, DecisionEditorKind, DecisionTrigger, LifeDecisionCategory, RandomChance } from "./graph.js";
export { availableDecisions, nextMilestone, nextReflection, availableOpportunities, findNode, findBranch, branchEligibility, resolveBranch } from "./graph.js";
export { rollYear, randomEvents } from "./random.js";
export { recommendedBudget, type RecommendedBudget, type BudgetCategory, type BudgetCategoryKey } from "./budgets.js";
export type { AnnualLifePlanInputs } from "./annual-life-plan.js";
export { ANNUAL_LIFE_PLAN_SCHEMA_VERSION, annualLifePlanMonthlyCost, annualLifePlanTimeBudget, validateAnnualLifePlan, createAnnualLifePlanBranch, parseAnnualLifePlanInputs } from "./annual-life-plan.js";

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
export { STORY_REFLECTION_NODES } from "./story-decisions.js";
