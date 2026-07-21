import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { initialTaxBasis } from "../types/tax-basis.js";
import { initialFinancialAssetState } from "../assets/index.js";
import { computeNetWorthCents } from "../simulation/net-worth.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { applyEvent } from "../events/apply.js";
import {
  advanceLifeContext,
  availableOpportunities,
  branchEligibility,
  findBranch,
  hasFlag,
  initialLifeContext,
  lifeGraph2026,
  monthsInStage,
  nextMilestone,
  resolveBranch,
  type DecisionBranch,
  type DecisionNode,
  type LifeContext,
} from "./index.js";

const graph = lifeGraph2026;

/** A minimal age-18 seed snapshot using the ids the catalog assumes (`job`, `living`). */
function seedSnapshot(): LifeStateSnapshot {
  const income = { config: { id: "job", label: "Part-time", baseMonthlyGrossCents: cents(1_600), annualGrowthRate: 0.02, stateCode: "TX", pretaxDeferralRate: 0, startMonth: 0 } };
  const living = { config: { id: "living", label: "Living costs", category: "fixed" as const, baseMonthlyAmountCents: cents(1_400), annualInflationRate: 0.03, startMonth: 0 } };
  const cash = initialFinancialAssetState({ id: "cash", label: "Cash", annualInterestRate: 0.01 }, cents(4_000));
  const netWorthCents = computeNetWorthCents({ financialAssets: [cash], portfolio: { holdings: [] }, physicalAssets: [], debts: [], month: 0 });
  return { runId: "test", month: 0, parentSnapshotRef: null, decisions: [], incomes: [income], expenses: [living], debts: [], financialAssets: [cash], portfolio: { holdings: [] }, physicalAssets: [], taxBasis: initialTaxBasis(2026, "single"), netWorthCents, extensions: {} };
}

function branch(node: DecisionNode, branchId: string): DecisionBranch {
  const found = findBranch(graph, node.id, branchId);
  assert.ok(found, `branch ${branchId} exists on ${node.id}`);
  return found;
}

/** Choose a branch: advance the context (used by the walk-throughs). Ignores the money effect. */
function choose(ctx: LifeContext, nodeId: string, branchId: string): LifeContext {
  const node = graph.nodes.find((n) => n.id === nodeId)!;
  return resolveBranch(ctx, node, branch(node, branchId));
}

describe("rules/context", () => {
  it("monthsInStage measures from stageStartedMonth", () => {
    const ctx = { ...initialLifeContext({ ageYears: 20 }), month: 30, stageStartedMonth: 6 };
    assert.equal(monthsInStage(ctx), 24);
  });

  it("hasFlag treats false/null/undefined as unset", () => {
    const ctx = { ...initialLifeContext({ ageYears: 18 }), flags: { a: true, b: false, c: null, d: 0, e: "x" } };
    assert.equal(hasFlag(ctx, "a"), true);
    assert.equal(hasFlag(ctx, "b"), false);
    assert.equal(hasFlag(ctx, "c"), false);
    assert.equal(hasFlag(ctx, "d"), true); // 0 is a set number
    assert.equal(hasFlag(ctx, "e"), true);
    assert.equal(hasFlag(ctx, "missing"), false);
  });

  it("advanceLifeContext moves the clock without touching stage or flags", () => {
    const ctx = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "school");
    const later = advanceLifeContext(ctx, { month: 24, ageYears: 20 });
    assert.equal(later.stage, "school");
    assert.equal(later.month, 24);
    assert.equal(later.stageStartedMonth, ctx.stageStartedMonth);
  });
});

