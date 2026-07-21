import { eligible, gate, hasFlag, type LifeContext } from "./context.js";
import { buildEffect, gainCash, scaleLiving, scalePrimaryJob, setLivingCost, spendCash } from "./effects.js";
import type { DecisionBranch, DecisionNode } from "./graph.js";
import type { LifeGoal, LifeProfileState, WeeklyTimeBudget } from "./life-profile.js";

function ageWindow(ctx: LifeContext, from: number, to: number) {
  return gate(ctx.ageYears >= from && ctx.ageYears <= to, `This review is scheduled for ages ${from}–${to}.`);
}

function addGoal(profile: LifeProfileState, goal: LifeGoal): readonly LifeGoal[] {
  return [...profile.goals.filter((item) => item.id !== goal.id), goal];
}

function goal(ctx: LifeContext, id: string, label: string, domain: string): LifeGoal {
  return { id, label, domain, reviewMonth: ctx.month + 12, status: "active" };
}

function time(profile: LifeProfileState, patch: Partial<WeeklyTimeBudget>): WeeklyTimeBudget {
  const next = { ...profile.time, ...patch };
  const committed = next.work + next.study + next.sleep + next.friends + next.fitness + next.transit;
  return { ...next, flexible: Math.max(0, 168 - committed) };
}

const STUDENT_FUNDING: DecisionNode = {
  id: "reflection-student-funding",
  category: "education",
  trigger: "reflection",
  editorKind: "education-funding",
  storyCoverage: ["college-cs-grad-family", "college-nursing-to-public-health", "gap-year-business-degree"],
  title: "Fund the next year of school",
  prompt: "How will you balance tuition, paid work, study time, and financial runway?",
  importance: "major",
  available: (ctx) => ctx.stage === "school" ? ageWindow(ctx, 19, 22) : gate(false, "This plan is for an active student."),
  branches: [
    {
      id: "work-study",
      label: "Work more while studying",
      description: "Increase paid hours and accept a tighter week to reduce borrowing pressure.",
      tradeoffs: { monthlyCashFlowDollars: 350, weeklyHoursDelta: -8, health: -1, career: 1, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-student-funding", domain: "education", optionId: "work-study", label: "Funded school with more paid work", month: ctx.month, mutations: [scalePrimaryJob(1.2)] }),
      outcome: { mergeFlags: { schoolFundingPlan: "work-study" }, updateProfile: (profile, ctx) => ({ ...profile, education: { ...profile.education, status: "enrolled" }, work: { ...profile.work, status: "part-time", weeklyHours: 24 }, time: time(profile, { work: 24, study: 28 }), goals: addGoal(profile, goal(ctx, "fund-school", "Fund school without overload", "education")) }) },
    },
    {
      id: "aid-search",
      label: "Pursue grants and aid",
      description: "Reserve application time and use a modest aid award to protect study capacity.",
      tradeoffs: { upfrontDollars: 3_000, weeklyHoursDelta: -3, health: 0, career: 1, relationships: 0 },
      effect: (ctx) => buildEffect({ id: "reflection-student-funding", domain: "education", optionId: "aid-search", label: "Secured education aid", month: ctx.month, mutations: [gainCash(3_000)] }),
      outcome: { mergeFlags: { schoolFundingPlan: "aid-search" }, updateProfile: (profile, ctx) => ({ ...profile, education: { ...profile.education, status: "enrolled" }, time: time(profile, { study: 33 }), goals: addGoal(profile, goal(ctx, "fund-school", "Apply for grants and aid", "education")) }) },
    },
    {
      id: "lower-cost-year",
      label: "Build a lower-cost school year",
      description: "Use shared housing, a strict grocery plan, and fewer optional costs.",
      tradeoffs: { monthlyCashFlowDollars: 220, weeklyHoursDelta: -2, health: 0, career: 0, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-student-funding", domain: "education", optionId: "lower-cost-year", label: "Lowered costs while in school", month: ctx.month, mutations: [scaleLiving(0.88)] }),
      outcome: { mergeFlags: { schoolFundingPlan: "lower-cost-year" }, updateProfile: (profile, ctx) => ({ ...profile, education: { ...profile.education, status: "enrolled" }, place: { ...profile.place, housingTenure: "shared-rent", monthlyLivingCostDollars: Math.round(profile.place.monthlyLivingCostDollars * 0.88) }, goals: addGoal(profile, goal(ctx, "fund-school", "Keep school costs sustainable", "education")) }) },
    },
  ],
};

const MILITARY_SERVICE_DESIGN: DecisionNode = {
  id: "reflection-military-service-design",
  category: "military",
  trigger: "reflection",
  editorKind: "multi-domain-plan",
  storyCoverage: ["army-gi-bill-nurse", "air-force-civilian-family"],
  title: "Shape the rest of your service",
  prompt: "Which service experience should translate into your civilian life?",
  importance: "major",
  available: (ctx) => ctx.stage === "military" ? ageWindow(ctx, 19, 21) : gate(false, "This review is for active service."),
  branches: [
    {
      id: "portable-credential",
      label: "Earn a portable credential",
      description: "Use off-duty study for a credential that transfers to civilian work.",
      tradeoffs: { upfrontDollars: -1_500, weeklyHoursDelta: -6, health: -1, career: 2, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-military-service-design", domain: "military", optionId: "portable-credential", label: "Pursued a portable service credential", month: ctx.month, mutations: [spendCash(1_500)] }),
      outcome: { mergeFlags: { servicePlan: "portable-credential", serviceCredential: true }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, status: "service" }, time: time(profile, { study: 8 }), goals: addGoal(profile, goal(ctx, "service-transition", "Complete a portable credential", "career")) }) },
    },
    {
      id: "transition-network",
      label: "Build a civilian transition network",
      description: "Protect time for mentors, benefits planning, and employer connections.",
      tradeoffs: { monthlyCashFlowDollars: -100, weeklyHoursDelta: -4, health: 1, career: 2, relationships: 1 },
      effect: (ctx) => buildEffect({ id: "reflection-military-service-design", domain: "military", optionId: "transition-network", label: "Built a service-to-civilian network", month: ctx.month, mutations: [spendCash(1_200)] }),
      outcome: { mergeFlags: { servicePlan: "transition-network", transitionNetwork: true }, updateProfile: (profile, ctx) => ({ ...profile, wellbeing: { ...profile.wellbeing, socialSupport: Math.min(100, profile.wellbeing.socialSupport + 15) }, goals: addGoal(profile, goal(ctx, "service-transition", "Prepare for civilian transition", "career")) }) },
    },
    {
      id: "reenlist-review",
      label: "Evaluate reenlistment and reserve options",
      description: "Compare continued service, reserve duty, and separation before the timer decides for you.",
      tradeoffs: { weeklyHoursDelta: -2, health: 0, career: 1, relationships: 0 },
      outcome: { mergeFlags: { servicePlan: "reenlist-review" }, updateProfile: (profile, ctx) => ({ ...profile, goals: addGoal(profile, goal(ctx, "service-transition", "Choose service or separation deliberately", "military")) }) },
    },
  ],
};

