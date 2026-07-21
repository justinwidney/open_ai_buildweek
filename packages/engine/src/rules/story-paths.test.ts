import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cents } from "../money/index.js";
import {
  advanceLifeContext,
  availableOpportunities,
  branchEligibility,
  findBranch,
  findNode,
  initialLifeContext,
  lifeGraph2026,
  nextMilestone,
  nextReflection,
  resolveBranch,
  type DecisionBranch,
  type DecisionNode,
  type FinancialSummary,
  type LifeContext,
} from "./index.js";

interface ScheduledChoice {
  age: number;
  nodeId: string;
  branchId: string;
  source: "opportunity" | "curated-random-event";
}

interface StorySpec {
  id: string;
  name: string;
  premise: string;
  milestoneChoices: Readonly<Record<string, string | readonly string[]>>;
  reflectionChoices: Readonly<Record<string, string>>;
  scheduledChoices: readonly ScheduledChoice[];
}

interface StoryDecisionRecord {
  age: number;
  month: number;
  source: "milestone" | "reflection" | ScheduledChoice["source"];
  nodeId: string;
  nodeTitle: string;
  category: DecisionNode["category"];
  branchId: string;
  branchLabel: string;
  stageBefore: string;
  stageAfter: string;
  flagsAddedOrChanged: Readonly<Record<string, unknown>>;
}

interface StoryRun {
  id: string;
  name: string;
  premise: string;
  ageRange: { start: number; end: number };
  decisions: readonly StoryDecisionRecord[];
  quietYears: readonly number[];
  finalState: {
    stage: string;
    flags: LifeContext["flags"];
    resolvedNodeIds: readonly string[];
    availableOpportunityIds: readonly string[];
  };
  coverage: {
    decisionCount: number;
    categories: readonly string[];
    milestoneCount: number;
    opportunityCount: number;
    randomEventCount: number;
    reflectionCount: number;
  };
}