describe("rules/resolveBranch", () => {
  it("does not mutate the input context", () => {
    const before = initialLifeContext({ ageYears: 18 });
    const frozen = structuredClone(before);
    resolveBranch(before, graph.nodes[0]!, branch(graph.nodes[0]!, "school"));
    assert.deepEqual(before, frozen);
  });

  it("marks the node resolved and a stage change resets the stage timer", () => {
    const ctx = advanceLifeContext(initialLifeContext({ ageYears: 18 }), { month: 0, ageYears: 18 });
    const after = choose({ ...ctx, month: 5 }, "hs-launch", "work");
    assert.ok(after.resolvedNodeIds.includes("hs-launch"));
    assert.equal(after.stage, "working");
    assert.equal(after.stageStartedMonth, 5, "the stage timer resets to the month the branch was taken");
    assert.equal(hasFlag(after, "wentToWork"), true);
  });

  it("reopen clears a node from resolved so it can fire again", () => {
    const gap = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "gap-year");
    assert.ok(!gap.resolvedNodeIds.includes("hs-launch"), "gap year re-opens the root");
    assert.equal(gap.stage, "gap-year");
    assert.equal(hasFlag(gap, "tookGapYear"), true);
  });

  it("mergeFlags function form stamps a value from the resolving context", () => {
    // Reach a working graduate, then enroll in grad school at month 90.
    let ctx = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "school");
    ctx = choose({ ...ctx, month: 2 }, "declare-major", "computer-science");
    ctx = choose({ ...ctx, month: 48 }, "graduate", "start-career");
    const atEnroll = { ...ctx, month: 90 };
    const enrolled = choose(atEnroll, "grad-school", "enroll-grad");
    assert.equal(enrolled.flags["gradSchoolStartMonth"], 90);
  });
});

describe("rules/navigator", () => {
  it("a fresh 18-year-old faces exactly the root milestone", () => {
    const ctx = initialLifeContext({ ageYears: 18 });
    const next = nextMilestone(graph, ctx);
    assert.equal(next?.id, "hs-launch");
    assert.equal(availableOpportunities(graph, ctx).length, 0);
  });

  it("an ineligible node reports reasons rather than vanishing", () => {
    const ctx = initialLifeContext({ ageYears: 18 });
    const gradNode = graph.nodes.find((n) => n.id === "graduate")!;
    const elig = gradNode.available(ctx);
    assert.equal(elig.eligible, false);
    assert.ok(elig.reasons.length > 0);
  });

  it("gap year re-offers the root a year later, with the gap-year option now blocked", () => {
    let ctx = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "gap-year");
    ctx = advanceLifeContext(ctx, { month: 12, ageYears: 19 });
    const next = nextMilestone(graph, ctx);
    assert.equal(next?.id, "hs-launch", "root fires again after a year");
    assert.equal(branchEligibility(branch(next!, "gap-year"), ctx).eligible, false, "can't take a second gap year");
    assert.equal(branchEligibility(branch(next!, "school"), ctx).eligible, true);
  });

  it("most years roll by with no forced milestone once a path is chosen", () => {
    let ctx = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "school");
    ctx = choose({ ...ctx, month: 2 }, "declare-major", "nursing");
    ctx = advanceLifeContext(ctx, { month: 24, ageYears: 20 }); // sophomore year
    assert.equal(nextMilestone(graph, ctx), null, "no milestone mid-degree");
    assert.ok(availableOpportunities(graph, ctx).some((n) => n.id === "swap-major"), "but swapping is offered");
  });
});