const SUSTAINABLE_WORK: DecisionNode = {
  id: "reflection-sustainable-work",
  category: "career",
  trigger: "reflection",
  editorKind: "weekly-timetable",
  storyCoverage: ["direct-work-retail-family", "direct-work-tech-mobile", "electrician-business-owner", "hvac-journeyman-stable", "gap-year-sales-independent"],
  title: "Design a sustainable working week",
  prompt: "How much time will go to earning, advancement, health, and people this year?",
  importance: "major",
  available: (ctx) => ["working", "apprenticeship"].includes(ctx.stage) ? ageWindow(ctx, 23, 26) : gate(false, "This review requires an active work path."),
  branches: [
    {
      id: "career-sprint",
      label: "Run a focused career sprint",
      description: "Take overtime or harder assignments for one year, with an explicit recovery date.",
      tradeoffs: { monthlyCashFlowDollars: 650, weeklyHoursDelta: -10, health: -2, career: 2, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-sustainable-work", domain: "career", optionId: "career-sprint", label: "Chose a one-year career sprint", month: ctx.month, mutations: [scalePrimaryJob(1.12)] }),
      outcome: { mergeFlags: { workPace: "sprint" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: 50 }, time: time(profile, { work: 50, sleep: 52, friends: 6 }), wellbeing: { ...profile.wellbeing, stress: 75, burnoutRisk: 65 }, goals: addGoal(profile, goal(ctx, "work-pace", "Complete a bounded career sprint", "career")) }) },
    },
    {
      id: "balanced-week",
      label: "Protect a balanced week",
      description: "Keep dependable hours while reserving sleep, exercise, and relationships.",
      tradeoffs: { weeklyHoursDelta: 0, health: 2, career: 1, relationships: 2 },
      outcome: { mergeFlags: { workPace: "balanced" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: 40 }, time: time(profile, { work: 40, sleep: 56, friends: 10, fitness: 5 }), wellbeing: { ...profile.wellbeing, stress: 35, burnoutRisk: 20 }, goals: addGoal(profile, goal(ctx, "work-pace", "Maintain a sustainable working week", "wellbeing")) }) },
    },
    {
      id: "skill-build",
      label: "Reserve time for a portable skill",
      description: "Fund a credential or portfolio without stacking it on top of unlimited work.",
      tradeoffs: { monthlyCashFlowDollars: -250, weeklyHoursDelta: -7, health: -1, career: 2, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-sustainable-work", domain: "career", optionId: "skill-build", label: "Reserved time for portable skills", month: ctx.month, mutations: [spendCash(3_000)] }),
      outcome: { mergeFlags: { workPace: "skill-build" }, updateProfile: (profile, ctx) => ({ ...profile, time: time(profile, { work: 38, study: 8 }), goals: addGoal(profile, goal(ctx, "work-pace", "Build a portable skill", "career")) }) },
    },
    {
      id: "recovery-season",
      label: "Choose a recovery season",
      description: "Reduce paid load temporarily to rebuild health and capacity.",
      tradeoffs: { monthlyCashFlowDollars: -400, weeklyHoursDelta: 8, health: 2, career: -1, relationships: 1 },
      effect: (ctx) => buildEffect({ id: "reflection-sustainable-work", domain: "career", optionId: "recovery-season", label: "Reduced workload for recovery", month: ctx.month, mutations: [scalePrimaryJob(0.92)] }),
      outcome: { mergeFlags: { workPace: "recovery" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: 32 }, time: time(profile, { work: 32, sleep: 60, fitness: 7 }), wellbeing: { ...profile.wellbeing, stress: 25, burnoutRisk: 10 }, goals: addGoal(profile, goal(ctx, "work-pace", "Rebuild capacity", "health")) }) },
    },
  ],
};