const STORY_SPECS: readonly StorySpec[] = [
  {
    id: "college-cs-grad-family",
    name: "Computer science, graduate school, and young family",
    premise: "A college student switches into data science, completes a master's, marries, buys a home, and has a child.",
    milestoneChoices: { "hs-launch": "school", "declare-major": "computer-science", graduate: "start-career", "grad-school-complete": "finish-grad" },
    reflectionChoices: { "reflection-student-funding": "aid-search", "reflection-household-direction": "family-planning", "reflection-care-and-support": "buy-capacity", "reflection-resilience-plan": "health-capacity", "reflection-career-recalibration": "deepen-specialty", "reflection-location-reset": "move-near-support", "reflection-next-chapter": "health-first" },
    scheduledChoices: [
      { age: 20, nodeId: "swap-major", branchId: "switch-data-science", source: "opportunity" },
      { age: 23, nodeId: "buy-car", branchId: "used-finance", source: "opportunity" },
      { age: 24, nodeId: "grad-school", branchId: "enroll-grad", source: "opportunity" },
      { age: 25, nodeId: "rng-trip", branchId: "go", source: "curated-random-event" },
      { age: 27, nodeId: "marriage", branchId: "dual", source: "opportunity" },
      { age: 29, nodeId: "first-child", branchId: "yes", source: "opportunity" },
      { age: 30, nodeId: "first-home", branchId: "buy-modest", source: "opportunity" },
      { age: 33, nodeId: "rng-medical", branchId: "handle", source: "curated-random-event" },
    ],
  },
  {
    id: "college-nursing-to-public-health",
    name: "Nursing student changes direction and remains independent",
    premise: "A student changes from nursing to public health, builds a career, rents, adopts a pet, and does not marry by 40.",
    milestoneChoices: { "hs-launch": "school", "declare-major": "nursing", graduate: "start-career" },
    reflectionChoices: { "reflection-student-funding": "lower-cost-year", "reflection-sustainable-work": "balanced-week", "reflection-household-direction": "independent-community", "reflection-care-and-support": "strengthen-network", "reflection-resilience-plan": "balanced-protection", "reflection-career-recalibration": "sustainable-role", "reflection-location-reset": "stay-optimize", "reflection-next-chapter": "community-family" },
    scheduledChoices: [
      { age: 20, nodeId: "swap-major", branchId: "switch-public-health", source: "opportunity" },
      { age: 24, nodeId: "buy-car", branchId: "used-cash", source: "opportunity" },
      { age: 25, nodeId: "boost-retirement", branchId: "boost", source: "opportunity" },
      { age: 27, nodeId: "rng-pet", branchId: "adult-cat", source: "curated-random-event" },
      { age: 30, nodeId: "rng-recruiter", branchId: "jump", source: "curated-random-event" },
    ],
  },
  {
    id: "direct-work-retail-family",
    name: "Retail worker advances into management",
    premise: "A high-school graduate enters retail, certifies, becomes a supervisor, and supports a single-income family.",
    milestoneChoices: { "hs-launch": "work", "entry-track": "retail" },
    reflectionChoices: { "reflection-sustainable-work": "balanced-week", "reflection-household-direction": "family-planning", "reflection-care-and-support": "flex-work", "reflection-resilience-plan": "cash-buffer", "reflection-career-recalibration": "lead-people", "reflection-location-reset": "lower-cost-base", "reflection-next-chapter": "stay-course" },
    scheduledChoices: [
      { age: 20, nodeId: "work-cert", branchId: "get-cert", source: "opportunity" },
      { age: 20, nodeId: "rng-rent-hike", branchId: "absorb", source: "curated-random-event" },
      { age: 21, nodeId: "buy-car", branchId: "used-finance", source: "opportunity" },
      { age: 22, nodeId: "work-promotion", branchId: "accept-promotion", source: "opportunity" },
      { age: 24, nodeId: "rng-layoff", branchId: "rebound", source: "curated-random-event" },
      { age: 26, nodeId: "marriage", branchId: "single", source: "opportunity" },
      { age: 28, nodeId: "first-home", branchId: "buy-modest", source: "opportunity" },
      { age: 29, nodeId: "first-child", branchId: "yes", source: "opportunity" },
      { age: 34, nodeId: "rng-home-repair", branchId: "handle", source: "curated-random-event" },
    ],
  },
  {
    id: "direct-work-tech-mobile",
    name: "Mobile technology worker with multiple income streams",
    premise: "A web developer prioritizes career mobility, a side business, and travel without marriage or homeownership.",
    milestoneChoices: { "hs-launch": "work", "entry-track": "junior-web-developer" },
    reflectionChoices: { "reflection-sustainable-work": "skill-build", "reflection-household-direction": "independent-community", "reflection-business-or-stability": "formalize-business", "reflection-care-and-support": "strengthen-network", "reflection-resilience-plan": "health-capacity", "reflection-career-recalibration": "deepen-specialty", "reflection-location-reset": "move-near-opportunity", "reflection-next-chapter": "career-reinvention" },
    scheduledChoices: [
      { age: 20, nodeId: "work-cert", branchId: "get-cert", source: "opportunity" },
      { age: 21, nodeId: "buy-car", branchId: "new-finance", source: "opportunity" },
      { age: 22, nodeId: "work-promotion", branchId: "accept-promotion", source: "opportunity" },
      { age: 23, nodeId: "rng-side-gig", branchId: "start", source: "curated-random-event" },
      { age: 25, nodeId: "rng-recruiter", branchId: "jump", source: "curated-random-event" },
      { age: 28, nodeId: "rng-trip", branchId: "go", source: "curated-random-event" },
      { age: 35, nodeId: "rng-layoff", branchId: "hold-out", source: "curated-random-event" },
    ],
  },
  {
    id: "electrician-business-owner",
    name: "Electrician becomes a business owner",
    premise: "An apprentice earns a ticket, opens a shop, and builds a dual-income household with a child and a home.",
    milestoneChoices: { "hs-launch": "trade", "apprenticeship-trade": "electrician", "journeyman-ticket": "pass-ticket" },
    reflectionChoices: { "reflection-sustainable-work": "balanced-week", "reflection-household-direction": "family-planning", "reflection-business-or-stability": "delegate-systems", "reflection-care-and-support": "share-care", "reflection-resilience-plan": "cash-buffer", "reflection-career-recalibration": "lead-people", "reflection-location-reset": "stay-optimize", "reflection-next-chapter": "community-family" },
    scheduledChoices: [
      { age: 20, nodeId: "buy-car", branchId: "used-cash", source: "opportunity" },
      { age: 23, nodeId: "rng-side-gig", branchId: "start", source: "curated-random-event" },
      { age: 25, nodeId: "master-license", branchId: "start-shop", source: "opportunity" },
      { age: 26, nodeId: "marriage", branchId: "dual", source: "opportunity" },
      { age: 27, nodeId: "first-home", branchId: "buy", source: "opportunity" },
      { age: 28, nodeId: "first-child", branchId: "yes", source: "opportunity" },
      { age: 32, nodeId: "rng-home-repair", branchId: "handle", source: "curated-random-event" },
    ],
  },
  {
    id: "hvac-journeyman-stable",
    name: "HVAC journeyman chooses stability",
    premise: "A tradesperson remains a journeyman, focuses on retirement, marries later, and starts a family in their thirties.",
    milestoneChoices: { "hs-launch": "trade", "apprenticeship-trade": "hvac", "journeyman-ticket": "pass-ticket" },
    reflectionChoices: { "reflection-sustainable-work": "balanced-week", "reflection-household-direction": "preserve-flexibility", "reflection-business-or-stability": "stable-craft", "reflection-care-and-support": "share-care", "reflection-resilience-plan": "health-capacity", "reflection-career-recalibration": "sustainable-role", "reflection-location-reset": "stay-optimize", "reflection-next-chapter": "stay-course" },
    scheduledChoices: [
      { age: 22, nodeId: "buy-car", branchId: "used-cash", source: "opportunity" },
      { age: 24, nodeId: "boost-retirement", branchId: "boost", source: "opportunity" },
      { age: 25, nodeId: "rng-rent-hike", branchId: "absorb", source: "curated-random-event" },
      { age: 29, nodeId: "marriage", branchId: "single", source: "opportunity" },
      { age: 31, nodeId: "first-child", branchId: "yes", source: "opportunity" },
      { age: 34, nodeId: "rng-medical", branchId: "handle", source: "curated-random-event" },
    ],
  },
  {
    id: "army-gi-bill-nurse",
    name: "Army veteran uses the GI Bill",
    premise: "An Army veteran attends college after service, becomes a nurse, and creates a dual-income household.",
    milestoneChoices: { "hs-launch": "military", "military-branch": "army", "post-service": "gi-bill-school", "declare-major": "nursing", graduate: "start-career" },
    reflectionChoices: { "reflection-military-service-design": "portable-credential", "reflection-student-funding": "aid-search", "reflection-household-direction": "family-planning", "reflection-care-and-support": "share-care", "reflection-resilience-plan": "health-capacity", "reflection-career-recalibration": "deepen-specialty", "reflection-location-reset": "move-near-support", "reflection-next-chapter": "community-family" },
    scheduledChoices: [
      { age: 20, nodeId: "rng-pet", branchId: "adult-dog", source: "curated-random-event" },
      { age: 25, nodeId: "rng-trip", branchId: "go", source: "curated-random-event" },
      { age: 27, nodeId: "buy-car", branchId: "used-finance", source: "opportunity" },
      { age: 28, nodeId: "marriage", branchId: "dual", source: "opportunity" },
      { age: 30, nodeId: "first-child", branchId: "yes", source: "opportunity" },
      { age: 31, nodeId: "first-home", branchId: "buy-modest", source: "opportunity" },
      { age: 35, nodeId: "rng-medical", branchId: "handle", source: "curated-random-event" },
    ],
  },
  {
    id: "air-force-civilian-family",
    name: "Air Force veteran enters civilian work",
    premise: "An Air Force veteran moves directly into civilian employment and builds a home-owning family.",
    milestoneChoices: { "hs-launch": "military", "military-branch": "air-force", "post-service": "civilian-work" },
    reflectionChoices: { "reflection-military-service-design": "transition-network", "reflection-sustainable-work": "skill-build", "reflection-household-direction": "deepen-partnership", "reflection-care-and-support": "buy-capacity", "reflection-resilience-plan": "cash-buffer", "reflection-career-recalibration": "lead-people", "reflection-location-reset": "move-near-opportunity", "reflection-next-chapter": "stay-course" },
    scheduledChoices: [
      { age: 23, nodeId: "buy-car", branchId: "new-finance", source: "opportunity" },
      { age: 24, nodeId: "boost-retirement", branchId: "boost", source: "opportunity" },
      { age: 25, nodeId: "rng-promotion", branchId: "accept", source: "curated-random-event" },
      { age: 26, nodeId: "marriage", branchId: "dual", source: "opportunity" },
      { age: 28, nodeId: "first-home", branchId: "buy", source: "opportunity" },
      { age: 29, nodeId: "first-child", branchId: "yes", source: "opportunity" },
      { age: 33, nodeId: "rng-layoff", branchId: "rebound", source: "curated-random-event" },
    ],
  },
  {
    id: "gap-year-business-degree",
    name: "Gap year followed by a business degree",
    premise: "A traveler delays college, studies business, completes graduate school, then establishes a family and home.",
    milestoneChoices: { "hs-launch": ["gap-year", "school"], "declare-major": "business", graduate: "start-career", "grad-school-complete": "finish-grad" },
    reflectionChoices: { "reflection-student-funding": "work-study", "reflection-sustainable-work": "balanced-week", "reflection-household-direction": "family-planning", "reflection-care-and-support": "share-care", "reflection-resilience-plan": "balanced-protection", "reflection-career-recalibration": "lead-people", "reflection-location-reset": "move-near-support", "reflection-next-chapter": "community-family" },
    scheduledChoices: [
      { age: 19, nodeId: "rng-trip", branchId: "go", source: "curated-random-event" },
      { age: 24, nodeId: "buy-car", branchId: "used-finance", source: "opportunity" },
      { age: 24, nodeId: "grad-school", branchId: "enroll-grad", source: "opportunity" },
      { age: 27, nodeId: "marriage", branchId: "dual", source: "opportunity" },
      { age: 29, nodeId: "first-home", branchId: "buy-modest", source: "opportunity" },
      { age: 30, nodeId: "first-child", branchId: "yes", source: "opportunity" },
    ],
  },
  {
    id: "gap-year-sales-independent",
    name: "Gap year followed by sales and independent work",
    premise: "A gap-year graduate enters sales, advances quickly, starts a side hustle, buys a home, and remains unmarried.",
    milestoneChoices: { "hs-launch": ["gap-year", "work"], "entry-track": "sales" },
    reflectionChoices: { "reflection-sustainable-work": "career-sprint", "reflection-household-direction": "independent-community", "reflection-business-or-stability": "formalize-business", "reflection-care-and-support": "strengthen-network", "reflection-resilience-plan": "cash-buffer", "reflection-career-recalibration": "deepen-specialty", "reflection-location-reset": "lower-cost-base", "reflection-next-chapter": "career-reinvention" },
    scheduledChoices: [
      { age: 20, nodeId: "buy-car", branchId: "used-finance", source: "opportunity" },
      { age: 21, nodeId: "work-cert", branchId: "get-cert", source: "opportunity" },
      { age: 22, nodeId: "rng-side-gig", branchId: "start", source: "curated-random-event" },
      { age: 23, nodeId: "work-promotion", branchId: "accept-promotion", source: "opportunity" },
      { age: 24, nodeId: "rng-recruiter", branchId: "jump", source: "curated-random-event" },
      { age: 26, nodeId: "rng-pet", branchId: "rabbit", source: "curated-random-event" },
      { age: 30, nodeId: "first-home", branchId: "buy-modest", source: "opportunity" },
    ],
  },
] as const;