describe("rules/catalog walk-throughs", () => {
  it("school → declare → graduate reaches a working degree-holder with real income", () => {
    let ctx = initialLifeContext({ ageYears: 18 });
    assert.equal(nextMilestone(graph, ctx)?.id, "hs-launch");
    ctx = choose(ctx, "hs-launch", "school");

    ctx = advanceLifeContext(ctx, { month: 2, ageYears: 18 });
    assert.equal(nextMilestone(graph, ctx)?.id, "declare-major");
    ctx = choose(ctx, "declare-major", "computer-science");
    assert.equal(ctx.flags["major"], "computer-science");

    ctx = advanceLifeContext(ctx, { month: 48, ageYears: 22 });
    assert.equal(nextMilestone(graph, ctx)?.id, "graduate");
    ctx = choose(ctx, "graduate", "start-career");
    assert.equal(ctx.stage, "working");
    assert.equal(hasFlag(ctx, "degreeEarned"), true);
  });

  it("trade → journeyman ticket unlocks only after enough apprentice months", () => {
    let ctx = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "trade");
    ctx = advanceLifeContext(ctx, { month: 3, ageYears: 18 });
    assert.equal(nextMilestone(graph, ctx)?.id, "apprenticeship-trade");
    ctx = choose(ctx, "apprenticeship-trade", "electrician");

    ctx = advanceLifeContext(ctx, { month: 24, ageYears: 20 });
    assert.equal(nextMilestone(graph, ctx), null, "too early for the ticket");

    ctx = advanceLifeContext(ctx, { month: 36, ageYears: 21 });
    assert.equal(nextMilestone(graph, ctx)?.id, "journeyman-ticket");
    ctx = choose(ctx, "journeyman-ticket", "pass-ticket");
    assert.equal(ctx.stage, "working");
    assert.equal(hasFlag(ctx, "ticket"), true);
  });

  it("military → post-service GI Bill loops back into the school subtree", () => {
    let ctx = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "military");
    ctx = advanceLifeContext(ctx, { month: 2, ageYears: 18 });
    ctx = choose(ctx, "military-branch", "army");

    ctx = advanceLifeContext(ctx, { month: 48, ageYears: 22 });
    assert.equal(nextMilestone(graph, ctx)?.id, "post-service");
    ctx = choose(ctx, "post-service", "gi-bill-school");
    assert.equal(ctx.stage, "school");
    assert.equal(hasFlag(ctx, "giBill"), true);
    // Back in school, the next milestone is declaring a major.
    ctx = advanceLifeContext(ctx, { month: 50, ageYears: 22 });
    assert.equal(nextMilestone(graph, ctx)?.id, "declare-major");
  });

  it("branch effects produce valid mutations that apply cleanly to a snapshot", () => {
    const ctx = { ...initialLifeContext({ ageYears: 18 }), month: 0 };
    const enroll = branch(graph.nodes[0]!, "school");
    const effect = enroll.effect!(ctx)!;
    const after = applyEvent(seedSnapshot(), effect);
    // Enrolling replaces the job with a part-time one and records the decision.
    const job = after.incomes.find((i) => i.config.id === "job")!;
    assert.equal(job.config.baseMonthlyGrossCents, cents(900));
    assert.equal(after.decisions.at(-1)?.domain, "education");
  });

  it("a declared major adds a tuition expense ending at graduation", () => {
    let ctx = choose(initialLifeContext({ ageYears: 18 }), "hs-launch", "school");
    ctx = { ...ctx, month: 2 };
    const declare = branch(graph.nodes.find((n) => n.id === "declare-major")!, "nursing");
    const after = applyEvent(seedSnapshot(), declare.effect!(ctx)!);
    const tuition = after.expenses.find((e) => e.config.id === "tuition");
    assert.ok(tuition, "tuition expense added");
    assert.equal(tuition!.config.endMonth, ctx.stageStartedMonth + 48);
  });

  it("offers every illustrated pet and applies its differentiated upfront and monthly costs", () => {
    const petNode = graph.nodes.find((node) => node.id === "rng-pet")!;
    assert.deepEqual(
      petNode.branches.map((candidate) => candidate.id),
      ["adult-dog", "puppy", "senior-dog", "adult-cat", "bonded-cats", "rabbit", "guinea-pig-pair", "hamster", "parakeet", "freshwater-aquarium", "leopard-gecko", "tortoise", "decline"],
    );

    const ctx = { ...initialLifeContext({ ageYears: 25 }), month: 84 };
    const puppy = branch(petNode, "puppy");
    const effect = puppy.effect!(ctx)!;
    const cash = effect.mutations.find((mutation) => mutation.kind === "adjustCash");
    const expense = effect.mutations.find((mutation) => mutation.kind === "addExpense");
    assert.deepEqual(cash, { kind: "adjustCash", deltaCents: -cents(1_400) });
    assert.equal(expense?.kind === "addExpense" ? expense.expense.config.baseMonthlyAmountCents : 0, cents(230));
    assert.equal(puppy.tradeoffs?.weeklyHoursDelta, -18);

    const adopted = resolveBranch(ctx, petNode, puppy);
    assert.equal(adopted.flags["hasPet"], true);
    assert.equal(adopted.flags["petType"], "puppy");
  });
});