const HOUSEHOLD_DIRECTION: DecisionNode = {
  id: "reflection-household-direction",
  category: "family",
  trigger: "reflection",
  editorKind: "household-plan",
  storyCoverage: ["college-nursing-to-public-health", "direct-work-tech-mobile", "hvac-journeyman-stable", "gap-year-sales-independent"],
  title: "Choose your household direction",
  prompt: "Independence, partnership, care, and community are all valid plans—which one are you building?",
  importance: "major",
  available: (ctx) => ageWindow(ctx, 27, 30),
  branches: [
    {
      id: "independent-community",
      label: "Build an independent, connected life",
      description: "Keep your own household while investing deliberately in friends and community.",
      tradeoffs: { monthlyCashFlowDollars: -200, weeklyHoursDelta: -6, health: 1, career: 0, relationships: 2 },
      effect: (ctx) => buildEffect({ id: "reflection-household-direction", domain: "household", optionId: "independent-community", label: "Chose an independent, connected household", month: ctx.month, mutations: [spendCash(2_400)] }),
      outcome: { mergeFlags: { householdIntent: "independent-community" }, updateProfile: (profile, ctx) => ({ ...profile, household: { ...profile.household, relationshipStatus: "single", weeklyCareHours: 4 }, wellbeing: { ...profile.wellbeing, socialSupport: Math.min(100, profile.wellbeing.socialSupport + 15) }, goals: addGoal(profile, goal(ctx, "household-direction", "Strengthen an independent support network", "community")) }) },
    },
    {
      id: "deepen-partnership",
      label: "Build toward shared partnership",
      description: "Plan shared routines, money, housing, and conflict repair before a legal milestone.",
      tradeoffs: { monthlyCashFlowDollars: 150, weeklyHoursDelta: -5, health: 1, career: 0, relationships: 2 },
      outcome: { mergeFlags: { householdIntent: "partnership" }, updateProfile: (profile, ctx) => ({ ...profile, household: { ...profile.household, relationshipStatus: "partnered", weeklyCareHours: 3 }, goals: addGoal(profile, goal(ctx, "household-direction", "Build a healthy partnership", "relationships")) }) },
    },
    {
      id: "family-planning",
      label: "Plan for dependents deliberately",
      description: "Research leave, childcare, health, housing, and savings before committing.",
      tradeoffs: { monthlyCashFlowDollars: -500, weeklyHoursDelta: -2, health: 1, career: -1, relationships: 2 },
      effect: (ctx) => buildEffect({ id: "reflection-household-direction", domain: "household", optionId: "family-planning", label: "Started a deliberate family plan", month: ctx.month, mutations: [spendCash(6_000)] }),
      outcome: { mergeFlags: { householdIntent: "family-planning", familyPlanningIntent: "yes" }, updateProfile: (profile, ctx) => ({ ...profile, household: { ...profile.household, weeklyCareHours: 2 }, goals: addGoal(profile, goal(ctx, "household-direction", "Prepare for possible dependents", "family")) }) },
    },
    {
      id: "preserve-flexibility",
      label: "Preserve flexibility this year",
      description: "Avoid adding household commitments now, with a dated review rather than a silent omission.",
      tradeoffs: { weeklyHoursDelta: 4, health: 0, career: 1, relationships: 0 },
      resolution: { kind: "complete" },
      outcome: { mergeFlags: (ctx) => ({ householdIntent: "flexible", householdReviewMonth: ctx.month + 24 }), updateProfile: (profile, ctx) => ({ ...profile, goals: addGoal(profile, { ...goal(ctx, "household-direction", "Revisit household priorities", "family"), reviewMonth: ctx.month + 24 }) }) },
    },
  ],
};