const AUDIT_FINANCES: FinancialSummary = {
  liquidCents: cents(120_000),
  cashCents: cents(80_000),
  monthlyGrossCents: cents(7_000),
  monthlyTakeHomeCents: cents(5_200),
  monthlySpendingCents: cents(3_100),
  monthlyDebtPaymentCents: cents(350),
  netWorthCents: cents(180_000),
  emergencyFundMonths: 8,
  savingsRate: 0.08,
};

function requiredNode(nodeId: string): DecisionNode {
  const node = findNode(lifeGraph2026, nodeId);
  assert.ok(node, `story fixture references known node ${nodeId}`);
  return node;
}

function requiredBranch(node: DecisionNode, branchId: string, ctx: LifeContext): DecisionBranch {
  const branch = findBranch(lifeGraph2026, node.id, branchId);
  assert.ok(branch, `story fixture references known branch ${node.id}/${branchId}`);
  const eligibility = branchEligibility(branch, ctx);
  assert.equal(eligibility.eligible, true, `${node.id}/${branchId} is eligible: ${eligibility.reasons.join(" ")}`);
  return branch;
}

function changedFlags(before: LifeContext["flags"], after: LifeContext["flags"]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => JSON.stringify(before[key]) !== JSON.stringify(value)));
}

function decisionRecord(
  age: number,
  source: StoryDecisionRecord["source"],
  ctx: LifeContext,
  node: DecisionNode,
  branch: DecisionBranch,
  next: LifeContext,
): StoryDecisionRecord {
  return {
    age,
    month: ctx.month,
    source,
    nodeId: node.id,
    nodeTitle: node.title,
    category: node.category,
    branchId: branch.id,
    branchLabel: branch.label,
    stageBefore: String(ctx.stage),
    stageAfter: String(next.stage),
    flagsAddedOrChanged: changedFlags(ctx.flags, next.flags),
  };
}

