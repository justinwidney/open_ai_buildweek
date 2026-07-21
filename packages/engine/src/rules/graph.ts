import type { DecisionImportanceLevel } from "../contracts/decisions.js";
import type { JsonValue, StableId, VersionId } from "../contracts/values.js";
import type { EventEffect } from "../events/apply.js";
import { eligible, type Eligibility, type LifeContext, type LifeStage } from "./context.js";
import type { LifeProfileState } from "./life-profile.js";

export type LifeDecisionCategory = "education" | "career" | "family" | "housing" | "financial" | "lifestyle" | "military" | "health" | "community";

/**
 * How a decision node surfaces, and the reason iteration can stay sparse:
 * - `milestone` — a structural fork the caller *must* resolve to move on
 *   (choose a path, declare a major, graduate). It interrupts the year-by-year
 *   travel.
 * - `opportunity` — an optional enrichment (swap major, get a certification,
 *   buy a home). It is listed as something the player *may* do when eligible,
 *   but never forces a stop. This split is what makes most years pass without a
 *   decision while the important moments still demand one.
 * - `random` — a chance event (a layoff, a medical bill, a bonus) that is never
 *   surfaced by the milestone/opportunity selectors; it is offered only when a
 *   yearly dice roll clears its `chance.annualProbability` (see `rollYear`).
 */
export type DecisionTrigger = "milestone" | "opportunity" | "random" | "reflection";

export type DecisionEditorKind =
  | "road-signs"
  | "annual-plan"
  | "education-funding"
  | "weekly-timetable"
  | "household-plan"
  | "care-calendar"
  | "housing-comparison"
  | "risk-planner"
  | "career-scenario"
  | "multi-domain-plan";

export interface DecisionTradeoffs {
  upfrontDollars?: number;
  monthlyCashFlowDollars?: number;
  weeklyHoursDelta?: number;
  health?: -2 | -1 | 0 | 1 | 2;
  career?: -2 | -1 | 0 | 1 | 2;
  relationships?: -2 | -1 | 0 | 1 | 2;
}

/** Probability metadata for a `random`-trigger node. */
export interface RandomChance {
  /** Chance the event is offered in a given travelled year, in [0, 1]. */
  annualProbability: number;
  /** When true the event can be offered at most once per life (tracked by the caller via resolve/block). */
  oncePerLife?: boolean;
}

/**
 * What choosing a branch does to the *life context* — the stage/flags/gating.
 * This is separate from the branch's financial `effect` (which changes the
 * money snapshot): one advances where you are in the graph, the other advances
 * your balance sheet.
 */
export interface BranchOutcome {
  /** Move to a new life phase; resets the stage timer so "years in stage" counts from here. */
  setStage?: LifeStage;
  /**
   * Flags to merge into the context (later preconditions read these). A function
   * form receives the resolving context, so a branch can stamp a value only
   * known at choice time — e.g. `gradSchoolStartMonth: ctx.month` for a timer
   * that isn't tied to the stage clock.
   */
  mergeFlags?: Readonly<Record<string, JsonValue>> | ((ctx: LifeContext) => Readonly<Record<string, JsonValue>>);
  /** Node ids this branch permanently removes from ever being offered. */
  block?: readonly StableId[];
  /** Node ids to clear from "resolved" so they can fire again once their precondition passes again (gap year re-opens the root). */
  reopen?: readonly StableId[];
  /** Typed state transition for life domains that have outgrown the legacy flags map. */
  updateProfile?: (profile: LifeProfileState, ctx: LifeContext) => LifeProfileState;
}

export type DecisionResolution =
  | { kind: "complete" }
  | { kind: "defer"; reviewAfterMonths: number }
  | { kind: "repeatable"; cooldownMonths?: number }
  | { kind: "permanent-decline" };

/** One option at a crossroads. */
export interface DecisionBranch {
  id: StableId;
  label: string;
  description: string;
  importance?: DecisionImportanceLevel;
  /**
   * Optional per-option gate. When present and ineligible, the option is shown
   * disabled with reasons — never silently dropped. (A once-only "gap year"
   * branch hides itself on the second visit this way.)
   */
  available?: (ctx: LifeContext) => Eligibility;
  /** The financial fork this branch applies at `ctx.month`, or null/omitted for a purely narrative branch. */
  effect?: (ctx: LifeContext) => EventEffect | null;
  /** JSON-safe input payload required to replay a user-authored/custom decision. */
  inputs?: Readonly<Record<string, JsonValue>>;
  /** Defaults to complete. Deferral is intentionally distinct from permanent decline. */
  resolution?: DecisionResolution;
  /** Structured preview values consumed by rich, domain-specific decision editors. */
  tradeoffs?: DecisionTradeoffs;
  outcome: BranchOutcome;
}

/** A crossroads: a set of branches offered when its precondition is met. */
export interface DecisionNode {
  id: StableId;
  category: LifeDecisionCategory;
  trigger: DecisionTrigger;
  title: string;
  prompt: string;
  importance: DecisionImportanceLevel;
  /** Renderer contract and audit linkage for critique-driven decisions. */
  editorKind?: DecisionEditorKind;
  storyCoverage?: readonly StableId[];
  /** Structured precondition over the life context. Returns reasons when ineligible; never silently removes. */
  available: (ctx: LifeContext) => Eligibility;
  /** Present only for `random`-trigger nodes: how likely the event is to be offered each year. */
  chance?: RandomChance;
  branches: readonly DecisionBranch[];
}