const BUSINESS_OR_STABILITY: DecisionNode = {
  id: "reflection-business-or-stability",
  category: "career",
  trigger: "reflection",
  editorKind: "career-scenario",
  storyCoverage: ["direct-work-tech-mobile", "electrician-business-owner", "hvac-journeyman-stable", "gap-year-sales-independent"],
  title: "Choose stability or business growth",
  prompt: "Should extra earning remain a side path, become a real business, or give way to a steadier craft?",
  importance: "major",
  available: (ctx) => hasFlag(ctx, "ticket") || hasFlag(ctx, "masterLicense") || hasFlag(ctx, "hasSideGig")
    ? ageWindow(ctx, 28, 33)
    : gate(false, "This review unlocks after a trade ticket, master license, or side business."),
  branches: [
    {
      id: "stable-craft",
      label: "Choose a stable craft and predictable hours",
      description: "Keep the core role, make renting and stability explicit, and protect physical capacity.",
      tradeoffs: { weeklyHoursDelta: 5, health: 2, career: 0, relationships: 1 },
      outcome: { mergeFlags: { businessDirection: "stable-craft", stabilityChosen: true }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, status: "full-time", weeklyHours: 38 }, time: time(profile, { work: 38, fitness: 6 }), wellbeing: { ...profile.wellbeing, stress: 30, burnoutRisk: 15 }, goals: addGoal(profile, goal(ctx, "business-direction", "Protect stable craft work", "career")) }) },
    },
    {
      id: "formalize-business",
      label: "Formalize and grow the business",
      description: "Fund equipment, insurance, bookkeeping, and a working-capital reserve.",
      available: (ctx) => gate(hasFlag(ctx, "masterLicense") || hasFlag(ctx, "hasSideGig"), "A master license or active side business is required."),
      tradeoffs: { upfrontDollars: -12_000, monthlyCashFlowDollars: 600, weeklyHoursDelta: -12, health: -2, career: 2, relationships: -2 },
      effect: (ctx) => buildEffect({ id: "reflection-business-or-stability", domain: "business", optionId: "formalize-business", label: "Formalized a small business", month: ctx.month, mutations: [spendCash(12_000), scalePrimaryJob(1.14)] }),
      outcome: { mergeFlags: { businessDirection: "formalized", businessEntity: true, hasSideGig: false }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, status: "self-employed", weeklyHours: 52 }, time: time(profile, { work: 52 }), wellbeing: { ...profile.wellbeing, stress: 72, burnoutRisk: 62 }, goals: addGoal(profile, { ...goal(ctx, "business-direction", "Build a resilient small business", "business"), reviewMonth: ctx.month + 12 }) }) },
    },
    {
      id: "delegate-systems",
      label: "Hire help and build systems",
      description: "Trade cash for bookkeeping, administration, or field help so the owner is not the bottleneck.",
      available: (ctx) => gate(hasFlag(ctx, "masterLicense") || hasFlag(ctx, "businessEntity"), "This requires an operating shop or business."),
      tradeoffs: { upfrontDollars: -8_000, monthlyCashFlowDollars: -500, weeklyHoursDelta: 8, health: 1, career: 2, relationships: 1 },
      effect: (ctx) => buildEffect({ id: "reflection-business-or-stability", domain: "business", optionId: "delegate-systems", label: "Hired help and systematized the business", month: ctx.month, mutations: [spendCash(8_000)] }),
      outcome: { mergeFlags: { businessDirection: "delegate", businessHasHelp: true }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, status: "self-employed", weeklyHours: 44 }, time: time(profile, { work: 44 }), wellbeing: { ...profile.wellbeing, stress: Math.max(0, profile.wellbeing.stress - 12), burnoutRisk: Math.max(0, profile.wellbeing.burnoutRisk - 15) }, goals: addGoal(profile, goal(ctx, "business-direction", "Build systems and delegate", "business")) }) },
    },
    {
      id: "close-side-gig",
      label: "Close the side gig deliberately",
      description: "Give up extra income and reclaim evenings before overload chooses for you.",
      available: (ctx) => gate(hasFlag(ctx, "hasSideGig"), "This option requires an active side gig."),
      tradeoffs: { monthlyCashFlowDollars: -900, weeklyHoursDelta: 8, health: 2, career: -1, relationships: 2 },
      effect: (ctx) => buildEffect({ id: "reflection-business-or-stability", domain: "business", optionId: "close-side-gig", label: "Closed the side gig", month: ctx.month, mutations: [{ kind: "removeIncome", id: "side-gig" }] }),
      outcome: { mergeFlags: { businessDirection: "closed-side-gig", hasSideGig: false }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: Math.max(0, profile.work.weeklyHours - 8) }, wellbeing: { ...profile.wellbeing, stress: Math.max(0, profile.wellbeing.stress - 12), burnoutRisk: Math.max(0, profile.wellbeing.burnoutRisk - 18) }, goals: addGoal(profile, goal(ctx, "business-direction", "Protect capacity after closing side work", "wellbeing")) }) },
    },
  ],
};