function milestoneBranchId(spec: StorySpec, node: DecisionNode, occurrence: number): string {
  const configured = spec.milestoneChoices[node.id];
  if (Array.isArray(configured)) {
    const choice = configured[occurrence];
    assert.ok(choice, `${spec.id} has a branch for occurrence ${occurrence + 1} of ${node.id}`);
    return choice;
  }
  if (typeof configured === "string") return configured;
  const defaultBranch = node.branches.find((branch) => branchEligibility(branch, initialLifeContext({ ageYears: 18 })).eligible) ?? node.branches[0];
  assert.ok(defaultBranch, `${node.id} has a branch`);
  return defaultBranch.id;
}

function simulateStory(spec: StorySpec): StoryRun {
  let ctx: LifeContext = { ...initialLifeContext({ ageYears: 18 }), finances: AUDIT_FINANCES };
  const decisions: StoryDecisionRecord[] = [];
  const quietYears: number[] = [];
  const milestoneOccurrences: Record<string, number> = {};

  for (let age = 18; age <= 40; age += 1) {
    const month = (age - 18) * 12;
    ctx = advanceLifeContext(ctx, { month, ageYears: age });
    ctx = { ...ctx, finances: AUDIT_FINANCES };
    const decisionsBeforeYear = decisions.length;

    for (let guard = 0; guard < 8; guard += 1) {
      const milestone = nextMilestone(lifeGraph2026, ctx);
      if (!milestone) break;
      const occurrence = milestoneOccurrences[milestone.id] ?? 0;
      const branchId = milestoneBranchId(spec, milestone, occurrence);
      milestoneOccurrences[milestone.id] = occurrence + 1;
      const branch = requiredBranch(milestone, branchId, ctx);
      const next = resolveBranch(ctx, milestone, branch);
      decisions.push(decisionRecord(age, "milestone", ctx, milestone, branch, next));
      ctx = next;
      if (guard === 7) assert.fail(`${spec.id} exceeded the milestone chain guard at age ${age}`);
    }

    for (const scheduled of spec.scheduledChoices.filter((choice) => choice.age === age)) {
      const node = requiredNode(scheduled.nodeId);
      assert.equal(node.trigger, scheduled.source === "opportunity" ? "opportunity" : "random", `${node.id} has the scheduled trigger`);
      const eligibility = node.available(ctx);
      assert.equal(eligibility.eligible, true, `${spec.id} can reach ${node.id} at ${age}: ${eligibility.reasons.join(" ")}`);
      const branch = requiredBranch(node, scheduled.branchId, ctx);
      const next = resolveBranch(ctx, node, branch);
      decisions.push(decisionRecord(age, scheduled.source, ctx, node, branch, next));
      ctx = next;
    }

    // Mirrors the app agenda: reflective planning is the fallback only when no
    // milestone or curated event/choice occupied this year.
    if (decisions.length === decisionsBeforeYear) {
      const reflection = nextReflection(lifeGraph2026, ctx);
      if (reflection) {
        const branchId = spec.reflectionChoices[reflection.id] ?? reflection.branches[0]?.id;
        assert.ok(branchId, `${spec.id} has a reflection branch for ${reflection.id}`);
        const branch = requiredBranch(reflection, branchId, ctx);
        const next = resolveBranch(ctx, reflection, branch);
        decisions.push(decisionRecord(age, "reflection", ctx, reflection, branch, next));
        ctx = next;
      }
    }

    if (decisions.length === decisionsBeforeYear) quietYears.push(age);
  }

  const categories = [...new Set(decisions.map((decision) => decision.category))].sort();
  return {
    id: spec.id,
    name: spec.name,
    premise: spec.premise,
    ageRange: { start: 18, end: 40 },
    decisions,
    quietYears,
    finalState: {
      stage: String(ctx.stage),
      flags: ctx.flags,
      resolvedNodeIds: ctx.resolvedNodeIds,
      availableOpportunityIds: availableOpportunities(lifeGraph2026, ctx).map((node) => node.id),
    },
    coverage: {
      decisionCount: decisions.length,
      categories,
      milestoneCount: decisions.filter((decision) => decision.source === "milestone").length,
      opportunityCount: decisions.filter((decision) => decision.source === "opportunity").length,
      randomEventCount: decisions.filter((decision) => decision.source === "curated-random-event").length,
      reflectionCount: decisions.filter((decision) => decision.source === "reflection").length,
    },
  };
}

