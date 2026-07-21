import {
  availableOpportunities,
  lifeGraph2026,
  nextMilestone,
  nextReflection,
  rollYear,
  withFinances,
  type DecisionBranch,
  type DecisionNode,
  type FinancialSummary,
  type LifeContext,
  type LifeStage,
  type MonthlyStatement,
} from "@control-ai/engine";
import type { DecisionRouteKind } from "./decisionMaps";

/**
 * The bridge between the engine's life-graph rule engine and this lab's visual
 * vocabulary (watercolor route maps, emoji, stage chrome). The engine owns the
 * decision logic; everything here is presentation.
 */

export const LIFE_GRAPH = lifeGraph2026;

/** Distill a month's statement into the affordability summary the rule engine gates on. */
export function summarizeStatement(s: MonthlyStatement): FinancialSummary {
  return {
    // Liquid = cash + taxable investments (excludes 401(k)/Roth/HSA, which can't fund a down payment).
    liquidCents: s.balanceSheet.byTaxTreatment.taxable,
    cashCents: s.balanceSheet.cashCents,
    monthlyGrossCents: s.income.grossCents,
    monthlyTakeHomeCents: s.income.takeHomeCents,
    monthlySpendingCents: s.spending.totalCents,
    monthlyDebtPaymentCents: s.spending.debtPaymentCents,
    netWorthCents: s.balanceSheet.netWorthCents,
    emergencyFundMonths: s.planning.emergencyFundMonths,
    savingsRate: s.cashFlow.savingsRate,
  };
}

/** Attach a year's finances to the context so money-gated nodes can be evaluated. */
export function contextWithFinances(ctx: LifeContext, statement: MonthlyStatement | null): LifeContext {
  return statement ? withFinances(ctx, summarizeStatement(statement)) : ctx;
}

/** The milestone (if any) that must be resolved to travel on, and the optional side-quests available now. */
export function decisionsAt(ctx: LifeContext): { milestone: DecisionNode | null; opportunities: readonly DecisionNode[] } {
  return { milestone: nextMilestone(LIFE_GRAPH, ctx), opportunities: availableOpportunities(LIFE_GRAPH, ctx) };
}

/**
 * Evaluate what a single travelled year surfaces, in priority order: a forced
 * milestone wins; otherwise a random "life happens" event may fire; opportunities
 * are always returned for the side panel. `ctx` must already carry this year's
 * finances (see `contextWithFinances`).
 */
export function evaluateYear(ctx: LifeContext, rng: () => number): { forced: DecisionNode | null; opportunities: readonly DecisionNode[] } {
  const milestone = nextMilestone(LIFE_GRAPH, ctx);
  const forced = milestone ?? rollYear(LIFE_GRAPH, ctx, rng) ?? nextReflection(LIFE_GRAPH, ctx);
  return { forced, opportunities: availableOpportunities(LIFE_GRAPH, ctx) };
}

/**
 * A "decline" branch changes nothing — no financial effect and an empty
 * outcome. The lab dismisses these without recording, so declining an optional
 * opportunity (buy a home, get a certification) leaves it open to revisit in a
 * later year rather than permanently resolving it.
 */
export function isInertBranch(branch: DecisionBranch): boolean {
  const o = branch.outcome;
  const emptyOutcome = o.setStage === undefined && o.mergeFlags === undefined && o.updateProfile === undefined && !o.block?.length && !o.reopen?.length;
  return !branch.effect && branch.resolution === undefined && emptyOutcome;
}

/** Pick a route-tile grammar for a node from its shape — more branches read as a busier junction. */
export function routeKindForNode(node: DecisionNode): DecisionRouteKind {
  const realBranches = node.branches.filter((b) => !isInertBranch(b)).length;
  if (realBranches <= 1) return "straight";
  if (realBranches === 2) return "fork-right";
  if (realBranches === 3) return "fork-both";
  return "network";
}

const CATEGORY_EMOJI: Record<DecisionNode["category"], string> = {
  education: "🎓",
  career: "💼",
  family: "💍",
  housing: "🏠",
  financial: "📈",
  lifestyle: "🧭",
  military: "🎖️",
  health: "♥",
  community: "🤝",
};

export function nodeEmoji(node: DecisionNode): string {
  return CATEGORY_EMOJI[node.category] ?? "✦";
}

const STAGE_META: Record<string, { label: string; emoji: string }> = {
  "pre-launch": { label: "Fresh out of high school", emoji: "🎒" },
  school: { label: "In school", emoji: "🎓" },
  working: { label: "Working", emoji: "💼" },
  apprenticeship: { label: "Apprenticing", emoji: "🔧" },
  "gap-year": { label: "On a gap year", emoji: "🌍" },
  military: { label: "In the service", emoji: "🎖️" },
};

export function stageMeta(stage: LifeStage): { label: string; emoji: string } {
  return STAGE_META[stage] ?? { label: String(stage), emoji: "✦" };
}