const CARE_AND_SUPPORT: DecisionNode = {
  id: "reflection-care-and-support",
  category: "community",
  trigger: "reflection",
  editorKind: "care-calendar",
  storyCoverage: ["college-cs-grad-family", "direct-work-retail-family", "electrician-business-owner", "hvac-journeyman-stable", "army-gi-bill-nurse", "air-force-civilian-family"],
  title: "Design care and support",
  prompt: "Who needs time, who can help, and what support should your household pay for?",
  importance: "major",
  available: (ctx) => ageWindow(ctx, 30, 34),
  branches: [
    {
      id: "buy-capacity",
      label: "Pay for dependable support",
      description: "Use childcare, cleaning, therapy, or other professional support to protect capacity.",
      tradeoffs: { monthlyCashFlowDollars: -650, weeklyHoursDelta: 7, health: 1, career: 1, relationships: 1 },
      effect: (ctx) => buildEffect({ id: "reflection-care-and-support", domain: "care", optionId: "buy-capacity", label: "Paid for dependable care support", month: ctx.month, mutations: [setLivingCost({ monthlyDollars: ctx.profile.place.monthlyLivingCostDollars + 650 })] }),
      outcome: { mergeFlags: { carePlan: "buy-capacity" }, updateProfile: (profile, ctx) => ({ ...profile, household: { ...profile.household, weeklyCareHours: Math.max(0, profile.household.weeklyCareHours - 7) }, time: time(profile, { friends: profile.time.friends + 3 }), goals: addGoal(profile, goal(ctx, "care-plan", "Use dependable paid support", "care")) }) },
    },
    {
      id: "share-care",
      label: "Build a shared care rotation",
      description: "Make care visible and divide it across partners, family, friends, or community.",
      tradeoffs: { monthlyCashFlowDollars: -150, weeklyHoursDelta: -4, health: 0, career: 0, relationships: 2 },
      effect: (ctx) => buildEffect({ id: "reflection-care-and-support", domain: "care", optionId: "share-care", label: "Created a shared care rotation", month: ctx.month, mutations: [spendCash(1_800)] }),
      outcome: { mergeFlags: { carePlan: "shared" }, updateProfile: (profile, ctx) => ({ ...profile, household: { ...profile.household, weeklyCareHours: hasFlag(ctx, "hasChild") ? 12 : 5 }, wellbeing: { ...profile.wellbeing, socialSupport: Math.min(100, profile.wellbeing.socialSupport + 10) }, goals: addGoal(profile, goal(ctx, "care-plan", "Maintain a shared care rotation", "care")) }) },
    },
    {
      id: "flex-work",
      label: "Trade income for care time",
      description: "Reduce or flex paid work rather than hiding care inside an impossible week.",
      tradeoffs: { monthlyCashFlowDollars: -750, weeklyHoursDelta: 10, health: 1, career: -1, relationships: 2 },
      effect: (ctx) => buildEffect({ id: "reflection-care-and-support", domain: "care", optionId: "flex-work", label: "Reduced work for care responsibilities", month: ctx.month, mutations: [scalePrimaryJob(0.85)] }),
      outcome: { mergeFlags: { carePlan: "flex-work" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: Math.max(20, profile.work.weeklyHours - 10) }, household: { ...profile.household, weeklyCareHours: profile.household.weeklyCareHours + 10 }, time: time(profile, { work: Math.max(20, profile.time.work - 10) }), goals: addGoal(profile, goal(ctx, "care-plan", "Make room for care", "care")) }) },
    },
    {
      id: "strengthen-network",
      label: "Strengthen your support network",
      description: "Invest regular time in friends, neighbors, family, mentoring, or community.",
      tradeoffs: { monthlyCashFlowDollars: -150, weeklyHoursDelta: -4, health: 1, career: 0, relationships: 2 },
      effect: (ctx) => buildEffect({ id: "reflection-care-and-support", domain: "community", optionId: "strengthen-network", label: "Strengthened a local support network", month: ctx.month, mutations: [spendCash(1_800)] }),
      outcome: { mergeFlags: { carePlan: "support-network" }, updateProfile: (profile, ctx) => ({ ...profile, household: { ...profile.household, weeklyCareHours: 4 }, wellbeing: { ...profile.wellbeing, socialSupport: Math.min(100, profile.wellbeing.socialSupport + 20) }, goals: addGoal(profile, goal(ctx, "care-plan", "Strengthen local support", "community")) }) },
    },
  ],
};