/** A versioned catalog of crossroads — the whole decision tree for a scenario. */
export interface LifeGraph {
  id: StableId;
  version: VersionId;
  nodes: readonly DecisionNode[];
}

const IMPORTANCE_RANK: Record<DecisionImportanceLevel, number> = { major: 0, minor: 1 };

/** A node is a live candidate when it has not already been resolved and is not blocked. */
function isCandidate(node: DecisionNode, ctx: LifeContext): boolean {
  const reviewMonth = ctx.deferredNodeUntilMonth?.[node.id];
  return !ctx.resolvedNodeIds.includes(node.id) && !ctx.blockedNodeIds.includes(node.id) && (reviewMonth === undefined || ctx.month >= reviewMonth);
}

/** Stable priority sort: major before minor, preserving graph order within a tier. */
function byPriority(nodes: readonly DecisionNode[]): DecisionNode[] {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => IMPORTANCE_RANK[a.node.importance] - IMPORTANCE_RANK[b.node.importance] || a.index - b.index)
    .map((entry) => entry.node);
}

/** Every eligible node right now (both triggers), in priority order. */
export function availableDecisions(graph: LifeGraph, ctx: LifeContext): readonly DecisionNode[] {
  const open = graph.nodes.filter((node) => isCandidate(node, ctx) && node.available(ctx).eligible);
  return byPriority(open);
}

/**
 * The single milestone that must be resolved before the years can roll on, or
 * null when nothing is forcing a stop. This is what the year-by-year loop calls
 * each step — most steps return null, which is the "natural iteration" the
 * product wants.
 */
export function nextMilestone(graph: LifeGraph, ctx: LifeContext): DecisionNode | null {
  return availableDecisions(graph, ctx).find((node) => node.trigger === "milestone") ?? null;
}

/** The optional decisions available now — surfaced as "things you could do," never forced. */
export function availableOpportunities(graph: LifeGraph, ctx: LifeContext): readonly DecisionNode[] {
  return availableDecisions(graph, ctx).filter((node) => node.trigger === "opportunity");
}

/** Highest-priority reflective planning session, used only after milestones and random events. */
export function nextReflection(graph: LifeGraph, ctx: LifeContext): DecisionNode | null {
  return availableDecisions(graph, ctx).find((node) => node.trigger === "reflection") ?? null;
}

export function findNode(graph: LifeGraph, nodeId: string): DecisionNode | null {
  return graph.nodes.find((node) => node.id === nodeId) ?? null;
}

/** Resolve a persisted `(nodeId, branchId)` choice back to its branch, or null if the catalog changed. */
export function findBranch(graph: LifeGraph, nodeId: string, branchId: string): DecisionBranch | null {
  return findNode(graph, nodeId)?.branches.find((branch) => branch.id === branchId) ?? null;
}

/** Structured eligibility for one branch — eligible by default when the branch declares no `available` gate. */
export function branchEligibility(branch: DecisionBranch, ctx: LifeContext): Eligibility {
  return branch.available ? branch.available(ctx) : eligible();
}

/**
 * Fold a chosen branch into a new life context. Pure — the input is never
 * mutated. Marks the node resolved (unless the branch reopens it), applies the
 * stage change / flag merges / blocks / reopens, and resets the stage timer on
 * a stage change so later "years in stage" preconditions measure from here.
 */
export function resolveBranch(ctx: LifeContext, node: DecisionNode, branch: DecisionBranch): LifeContext {
  const outcome = branch.outcome;
  const stageChanged = outcome.setStage !== undefined && outcome.setStage !== ctx.stage;

  const resolution = branch.resolution ?? { kind: "complete" as const };
  const reopen = new Set(outcome.reopen ?? []);
  let resolvedNodeIds = ctx.resolvedNodeIds.filter((id) => !reopen.has(id));
  if (resolution.kind === "complete" && !reopen.has(node.id) && !resolvedNodeIds.includes(node.id)) {
    resolvedNodeIds = [...resolvedNodeIds, node.id];
  }

  const resolutionBlocks = resolution.kind === "permanent-decline" ? [node.id] : [];
  const blockedNodeIds = outcome.block || resolutionBlocks.length > 0
    ? [...new Set([...ctx.blockedNodeIds, ...(outcome.block ?? []), ...resolutionBlocks])]
    : ctx.blockedNodeIds;

  const deferredNodeUntilMonth = { ...(ctx.deferredNodeUntilMonth ?? {}) };
  delete deferredNodeUntilMonth[node.id];
  if (resolution.kind === "defer") deferredNodeUntilMonth[node.id] = ctx.month + Math.max(1, resolution.reviewAfterMonths);
  if (resolution.kind === "repeatable" && resolution.cooldownMonths) deferredNodeUntilMonth[node.id] = ctx.month + Math.max(1, resolution.cooldownMonths);
  for (const id of reopen) delete deferredNodeUntilMonth[id];

  const merged = typeof outcome.mergeFlags === "function" ? outcome.mergeFlags(ctx) : outcome.mergeFlags;

  return {
    ...ctx,
    stage: outcome.setStage ?? ctx.stage,
    stageStartedMonth: stageChanged ? ctx.month : ctx.stageStartedMonth,
    flags: merged ? { ...ctx.flags, ...merged } : ctx.flags,
    resolvedNodeIds,
    blockedNodeIds,
    deferredNodeUntilMonth,
    profile: outcome.updateProfile ? outcome.updateProfile(ctx.profile, ctx) : ctx.profile,
  };
}