const STORY_RUNS = STORY_SPECS.map(simulateStory);
const OUTPUT_PATH = fileURLToPath(new URL("../../../../docs/rules-engine/ten-story-paths.json", import.meta.url));

describe("rules/ten age-18-to-40 story paths", () => {
  for (const story of STORY_RUNS) {
    it(`${story.name} walks valid branches through age 40`, () => {
      assert.equal(story.ageRange.start, 18);
      assert.equal(story.ageRange.end, 40);
      assert.ok(story.decisions.length >= 7, `${story.id} records a meaningful decision history`);
      assert.ok(story.decisions.some((decision) => decision.nodeId === "hs-launch"));
      assert.ok(!story.decisions.some((decision) => decision.nodeId === "rng-inheritance"), "inheritance is absent");
      assert.ok(story.quietYears.length > 0, "the audit exposes years where the current engine has no modeled decision");
    });
  }

  it("records all ten deterministic lives as reviewable JSON", () => {
    assert.equal(STORY_RUNS.length, 10);
    assert.equal(new Set(STORY_RUNS.map((story) => story.id)).size, 10);
    const rootBranches = new Set(STORY_RUNS.map((story) => story.decisions.find((decision) => decision.nodeId === "hs-launch")?.branchId));
    assert.deepEqual([...rootBranches].sort(), ["gap-year", "military", "school", "trade", "work"]);

    const artifact = {
      schemaVersion: 1,
      purpose: "Deterministic rules-engine coverage audit; curated random events are explicitly injected rather than probability-rolled.",
      methodology: {
        scope: "LifeContext navigation, availability gates, and branch outcomes through ages 18–40.",
        financialEffectsApplied: false,
        financialGateAssumption: "A fixed high-liquidity audit summary is attached each year so the suite can inspect narrative reachability without conflating it with a market simulation.",
        randomEventMethod: "Selected random nodes are injected at named ages and still must pass their normal node and branch eligibility checks.",
      },
      graph: { id: lifeGraph2026.id, version: lifeGraph2026.version },
      ageRange: { start: 18, end: 40 },
      scenarioCount: STORY_RUNS.length,
      summary: {
        totalDecisions: STORY_RUNS.reduce((sum, story) => sum + story.decisions.length, 0),
        totalQuietYears: STORY_RUNS.reduce((sum, story) => sum + story.quietYears.length, 0),
        rootBranchesCovered: [...rootBranches].sort(),
        categoriesCovered: [...new Set(STORY_RUNS.flatMap((story) => story.coverage.categories))].sort(),
      },
      stories: STORY_RUNS,
    };
    mkdirSync(fileURLToPath(new URL("../../../../docs/rules-engine/", import.meta.url)), { recursive: true });
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  });
});