const RESILIENCE_PLAN: DecisionNode = {
  id: "reflection-resilience-plan",
  category: "health",
  trigger: "reflection",
  editorKind: "risk-planner",
  storyCoverage: ["college-cs-grad-family", "direct-work-retail-family", "hvac-journeyman-stable", "army-gi-bill-nurse"],
  title: "Build resilience before the next shock",
  prompt: "How much cash flow and time will you trade for health, recovery, and financial protection?",
  importance: "major",
  available: (ctx) => ageWindow(ctx, 33, 36),
  branches: [
    {
      id: "cash-buffer",
      label: "Build a larger cash buffer",
      description: "Tighten recurring spending and target six months of runway.",
      tradeoffs: { monthlyCashFlowDollars: 180, weeklyHoursDelta: -1, health: 1, career: 0, relationships: 0 },
      effect: (ctx) => buildEffect({ id: "reflection-resilience-plan", domain: "financial", optionId: "cash-buffer", label: "Built a larger resilience buffer", month: ctx.month, mutations: [scaleLiving(0.9)] }),
      outcome: { mergeFlags: { resiliencePlan: "cash-buffer" }, updateProfile: (profile, ctx) => ({ ...profile, goals: addGoal(profile, goal(ctx, "resilience", "Build six months of runway", "financial")) }) },
    },
    {
      id: "health-capacity",
      label: "Invest in health capacity",
      description: "Fund preventive care, therapy, recovery, or fitness and reserve time to use it.",
      tradeoffs: { monthlyCashFlowDollars: -250, weeklyHoursDelta: -4, health: 2, career: 1, relationships: 1 },
      effect: (ctx) => buildEffect({ id: "reflection-resilience-plan", domain: "health", optionId: "health-capacity", label: "Invested in preventive health and capacity", month: ctx.month, mutations: [spendCash(3_000)] }),
      outcome: { mergeFlags: { resiliencePlan: "health-capacity" }, updateProfile: (profile, ctx) => ({ ...profile, time: time(profile, { fitness: 7, sleep: 58 }), wellbeing: { ...profile.wellbeing, stress: Math.max(0, profile.wellbeing.stress - 15), burnoutRisk: Math.max(0, profile.wellbeing.burnoutRisk - 20) }, goals: addGoal(profile, goal(ctx, "resilience", "Protect health capacity", "health")) }) },
    },
    {
      id: "balanced-protection",
      label: "Balance protection and present life",
      description: "Split available margin across emergency savings, health, and relationships.",
      tradeoffs: { monthlyCashFlowDollars: -300, weeklyHoursDelta: -2, health: 1, career: 0, relationships: 1 },
      effect: (ctx) => buildEffect({ id: "reflection-resilience-plan", domain: "wellbeing", optionId: "balanced-protection", label: "Balanced financial and health protection", month: ctx.month, mutations: [spendCash(3_600)] }),
      outcome: { mergeFlags: { resiliencePlan: "balanced" }, updateProfile: (profile, ctx) => ({ ...profile, wellbeing: { ...profile.wellbeing, stress: Math.max(0, profile.wellbeing.stress - 8), socialSupport: Math.min(100, profile.wellbeing.socialSupport + 8) }, goals: addGoal(profile, goal(ctx, "resilience", "Balance protection and present life", "wellbeing")) }) },
    },
  ],
};

const CAREER_RECALIBRATION: DecisionNode = {
  id: "reflection-career-recalibration",
  category: "career",
  trigger: "reflection",
  editorKind: "career-scenario",
  storyCoverage: ["direct-work-tech-mobile", "electrician-business-owner", "hvac-journeyman-stable", "air-force-civilian-family", "gap-year-sales-independent"],
  title: "Recalibrate your career",
  prompt: "Do you deepen your craft, lead, pivot, build a business, or protect sustainability?",
  importance: "major",
  available: (ctx) => ctx.stage === "working" ? ageWindow(ctx, 35, 38) : gate(false, "This review is for an active civilian career."),
  branches: [
    {
      id: "deepen-specialty",
      label: "Deepen your specialty",
      description: "Build an advanced credential, portfolio, or craft specialization.",
      tradeoffs: { upfrontDollars: -3_000, weeklyHoursDelta: -6, health: -1, career: 2, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-career-recalibration", domain: "career", optionId: "deepen-specialty", label: "Deepened a career specialty", month: ctx.month, mutations: [spendCash(3_000), scalePrimaryJob(1.12)] }),
      outcome: { mergeFlags: { careerDirection: "specialist" }, updateProfile: (profile, ctx) => ({ ...profile, time: time(profile, { study: 6 }), goals: addGoal(profile, goal(ctx, "career-direction", "Deepen a specialty", "career")) }) },
    },
    {
      id: "lead-people",
      label: "Pursue leadership",
      description: "Take responsibility for people, systems, and harder decisions.",
      tradeoffs: { monthlyCashFlowDollars: 700, weeklyHoursDelta: -6, health: -1, career: 2, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-career-recalibration", domain: "career", optionId: "lead-people", label: "Pursued people leadership", month: ctx.month, mutations: [scalePrimaryJob(1.15)] }),
      outcome: { mergeFlags: { careerDirection: "leadership" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: 46 }, time: time(profile, { work: 46 }), goals: addGoal(profile, goal(ctx, "career-direction", "Grow as a people leader", "career")) }) },
    },
    {
      id: "pivot-fields",
      label: "Retrain into a different field",
      description: "Accept a temporary income dip and substantial study load for a new direction.",
      tradeoffs: { upfrontDollars: -8_000, monthlyCashFlowDollars: -700, weeklyHoursDelta: -10, health: -1, career: 2, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-career-recalibration", domain: "career", optionId: "pivot-fields", label: "Started a career pivot", month: ctx.month, mutations: [spendCash(8_000), scalePrimaryJob(0.85)] }),
      outcome: { mergeFlags: { careerDirection: "pivot", retraining: true }, updateProfile: (profile, ctx) => ({ ...profile, time: time(profile, { work: 32, study: 12 }), goals: addGoal(profile, { ...goal(ctx, "career-direction", "Complete a two-year career pivot", "career"), reviewMonth: ctx.month + 24 }) }) },
    },
    {
      id: "sustainable-role",
      label: "Optimize for sustainability",
      description: "Prefer stable hours and flexibility over the next title.",
      tradeoffs: { monthlyCashFlowDollars: -250, weeklyHoursDelta: 6, health: 2, career: 0, relationships: 1 },
      effect: (ctx) => buildEffect({ id: "reflection-career-recalibration", domain: "career", optionId: "sustainable-role", label: "Optimized work for sustainability", month: ctx.month, mutations: [scalePrimaryJob(0.95)] }),
      outcome: { mergeFlags: { careerDirection: "sustainable" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: 34 }, time: time(profile, { work: 34, sleep: 58, fitness: 6 }), wellbeing: { ...profile.wellbeing, stress: 25, burnoutRisk: 12 }, goals: addGoal(profile, goal(ctx, "career-direction", "Protect sustainable work", "wellbeing")) }) },
    },
  ],
};

const LOCATION_RESET: DecisionNode = {
  id: "reflection-location-reset",
  category: "housing",
  trigger: "reflection",
  editorKind: "housing-comparison",
  storyCoverage: ["direct-work-tech-mobile", "college-nursing-to-public-health", "gap-year-sales-independent"],
  title: "Reset location and commute",
  prompt: "Would a different place buy you money, time, opportunity, or support?",
  importance: "major",
  available: (ctx) => ctx.stage !== "military" ? ageWindow(ctx, 37, 39) : gate(false, "Active service determines location right now."),
  branches: [
    {
      id: "stay-optimize",
      label: "Stay and optimize daily routes",
      description: "Keep the current home and make smaller commute and neighborhood improvements.",
      tradeoffs: { monthlyCashFlowDollars: -50, weeklyHoursDelta: 1, health: 0, career: 0, relationships: 0 },
      effect: (ctx) => buildEffect({ id: "reflection-location-reset", domain: "housing", optionId: "stay-optimize", label: "Optimized the current home base", month: ctx.month, mutations: [spendCash(600)] }),
      outcome: { mergeFlags: { locationPlan: "stay-optimize" }, updateProfile: (profile, ctx) => ({ ...profile, time: time(profile, { transit: Math.max(0, profile.time.transit - 1) }), goals: addGoal(profile, goal(ctx, "location", "Improve the current home base", "housing")) }) },
    },
    {
      id: "move-near-opportunity",
      label: "Move near work and daily needs",
      description: "Pay more for access and reclaim weekly transit time.",
      tradeoffs: { upfrontDollars: -5_000, monthlyCashFlowDollars: -500, weeklyHoursDelta: 6, health: 1, career: 1, relationships: 0 },
      effect: (ctx) => buildEffect({ id: "reflection-location-reset", domain: "housing", optionId: "move-near-opportunity", label: "Moved closer to work and daily needs", month: ctx.month, mutations: [spendCash(5_000), setLivingCost({ monthlyDollars: ctx.profile.place.monthlyLivingCostDollars + 500 })] }),
      outcome: { mergeFlags: { locationPlan: "opportunity-center" }, updateProfile: (profile, ctx) => ({ ...profile, place: { ...profile.place, locationPattern: "opportunity-center", monthlyLivingCostDollars: profile.place.monthlyLivingCostDollars + 500 }, time: time(profile, { transit: Math.max(1, profile.time.transit - 6) }), goals: addGoal(profile, goal(ctx, "location", "Use place to reclaim time", "housing")) }) },
    },
    {
      id: "move-near-support",
      label: "Move near trusted support",
      description: "Choose proximity to family, friends, or community even if career access changes.",
      tradeoffs: { upfrontDollars: -6_000, monthlyCashFlowDollars: -150, weeklyHoursDelta: -2, health: 1, career: -1, relationships: 2 },
      effect: (ctx) => buildEffect({ id: "reflection-location-reset", domain: "housing", optionId: "move-near-support", label: "Moved closer to a support network", month: ctx.month, mutations: [spendCash(6_000)] }),
      outcome: { mergeFlags: { locationPlan: "support-network" }, updateProfile: (profile, ctx) => ({ ...profile, place: { ...profile.place, locationPattern: "support-network" }, wellbeing: { ...profile.wellbeing, socialSupport: Math.min(100, profile.wellbeing.socialSupport + 20) }, goals: addGoal(profile, goal(ctx, "location", "Live near trusted support", "community")) }) },
    },
    {
      id: "lower-cost-base",
      label: "Choose a lower-cost home base",
      description: "Trade some access for a stronger monthly margin and more housing flexibility.",
      tradeoffs: { upfrontDollars: -4_000, monthlyCashFlowDollars: 700, weeklyHoursDelta: -4, health: 0, career: -1, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "reflection-location-reset", domain: "housing", optionId: "lower-cost-base", label: "Moved to a lower-cost home base", month: ctx.month, mutations: [spendCash(4_000), scaleLiving(0.78)] }),
      outcome: { mergeFlags: { locationPlan: "lower-cost" }, updateProfile: (profile, ctx) => ({ ...profile, place: { ...profile.place, locationPattern: "lower-cost", monthlyLivingCostDollars: Math.round(profile.place.monthlyLivingCostDollars * 0.78) }, time: time(profile, { transit: profile.time.transit + 4 }), goals: addGoal(profile, goal(ctx, "location", "Use a lower-cost home base", "housing")) }) },
    },
  ],
};

const NEXT_CHAPTER: DecisionNode = {
  id: "reflection-next-chapter",
  category: "lifestyle",
  trigger: "reflection",
  editorKind: "multi-domain-plan",
  storyCoverage: ["college-cs-grad-family", "college-nursing-to-public-health", "direct-work-retail-family", "direct-work-tech-mobile", "electrician-business-owner", "hvac-journeyman-stable", "army-gi-bill-nurse", "air-force-civilian-family", "gap-year-business-degree", "gap-year-sales-independent"],
  title: "Choose what the next chapter optimizes for",
  prompt: "At forty, what deserves more of your money, time, and attention?",
  importance: "major",
  available: (ctx) => ageWindow(ctx, 40, 40),
  branches: [
    { id: "health-first", label: "Put health and capacity first", description: "Reduce load and rebuild sleep, movement, and preventive care.", tradeoffs: { monthlyCashFlowDollars: -500, weeklyHoursDelta: 8, health: 2, career: -1, relationships: 1 }, effect: (ctx) => buildEffect({ id: "reflection-next-chapter", domain: "lifestyle", optionId: "health-first", label: "Made health the next-chapter priority", month: ctx.month, mutations: [scalePrimaryJob(0.9)] }), outcome: { mergeFlags: { nextChapter: "health" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: 32 }, time: time(profile, { work: 32, sleep: 60, fitness: 8 }), wellbeing: { ...profile.wellbeing, stress: 20, burnoutRisk: 10 }, goals: addGoal(profile, { ...goal(ctx, "next-chapter", "Rebuild health and capacity", "health"), reviewMonth: ctx.month + 24 }) }) } },
    { id: "career-reinvention", label: "Begin a career reinvention", description: "Start a two-year learning and transition plan.", tradeoffs: { upfrontDollars: -10_000, weeklyHoursDelta: -10, health: -1, career: 2, relationships: -1 }, effect: (ctx) => buildEffect({ id: "reflection-next-chapter", domain: "career", optionId: "career-reinvention", label: "Began a midlife career reinvention", month: ctx.month, mutations: [spendCash(10_000)] }), outcome: { mergeFlags: { nextChapter: "career-reinvention" }, updateProfile: (profile, ctx) => ({ ...profile, time: time(profile, { study: 10, work: Math.max(25, profile.time.work - 5) }), goals: addGoal(profile, { ...goal(ctx, "next-chapter", "Complete a career reinvention", "career"), reviewMonth: ctx.month + 24 }) }) } },
    { id: "community-family", label: "Shift toward people and community", description: "Move recurring time from paid work into care, relationships, and civic life.", tradeoffs: { monthlyCashFlowDollars: -400, weeklyHoursDelta: 5, health: 1, career: -1, relationships: 2 }, effect: (ctx) => buildEffect({ id: "reflection-next-chapter", domain: "community", optionId: "community-family", label: "Shifted time toward people and community", month: ctx.month, mutations: [scalePrimaryJob(0.92)] }), outcome: { mergeFlags: { nextChapter: "community" }, updateProfile: (profile, ctx) => ({ ...profile, work: { ...profile.work, weeklyHours: Math.max(25, profile.work.weeklyHours - 5) }, household: { ...profile.household, weeklyCareHours: profile.household.weeklyCareHours + 5 }, wellbeing: { ...profile.wellbeing, socialSupport: Math.min(100, profile.wellbeing.socialSupport + 20) }, goals: addGoal(profile, { ...goal(ctx, "next-chapter", "Invest in people and community", "community"), reviewMonth: ctx.month + 24 }) }) } },
    { id: "stay-course", label: "Stay the course with small improvements", description: "Keep the current structure and choose a few sustainable upgrades.", tradeoffs: { monthlyCashFlowDollars: -100, weeklyHoursDelta: -2, health: 1, career: 0, relationships: 1 }, effect: (ctx) => buildEffect({ id: "reflection-next-chapter", domain: "lifestyle", optionId: "stay-course", label: "Improved the current path", month: ctx.month, mutations: [spendCash(1_200)] }), outcome: { mergeFlags: { nextChapter: "stay-course" }, updateProfile: (profile, ctx) => ({ ...profile, time: time(profile, { fitness: profile.time.fitness + 2 }), goals: addGoal(profile, { ...goal(ctx, "next-chapter", "Improve the current path", "lifestyle"), reviewMonth: ctx.month + 24 }) }) } },
  ],
};

/** Critique-driven decisions shared across stories rather than hard-coded story-only branches. */
export const STORY_REFLECTION_NODES: readonly DecisionNode[] = [
  STUDENT_FUNDING,
  MILITARY_SERVICE_DESIGN,
  SUSTAINABLE_WORK,
  HOUSEHOLD_DIRECTION,
  BUSINESS_OR_STABILITY,
  CARE_AND_SUPPORT,
  RESILIENCE_PLAN,
  CAREER_RECALIBRATION,
  LOCATION_RESET,
  NEXT_CHAPTER,
];
