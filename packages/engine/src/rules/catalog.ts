import { cents } from "../money/index.js";
import { buyCar, buyHome, changeContributionRate, haveChild, marry } from "../events/catalog.js";
import { allOf, eligible, flag, gate, hasFlag, moneyGate, monthsInStage, numberFlag, type LifeContext } from "./context.js";
import type { DecisionBranch, DecisionNode, LifeGraph } from "./graph.js";
import { buildEffect, clearPrimaryJob, dropTuition, gainCash, scaleLiving, scalePrimaryJob, setLivingCost, setPrimaryJob, setTuition, spendCash } from "./effects.js";
import { STORY_REFLECTION_NODES } from "./story-decisions.js";

/**
 * The age-18 "life after high school" decision tree — the concrete `LifeGraph`
 * the pathway simulator walks. It is intentionally a *spine of milestones*
 * (choose a path → specialize → reach a credential) surrounded by *optional
 * opportunities* (swap major, get a certification, buy a home), so most years
 * pass without a forced decision while the pivotal moments still demand one.
 *
 * Assumes a seed snapshot using the ids in effects.ts: a primary income `job`
 * and a cost-of-living expense `living`. See rules/README.md.
 */

const GRAD_MONTHS = 48; // a four-year degree
const GRAD_SCHOOL_MONTHS = 24; // a two-year, part-time master's

interface MajorSpec {
  key: string;
  label: string;
  tuitionMonthly: number;
  gradSalaryMonthly: number;
  gradGrowth: number;
}

const MAJORS: readonly MajorSpec[] = [
  { key: "nursing", label: "Nursing", tuitionMonthly: 1_400, gradSalaryMonthly: 6_200, gradGrowth: 0.03 },
  { key: "computer-science", label: "Computer Science", tuitionMonthly: 1_600, gradSalaryMonthly: 8_000, gradGrowth: 0.04 },
  { key: "business", label: "Business", tuitionMonthly: 1_500, gradSalaryMonthly: 5_500, gradGrowth: 0.035 },
  { key: "liberal-arts", label: "Liberal Arts", tuitionMonthly: 1_300, gradSalaryMonthly: 4_200, gradGrowth: 0.03 },
  { key: "accounting", label: "Accounting", tuitionMonthly: 1_450, gradSalaryMonthly: 5_900, gradGrowth: 0.034 },
  { key: "mechanical-engineering", label: "Mechanical Engineering", tuitionMonthly: 1_750, gradSalaryMonthly: 7_400, gradGrowth: 0.036 },
  { key: "education", label: "Education", tuitionMonthly: 1_250, gradSalaryMonthly: 4_500, gradGrowth: 0.028 },
  { key: "psychology", label: "Psychology", tuitionMonthly: 1_350, gradSalaryMonthly: 4_600, gradGrowth: 0.03 },
  { key: "biology", label: "Biology", tuitionMonthly: 1_500, gradSalaryMonthly: 5_100, gradGrowth: 0.032 },
  { key: "communications", label: "Communications", tuitionMonthly: 1_300, gradSalaryMonthly: 4_800, gradGrowth: 0.032 },
  { key: "criminal-justice", label: "Criminal Justice", tuitionMonthly: 1_250, gradSalaryMonthly: 4_900, gradGrowth: 0.029 },
  { key: "economics", label: "Economics", tuitionMonthly: 1_550, gradSalaryMonthly: 6_300, gradGrowth: 0.038 },
  { key: "graphic-design", label: "Graphic Design", tuitionMonthly: 1_450, gradSalaryMonthly: 4_700, gradGrowth: 0.034 },
  { key: "cybersecurity", label: "Cybersecurity", tuitionMonthly: 1_650, gradSalaryMonthly: 7_600, gradGrowth: 0.042 },
  { key: "data-science", label: "Data Science", tuitionMonthly: 1_700, gradSalaryMonthly: 8_200, gradGrowth: 0.043 },
  { key: "social-work", label: "Social Work", tuitionMonthly: 1_250, gradSalaryMonthly: 4_300, gradGrowth: 0.028 },
  { key: "public-health", label: "Public Health", tuitionMonthly: 1_450, gradSalaryMonthly: 5_300, gradGrowth: 0.033 },
  { key: "finance", label: "Finance", tuitionMonthly: 1_550, gradSalaryMonthly: 6_600, gradGrowth: 0.039 },
  { key: "environmental-science", label: "Environmental Science", tuitionMonthly: 1_450, gradSalaryMonthly: 5_200, gradGrowth: 0.032 },
  { key: "hospitality", label: "Hospitality Management", tuitionMonthly: 1_300, gradSalaryMonthly: 4_700, gradGrowth: 0.032 },
];

const TRADES: readonly { key: string; label: string; apprenticeMonthly: number; journeymanMonthly: number }[] = [
  { key: "electrician", label: "Electrician", apprenticeMonthly: 3_400, journeymanMonthly: 6_000 },
  { key: "plumbing", label: "Plumbing", apprenticeMonthly: 3_300, journeymanMonthly: 5_900 },
  { key: "hvac", label: "HVAC", apprenticeMonthly: 3_200, journeymanMonthly: 5_600 },
];

const SERVICE_BRANCHES: readonly { key: string; label: string; monthly: number }[] = [
  { key: "army", label: "Army", monthly: 2_800 },
  { key: "navy", label: "Navy", monthly: 2_900 },
  { key: "air-force", label: "Air Force", monthly: 3_000 },
];

const DECLINE: DecisionBranch = {
  id: "decline",
  label: "Not now",
  description: "Stay the course — no change to your path.",
  resolution: { kind: "defer", reviewAfterMonths: 12 },
  outcome: {},
};

/** Tuition is discounted while GI-Bill benefits are active. */
function tuitionFor(ctx: LifeContext, monthly: number): number {
  return hasFlag(ctx, "giBill") ? Math.round(monthly * 0.35) : monthly;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root: life after high school
// ─────────────────────────────────────────────────────────────────────────────

const HS_LAUNCH: DecisionNode = {
  id: "hs-launch",
  category: "education",
  trigger: "milestone",
  title: "Life after high school",
  prompt: "You just finished high school. Which road do you take?",
  importance: "major",
  available: (ctx) =>
    gate(
      ctx.stage === "pre-launch" || (ctx.stage === "gap-year" && monthsInStage(ctx) >= 12),
      "This is the choice you make straight out of high school.",
    ),
  branches: [
    {
      id: "school",
      label: "Go to college",
      description: "Enroll in a degree program, work part-time, then declare a major.",
      importance: "major",
      effect: (ctx) =>
        buildEffect({
          id: "enroll",
          domain: "education",
          optionId: "school",
          label: "Enroll in college",
          month: ctx.month,
          importanceLevel: "major",
          mutations: [...setPrimaryJob({ label: "Part-time job", monthlyGrossDollars: 900, pretaxDeferralRate: 0, month: ctx.month })],
        }),
      outcome: { setStage: "school", mergeFlags: { enrolled: true }, updateProfile: (profile) => ({ ...profile, education: { ...profile.education, status: "enrolled" }, work: { ...profile.work, status: "part-time", weeklyHours: 12 } }) },
    },
    {
      id: "work",
      label: "Start working",
      description: "Go straight into the workforce and pick an entry-level track.",
      importance: "major",
      outcome: { setStage: "working", mergeFlags: { wentToWork: true }, updateProfile: (profile) => ({ ...profile, work: { ...profile.work, status: "full-time", weeklyHours: 40 } }) },
    },
    {
      id: "trade",
      label: "Enter a trade apprenticeship",
      description: "Earn while you learn a licensed trade, then test for your ticket.",
      importance: "major",
      outcome: { setStage: "apprenticeship" },
    },
    {
      id: "military",
      label: "Enlist in the military",
      description: "Serve a term with housing covered; open the GI Bill for later.",
      importance: "major",
      outcome: { setStage: "military", mergeFlags: { enlisted: true }, updateProfile: (profile) => ({ ...profile, work: { ...profile.work, status: "service", weeklyHours: 50 }, place: { ...profile.place, housingTenure: "provided" } }) },
    },
    {
      id: "gap-year",
      label: "Take a gap year",
      description: "Travel and think it over. You'll choose again next year.",
      available: (ctx) => gate(!hasFlag(ctx, "tookGapYear"), "You've already taken a gap year."),
      effect: (ctx) =>
        buildEffect({
          id: "gap-year",
          domain: "lifestyle",
          optionId: "gap-year",
          label: "Take a gap year",
          month: ctx.month,
          mutations: [spendCash(6_000)],
        }),
      outcome: { setStage: "gap-year", mergeFlags: { tookGapYear: true }, reopen: ["hs-launch"] },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// School subtree: declare → (swap) → graduate → (grad school)
// ─────────────────────────────────────────────────────────────────────────────

function majorBranch(spec: MajorSpec, options: { swap: boolean }): DecisionBranch {
  const flags: Record<string, string | number | boolean> = { major: spec.key, gradSalary: spec.gradSalaryMonthly, gradGrowth: spec.gradGrowth };
  if (options.swap) flags["gradDelayMonths"] = 12;
  return {
    id: options.swap ? `switch-${spec.key}` : spec.key,
    label: options.swap ? `Switch to ${spec.label}` : spec.label,
    description: `Post-degree pay around ${(spec.gradSalaryMonthly / 1000).toFixed(1)}k/mo.`,
    importance: options.swap ? "minor" : "major",
    effect: (ctx) => {
      const mutations = setTuition({ monthlyDollars: tuitionFor(ctx, spec.tuitionMonthly), month: ctx.month, endMonth: ctx.stageStartedMonth + GRAD_MONTHS + (options.swap ? 12 : 0) });
      return buildEffect({
        id: options.swap ? "switch-major" : "declare-major",
        domain: "education",
        optionId: spec.key,
        label: options.swap ? `Switch major to ${spec.label}` : `Declare ${spec.label}`,
        month: ctx.month,
        importanceLevel: options.swap ? "minor" : "major",
        mutations: options.swap ? [spendCash(2_000), ...mutations] : mutations,
      });
    },
    outcome: { mergeFlags: flags, updateProfile: (profile) => ({ ...profile, education: { ...profile.education, status: "enrolled", programId: spec.key } }) },
  };
}

const DECLARE_MAJOR: DecisionNode = {
  id: "declare-major",
  category: "education",
  trigger: "milestone",
  title: "Declare your major",
  prompt: "Your field of study sets the knowledge tree you'll climb — and the career it opens.",
  importance: "major",
  available: (ctx) => allOf(gate(ctx.stage === "school", "Only enrolled students declare a major."), gate(!hasFlag(ctx, "major"), "You've already declared a major.")),
  branches: MAJORS.map((spec) => majorBranch(spec, { swap: false })),
};

const SWAP_MAJOR: DecisionNode = {
  id: "swap-major",
  category: "education",
  trigger: "opportunity",
  title: "Change your major",
  prompt: "Still early enough to switch fields — it may push graduation back a year.",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "school", "You must be enrolled to switch majors."),
      gate(hasFlag(ctx, "major"), "Declare a major before you can switch it."),
      gate(monthsInStage(ctx) < 30, "It's too late in your degree to switch majors."),
    ),
  branches: [
    ...MAJORS.map((spec) => ({
      ...majorBranch(spec, { swap: true }),
      // Hide the option to "switch" to the major you already have.
      available: (ctx: LifeContext) => gate(flag(ctx, "major") !== spec.key, `You're already studying ${spec.label}.`),
    })),
    { ...DECLINE, label: "Keep my major" },
  ],
};

const GRADUATE: DecisionNode = {
  id: "graduate",
  category: "education",
  trigger: "milestone",
  title: "Graduation day",
  prompt: "Degree in hand. Time to start your career.",
  importance: "major",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "school", "You must be enrolled to graduate."),
      gate(hasFlag(ctx, "major"), "Declare a major first."),
      gate(monthsInStage(ctx) >= GRAD_MONTHS + numberFlag(ctx, "gradDelayMonths"), "You're still working toward your degree."),
    ),
  branches: [
    {
      id: "start-career",
      label: "Start your career",
      description: "Trade tuition and the part-time job for a full salary in your field.",
      importance: "major",
      effect: (ctx) =>
        buildEffect({
          id: "graduate",
          domain: "education",
          optionId: String(flag(ctx, "major") ?? "degree"),
          label: "Graduate & start career",
          month: ctx.month,
          importanceLevel: "major",
          mutations: [
            dropTuition(),
            ...setPrimaryJob({
              label: "Career (degree)",
              monthlyGrossDollars: numberFlag(ctx, "gradSalary") || 4_500,
              annualGrowthRate: numberFlag(ctx, "gradGrowth") || 0.03,
              pretaxDeferralRate: 0.06,
              month: ctx.month,
            }),
          ],
        }),
      outcome: { setStage: "working", mergeFlags: { degreeEarned: true, enrolled: false }, updateProfile: (profile) => ({ ...profile, education: { status: "completed", programId: profile.education.programId, credentials: [...profile.education.credentials, profile.education.programId ?? "degree"] }, work: { ...profile.work, status: "full-time", weeklyHours: 40 } }) },
    },
  ],
};

const GRAD_SCHOOL: DecisionNode = {
  id: "grad-school",
  category: "education",
  trigger: "opportunity",
  title: "Graduate school",
  prompt: "A master's is a two-year, part-time investment that pays off in a few years.",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "working", "Finish your degree and start working first."),
      gate(hasFlag(ctx, "degreeEarned"), "A master's needs a bachelor's first."),
      gate(!hasFlag(ctx, "gradSchool"), "You're already pursuing a master's."),
      gate(monthsInStage(ctx) <= 60, "The easy window for grad school right after your degree has passed."),
    ),
  branches: [
    {
      id: "enroll-grad",
      label: "Enroll part-time",
      description: "Pay tuition for two years; a raise lands when you finish.",
      importance: "minor",
      effect: (ctx) =>
        buildEffect({
          id: "grad-school",
          domain: "education",
          optionId: "enroll",
          label: "Enroll in grad school",
          month: ctx.month,
          importanceLevel: "minor",
          mutations: setTuition({ monthlyDollars: tuitionFor(ctx, 1_500), month: ctx.month, endMonth: ctx.month + GRAD_SCHOOL_MONTHS }),
        }),
      // gradSchoolStartMonth is only known at choice time, so it's stamped from ctx here.
      outcome: { mergeFlags: (ctx) => ({ gradSchool: true, gradSchoolStartMonth: ctx.month }) },
    },
    { ...DECLINE, label: "Skip it" },
  ],
};

const GRAD_SCHOOL_COMPLETE: DecisionNode = {
  id: "grad-school-complete",
  category: "education",
  trigger: "milestone",
  title: "Master's complete",
  prompt: "You finished the program. It bumps your earning power.",
  importance: "major",
  available: (ctx) =>
    allOf(
      gate(hasFlag(ctx, "gradSchool"), "You haven't enrolled in grad school."),
      gate(!hasFlag(ctx, "gradSchoolDone"), "You've already completed your master's."),
      gate(ctx.month - numberFlag(ctx, "gradSchoolStartMonth") >= GRAD_SCHOOL_MONTHS, "You're still in the program."),
    ),
  branches: [
    {
      id: "finish-grad",
      label: "Finish and take the raise",
      description: "Drop tuition; a master's-level salary takes over.",
      importance: "major",
      effect: (ctx) =>
        buildEffect({
          id: "grad-school-complete",
          domain: "education",
          optionId: "complete",
          label: "Complete master's",
          month: ctx.month,
          importanceLevel: "major",
          mutations: [
            dropTuition(),
            ...setPrimaryJob({
              label: "Career (master's)",
              monthlyGrossDollars: Math.round((numberFlag(ctx, "gradSalary") || 5_000) * 1.35),
              annualGrowthRate: numberFlag(ctx, "gradGrowth") || 0.03,
              pretaxDeferralRate: 0.08,
              month: ctx.month,
            }),
          ],
        }),
      outcome: { mergeFlags: { gradSchoolDone: true } },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Work-straight-out-of-HS subtree: entry track → (certification, promotion)
// ─────────────────────────────────────────────────────────────────────────────

const ENTRY_TRACKS: readonly { key: string; label: string; monthly: number; growth: number; startup: number; description: string }[] = [
  { key: "retail", label: "Retail & service", monthly: 2_600, growth: 0.025, startup: 250, description: "Steady hourly work with room to manage." },
  { key: "warehouse", label: "Warehouse & logistics", monthly: 3_200, growth: 0.03, startup: 350, description: "Higher starting pay, physical work." },
  { key: "sales", label: "Sales", monthly: 3_000, growth: 0.05, startup: 500, description: "Lower base, faster growth on commission." },
  { key: "administrative-assistant", label: "Administrative assistant", monthly: 3_150, growth: 0.03, startup: 600, description: "Organize teams, calendars, records, and customer communication." },
  { key: "customer-support", label: "Customer support", monthly: 3_050, growth: 0.031, startup: 450, description: "Solve customer problems with clear communication and product knowledge." },
  { key: "bank-teller", label: "Bank teller", monthly: 3_100, growth: 0.028, startup: 300, description: "Build financial-service experience in a structured branch environment." },
  { key: "construction-laborer", label: "Construction laborer", monthly: 3_550, growth: 0.034, startup: 900, description: "Hands-on project work with a route into specialized crews." },
  { key: "delivery-driver", label: "Delivery driver", monthly: 3_350, growth: 0.029, startup: 650, description: "Independent route work with an early start and active days." },
  { key: "medical-assistant", label: "Medical assistant", monthly: 3_450, growth: 0.034, startup: 3_800, description: "Support clinical teams and patients in a fast-moving care setting." },
  { key: "pharmacy-technician", label: "Pharmacy technician", monthly: 3_300, growth: 0.032, startup: 2_400, description: "Prepare prescriptions and build practical healthcare experience." },
  { key: "it-support", label: "IT support specialist", monthly: 3_850, growth: 0.042, startup: 1_200, description: "Troubleshoot devices and accounts with strong certification upside." },
  { key: "junior-web-developer", label: "Junior web developer", monthly: 4_250, growth: 0.048, startup: 4_500, description: "Turn a portfolio or bootcamp foundation into production experience." },
  { key: "security-officer", label: "Security officer", monthly: 3_150, growth: 0.027, startup: 700, description: "Protect people and property through alert, dependable shift work." },
  { key: "food-service", label: "Food service", monthly: 2_750, growth: 0.03, startup: 350, description: "Fast-paced team work with a path toward shift leadership." },
  { key: "childcare-assistant", label: "Childcare assistant", monthly: 2_850, growth: 0.028, startup: 900, description: "Support children and families in an energetic care environment." },
  { key: "manufacturing", label: "Manufacturing technician", monthly: 3_600, growth: 0.034, startup: 1_100, description: "Operate equipment, improve processes, and build technical skills." },
  { key: "landscaping", label: "Landscaping crew", monthly: 3_050, growth: 0.031, startup: 950, description: "Outdoor project work with a route toward crew leadership or ownership." },
  { key: "call-center", label: "Call center representative", monthly: 2_950, growth: 0.029, startup: 400, description: "High-volume service work that develops sales and communication skills." },
  { key: "bookkeeping", label: "Bookkeeping clerk", monthly: 3_500, growth: 0.035, startup: 1_600, description: "Keep small-business accounts accurate and grow through certifications." },
  { key: "real-estate", label: "Real estate assistant", monthly: 3_200, growth: 0.045, startup: 2_300, description: "Learn transactions and client service with licensing upside." },
];

const ENTRY_TRACK: DecisionNode = {
  id: "entry-track",
  category: "career",
  trigger: "milestone",
  title: "Pick your line of work",
  prompt: "No degree needed — choose where you'll start earning.",
  importance: "major",
  available: (ctx) => allOf(gate(ctx.stage === "working", "You need to be in the workforce."), gate(hasFlag(ctx, "wentToWork"), "This is for those who skipped college."), gate(!hasFlag(ctx, "track"), "You've already chosen a track.")),
  branches: ENTRY_TRACKS.map((track) => ({
    id: track.key,
    label: track.label,
    description: track.description,
    importance: "major" as const,
    tradeoffs: { upfrontDollars: -track.startup },
    effect: (ctx: LifeContext) =>
      buildEffect({
        id: "entry-track",
        domain: "career",
        optionId: track.key,
        label: `${track.label} job`,
        month: ctx.month,
        importanceLevel: "major",
        mutations: [spendCash(track.startup), ...setPrimaryJob({ label: track.label, monthlyGrossDollars: track.monthly, annualGrowthRate: track.growth, month: ctx.month })],
      }),
    outcome: { mergeFlags: { track: track.key } },
  })),
};

const WORK_CERT: DecisionNode = {
  id: "work-cert",
  category: "career",
  trigger: "opportunity",
  title: "Earn a certification",
  prompt: "A night-school certificate (CDL, IT, bookkeeping) can lift your pay.",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "working", "You must be working."),
      gate(hasFlag(ctx, "track"), "Pick a line of work first."),
      gate(!hasFlag(ctx, "certified"), "You've already earned a certification."),
      gate(monthsInStage(ctx) >= 24, "Get a couple of years of experience first."),
    ),
  branches: [
    {
      id: "get-cert",
      label: "Get certified",
      description: "Costs $4k up front; raises pay about 20%.",
      importance: "minor",
      effect: (ctx) =>
        buildEffect({
          id: "work-cert",
          domain: "career",
          optionId: "certified",
          label: "Earn a certification",
          month: ctx.month,
          importanceLevel: "minor",
          mutations: [spendCash(4_000), { kind: "patchIncomeConfig", id: "job", patch: { baseMonthlyGrossCents: cents(4_200) } }],
        }),
      outcome: { mergeFlags: { certified: true } },
    },
    { ...DECLINE, label: "Not right now" },
  ],
};

const WORK_PROMOTION: DecisionNode = {
  id: "work-promotion",
  category: "career",
  trigger: "opportunity",
  title: "Step up to management",
  prompt: "Your track record has earned a shot at a supervisor role.",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "working", "You must be working."),
      gate(hasFlag(ctx, "track"), "Pick a line of work first."),
      gate(!hasFlag(ctx, "promoted"), "You've already stepped up."),
      gate(monthsInStage(ctx) >= 48, "You need more time in the role."),
    ),
  branches: [
    {
      id: "accept-promotion",
      label: "Take the promotion",
      description: "Higher pay and a steeper raise curve.",
      importance: "minor",
      effect: (ctx) =>
        buildEffect({
          id: "work-promotion",
          domain: "career",
          optionId: "promoted",
          label: "Promoted to supervisor",
          month: ctx.month,
          importanceLevel: "minor",
          mutations: setPrimaryJob({ label: "Supervisor", monthlyGrossDollars: 5_200, annualGrowthRate: 0.035, pretaxDeferralRate: 0.05, month: ctx.month }),
        }),
      outcome: { mergeFlags: { promoted: true } },
    },
    { ...DECLINE, label: "Stay where I am" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Trade subtree: choose trade → journeyman ticket → (master license)
// ─────────────────────────────────────────────────────────────────────────────

const APPRENTICESHIP_TRADE: DecisionNode = {
  id: "apprenticeship-trade",
  category: "career",
  trigger: "milestone",
  title: "Choose your trade",
  prompt: "Pick the craft you'll apprentice in. You'll test for your ticket in a few years.",
  importance: "major",
  available: (ctx) => allOf(gate(ctx.stage === "apprenticeship", "You must be in an apprenticeship."), gate(!hasFlag(ctx, "trade"), "You've already chosen a trade.")),
  branches: TRADES.map((trade) => ({
    id: trade.key,
    label: trade.label,
    description: `Apprentice pay around ${(trade.apprenticeMonthly / 1000).toFixed(1)}k/mo.`,
    importance: "major" as const,
    effect: (ctx: LifeContext) =>
      buildEffect({
        id: "apprenticeship-trade",
        domain: "career",
        optionId: trade.key,
        label: `${trade.label} apprentice`,
        month: ctx.month,
        importanceLevel: "major",
        mutations: setPrimaryJob({ label: `${trade.label} apprentice`, monthlyGrossDollars: trade.apprenticeMonthly, annualGrowthRate: 0.03, month: ctx.month }),
      }),
    outcome: { mergeFlags: { trade: trade.key, journeymanPay: trade.journeymanMonthly } },
  })),
};

const JOURNEYMAN_TICKET: DecisionNode = {
  id: "journeyman-ticket",
  category: "career",
  trigger: "milestone",
  title: "Earn your ticket",
  prompt: "You've logged enough hours to test for your journeyman license.",
  importance: "major",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "apprenticeship", "You must be an apprentice."),
      gate(hasFlag(ctx, "trade"), "Choose a trade first."),
      gate(monthsInStage(ctx) >= 36, "You haven't logged enough apprentice hours yet."),
    ),
  branches: [
    {
      id: "pass-ticket",
      label: "Pass the exam & get licensed",
      description: "A licensed journeyman earns substantially more.",
      importance: "major",
      effect: (ctx) =>
        buildEffect({
          id: "journeyman-ticket",
          domain: "career",
          optionId: "journeyman",
          label: "Earn journeyman ticket",
          month: ctx.month,
          importanceLevel: "major",
          mutations: [spendCash(1_200), ...setPrimaryJob({ label: `Journeyman ${String(flag(ctx, "trade") ?? "tradesperson")}`, monthlyGrossDollars: numberFlag(ctx, "journeymanPay") || 5_800, annualGrowthRate: 0.03, pretaxDeferralRate: 0.05, month: ctx.month })],
        }),
      outcome: { setStage: "working", mergeFlags: { ticket: true } },
    },
  ],
};

const MASTER_LICENSE: DecisionNode = {
  id: "master-license",
  category: "career",
  trigger: "opportunity",
  title: "Go out on your own",
  prompt: "With a master license you could run your own shop — more upside, more risk.",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "working", "Get licensed and working first."),
      gate(hasFlag(ctx, "ticket"), "You need your journeyman ticket first."),
      gate(!hasFlag(ctx, "masterLicense"), "You already run your own shop."),
      gate(monthsInStage(ctx) >= 48, "Build a few more years as a journeyman first."),
    ),
  branches: [
    {
      id: "start-shop",
      label: "Get master license & start a business",
      description: "Costs $8k to set up; strong income with a faster growth curve.",
      importance: "minor",
      effect: (ctx) =>
        buildEffect({
          id: "master-license",
          domain: "career",
          optionId: "master",
          label: "Master license — own business",
          month: ctx.month,
          importanceLevel: "minor",
          mutations: [spendCash(8_000), ...setPrimaryJob({ label: `${String(flag(ctx, "trade") ?? "Trade")} business owner`, monthlyGrossDollars: 8_500, annualGrowthRate: 0.05, pretaxDeferralRate: 0.05, month: ctx.month })],
        }),
      outcome: { mergeFlags: { masterLicense: true } },
    },
    { ...DECLINE, label: "Keep working as a journeyman" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Military subtree: choose branch → post-service (GI Bill school or civilian)
// ─────────────────────────────────────────────────────────────────────────────

const MILITARY_BRANCH: DecisionNode = {
  id: "military-branch",
  category: "military",
  trigger: "milestone",
  title: "Choose your branch",
  prompt: "Which branch will you serve in? Housing and benefits are covered.",
  importance: "major",
  available: (ctx) => allOf(gate(ctx.stage === "military", "You must be enlisting."), gate(!hasFlag(ctx, "serviceBranch"), "You've already chosen a branch.")),
  branches: SERVICE_BRANCHES.map((service) => ({
    id: service.key,
    label: service.label,
    description: `Service pay around ${(service.monthly / 1000).toFixed(1)}k/mo with housing covered.`,
    importance: "major" as const,
    effect: (ctx: LifeContext) =>
      buildEffect({
        id: "military-branch",
        domain: "military",
        optionId: service.key,
        label: `Serve in the ${service.label}`,
        month: ctx.month,
        importanceLevel: "major",
        mutations: [...setPrimaryJob({ label: `${service.label} service`, monthlyGrossDollars: service.monthly, annualGrowthRate: 0.03, pretaxDeferralRate: 0.05, month: ctx.month }), setLivingCost({ monthlyDollars: 900 })],
      }),
    outcome: { mergeFlags: { serviceBranch: service.key }, updateProfile: (profile) => ({ ...profile, work: { ...profile.work, status: "service", occupationId: service.key, weeklyHours: 50 } }) },
  })),
};

const POST_SERVICE: DecisionNode = {
  id: "post-service",
  category: "military",
  trigger: "milestone",
  title: "End of your service term",
  prompt: "Your enlistment is up. What comes next?",
  importance: "major",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "military", "You must be serving."),
      gate(hasFlag(ctx, "serviceBranch"), "Choose a branch first."),
      gate(monthsInStage(ctx) >= 48, "Your service term isn't over yet."),
    ),
  branches: [
    {
      id: "gi-bill-school",
      label: "Use the GI Bill for college",
      description: "Enroll with tuition largely covered, then declare a major.",
      importance: "major",
      effect: (ctx) =>
        buildEffect({
          id: "post-service",
          domain: "education",
          optionId: "gi-bill",
          label: "Separate — use GI Bill",
          month: ctx.month,
          importanceLevel: "major",
          mutations: [...setPrimaryJob({ label: "Part-time job", monthlyGrossDollars: 900, pretaxDeferralRate: 0, month: ctx.month }), setLivingCost({ monthlyDollars: 1_500 })],
        }),
      outcome: { setStage: "school", mergeFlags: { separated: true, enrolled: true, giBill: true } },
    },
    {
      id: "civilian-work",
      label: "Enter the civilian workforce",
      description: "Your service record lands a solid civilian job.",
      importance: "major",
      effect: (ctx) =>
        buildEffect({
          id: "post-service",
          domain: "career",
          optionId: "civilian",
          label: "Separate — civilian job",
          month: ctx.month,
          importanceLevel: "major",
          mutations: [...setPrimaryJob({ label: "Civilian role (veteran)", monthlyGrossDollars: 4_600, annualGrowthRate: 0.035, pretaxDeferralRate: 0.05, month: ctx.month }), setLivingCost({ monthlyDollars: 1_500 })],
        }),
      outcome: { setStage: "working", mergeFlags: { separated: true, veteranHire: true } },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Mid-life opportunities (path-independent, age-gated) — reuse engine builders
// ─────────────────────────────────────────────────────────────────────────────

const MARRIAGE: DecisionNode = {
  id: "marriage",
  category: "family",
  trigger: "opportunity",
  title: "Settling down",
  prompt: "You're thinking about marriage. How does it change the household books?",
  importance: "major",
  available: (ctx) =>
    allOf(gate(ctx.ageYears >= 26, "This tends to come a little later."), gate(ctx.stage !== "school" && ctx.stage !== "military", "Better to settle your path first."), gate(!hasFlag(ctx, "married"), "You're already married.")),
  branches: [
    {
      id: "dual",
      label: "Marry — dual income",
      description: "Partner earns ~$5.5k/mo. File jointly.",
      importance: "major",
      effect: (ctx) => marry({ effectiveFromMonth: ctx.month, spouseIncome: { id: "spouse", label: "Partner", baseMonthlyGrossCents: cents(5_500), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.05 }, weddingCostCents: cents(20_000) }),
      outcome: { mergeFlags: { married: true }, updateProfile: (profile) => ({ ...profile, household: { ...profile.household, relationshipStatus: "married" } }) },
    },
    {
      id: "single",
      label: "Marry — single income",
      description: "A partner at home. File jointly, one income.",
      importance: "major",
      effect: (ctx) => marry({ effectiveFromMonth: ctx.month, weddingCostCents: cents(16_000) }),
      outcome: { mergeFlags: { married: true }, updateProfile: (profile) => ({ ...profile, household: { ...profile.household, relationshipStatus: "married", weeklyCareHours: Math.max(10, profile.household.weeklyCareHours) } }) },
    },
    { ...DECLINE, label: "Not yet" },
  ],
};

const FIRST_HOME: DecisionNode = {
  id: "first-home",
  category: "housing",
  trigger: "opportunity",
  title: "Rent or buy?",
  prompt: "You're tired of renting. Is it time to buy your first home?",
  importance: "major",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "working" || ctx.stage === "apprenticeship", "You'll want steady income first."),
      gate(!hasFlag(ctx, "homeowner"), "You already own a home."),
      moneyGate(ctx, (f) => f.liquidCents >= cents(50_000), "You need more saved for a down payment and closing costs."),
      moneyGate(ctx, (f) => f.emergencyFundMonths >= 3, "Build a 3-month emergency fund before tying up cash in a home."),
    ),
  branches: [
    {
      id: "buy",
      label: "Buy a $320k home",
      description: "20% down, 30-year mortgage.",
      importance: "major",
      effect: (ctx) => buyHome({ id: `home-${ctx.month}`, priceCents: cents(320_000), downPaymentCents: cents(64_000), closingCostsCents: cents(9_600), mortgageAnnualRate: 0.065, termMonths: 360, monthlyEscrowCents: cents(420), monthlyMaintenanceCents: cents(280), annualAppreciationRate: 0.03, effectiveFromMonth: ctx.month }),
      outcome: { mergeFlags: { homeowner: true }, updateProfile: (profile) => ({ ...profile, place: { ...profile.place, housingTenure: "owner" } }) },
    },
    {
      id: "buy-modest",
      label: "Buy modest ($240k)",
      description: "Smaller place, more cash free.",
      importance: "major",
      effect: (ctx) => buyHome({ id: `home-${ctx.month}`, priceCents: cents(240_000), downPaymentCents: cents(48_000), closingCostsCents: cents(7_200), mortgageAnnualRate: 0.065, termMonths: 360, monthlyEscrowCents: cents(320), monthlyMaintenanceCents: cents(210), annualAppreciationRate: 0.03, effectiveFromMonth: ctx.month }),
      outcome: { mergeFlags: { homeowner: true }, updateProfile: (profile) => ({ ...profile, place: { ...profile.place, housingTenure: "owner" } }) },
    },
    { ...DECLINE, label: "Keep renting" },
  ],
};

const FIRST_CHILD: DecisionNode = {
  id: "first-child",
  category: "family",
  trigger: "opportunity",
  title: "Starting a family",
  prompt: "A child brings years of childcare costs. Are you ready?",
  importance: "major",
  available: (ctx) => allOf(gate(ctx.ageYears >= 28, "This usually comes a bit later."), gate(hasFlag(ctx, "married"), "Comes after settling down."), gate(!hasFlag(ctx, "hasChild"), "You already have a child in the model.")),
  branches: [
    {
      id: "yes",
      label: "Have a child",
      description: "~$1.5k/mo childcare for about five years.",
      importance: "major",
      effect: (ctx) => haveChild({ childId: `kid-${ctx.month}`, effectiveFromMonth: ctx.month, oneTimeBirthCostCents: cents(6_000), monthlyChildcareCents: cents(1_500), childcareEndMonth: ctx.month + 60 }),
      outcome: { mergeFlags: { hasChild: true }, updateProfile: (profile) => ({ ...profile, household: { ...profile.household, dependents: profile.household.dependents + 1, weeklyCareHours: profile.household.weeklyCareHours + 20 } }) },
    },
    { ...DECLINE, label: "Not now" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Threshold opportunities (money-gated) — fill the years between launch and 65
// ─────────────────────────────────────────────────────────────────────────────

const BUY_CAR: DecisionNode = {
  id: "buy-car",
  category: "lifestyle",
  trigger: "opportunity",
  title: "Get a car",
  prompt: "A car opens up where you can work and live. Buy in cash, or finance it?",
  importance: "major",
  available: (ctx) =>
    allOf(
      gate(!hasFlag(ctx, "hasCar"), "You already have a car."),
      gate(ctx.stage === "working" || ctx.stage === "apprenticeship" || ctx.stage === "military", "You'll want income before taking one on."),
      moneyGate(ctx, (f) => f.cashCents >= cents(6_000) && f.emergencyFundMonths >= 2, "Keep a little more cash on hand first."),
    ),
  branches: [
    {
      id: "used-cash",
      label: "Buy a used car in cash ($12k)",
      description: "No loan, no interest — the frugal move.",
      importance: "major",
      effect: (ctx) => buyCar({ id: `car-${ctx.month}`, label: "Used car", priceCents: cents(12_000), downPaymentCents: cents(12_000), monthlyInsuranceCents: cents(130), effectiveFromMonth: ctx.month }),
      outcome: { mergeFlags: { hasCar: true } },
    },
    {
      id: "used-finance",
      label: "Finance a used car ($18k, $3k down)",
      description: "A 5-year loan at ~7%.",
      importance: "major",
      effect: (ctx) => buyCar({ id: `car-${ctx.month}`, label: "Used car", priceCents: cents(18_000), downPaymentCents: cents(3_000), loanAnnualRate: 0.07, loanTermMonths: 60, monthlyInsuranceCents: cents(150), effectiveFromMonth: ctx.month }),
      outcome: { mergeFlags: { hasCar: true } },
    },
    {
      id: "new-finance",
      label: "Finance a new car ($32k, $5k down)",
      description: "Reliable and new, but it depreciates fast.",
      importance: "major",
      effect: (ctx) => buyCar({ id: `car-${ctx.month}`, label: "New car", priceCents: cents(32_000), downPaymentCents: cents(5_000), loanAnnualRate: 0.065, loanTermMonths: 72, monthlyInsuranceCents: cents(200), effectiveFromMonth: ctx.month }),
      outcome: { mergeFlags: { hasCar: true } },
    },
    { ...DECLINE, label: "Stick with transit" },
  ],
};

const BOOST_RETIREMENT: DecisionNode = {
  id: "boost-retirement",
  category: "financial",
  trigger: "opportunity",
  title: "Boost your retirement savings",
  prompt: "You're saving less than the future you would like. Raise your 401(k) contribution?",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.stage === "working", "This applies once you're earning a full income."),
      gate(!hasFlag(ctx, "retirementBoosted"), "You've already boosted your rate."),
      moneyGate(ctx, (f) => f.savingsRate < 0.15 && f.monthlyGrossCents >= cents(4_000), "Your savings rate already looks healthy."),
    ),
  branches: [
    {
      id: "boost",
      label: "Raise 401(k) to 15%",
      description: "More goes in pretax — less take-home now, much more later.",
      importance: "minor",
      effect: (ctx) => changeContributionRate({ incomeId: "job", newDeferralRate: 0.15, effectiveFromMonth: ctx.month }),
      outcome: { mergeFlags: { retirementBoosted: true } },
    },
    { ...DECLINE, label: "Keep it where it is" },
  ],
};

const BUILD_EMERGENCY: DecisionNode = {
  id: "build-emergency",
  category: "financial",
  trigger: "opportunity",
  title: "Build an emergency fund",
  prompt: "Your cushion is thin. Trim spending for a while to build a few months of runway?",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.stage !== "school", "Wait until you're earning to focus on runway."),
      gate(!hasFlag(ctx, "emergencyFocus"), "You're already focused on your emergency fund."),
      moneyGate(ctx, (f) => f.emergencyFundMonths < 3, "Your runway already covers 3+ months."),
    ),
  branches: [
    {
      id: "tighten",
      label: "Trim spending 8% to build runway",
      description: "A temporary belt-tightening that pads your cash.",
      importance: "minor",
      effect: (ctx) => buildEffect({ id: "build-emergency", domain: "financial", optionId: "tighten", label: "Tightened spending to build runway", month: ctx.month, mutations: [scaleLiving(0.92)] }),
      outcome: { mergeFlags: { emergencyFocus: true } },
    },
    { ...DECLINE, label: "Not right now" },
  ],
};

const RETIREMENT_CATCHUP: DecisionNode = {
  id: "retirement-catchup",
  category: "financial",
  trigger: "opportunity",
  title: "Catch-up contributions",
  prompt: "Past 50, the IRS lets you save even more pretax. Max it out?",
  importance: "minor",
  available: (ctx) =>
    allOf(
      gate(ctx.ageYears >= 50, "Catch-up contributions unlock at 50."),
      gate(ctx.stage === "working", "This applies while you're still earning."),
      gate(!hasFlag(ctx, "catchUp"), "You're already maxing catch-up contributions."),
    ),
  branches: [
    {
      id: "maximize",
      label: "Max out with catch-up (20%)",
      description: "Push hard in your peak-earning years.",
      importance: "minor",
      effect: (ctx) => changeContributionRate({ incomeId: "job", newDeferralRate: 0.2, effectiveFromMonth: ctx.month }),
      outcome: { mergeFlags: { catchUp: true } },
    },
    { ...DECLINE, label: "Keep my current rate" },
  ],
};

const RETIRE: DecisionNode = {
  id: "retire",
  category: "financial",
  trigger: "milestone",
  title: "Time to retire",
  prompt: "You've reached retirement age. Step away from work and live off what you've built.",
  importance: "major",
  available: (ctx) => allOf(gate(ctx.ageYears >= 65, "Retirement age is 65 in this model."), gate(ctx.stage !== "retired" && ctx.stage !== "school", "Not while you're still on another path.")),
  branches: [
    {
      id: "retire",
      label: "Retire",
      description: "Income stops; your portfolio and savings carry you now.",
      importance: "major",
      effect: (ctx) =>
        buildEffect({
          id: "retire",
          domain: "financial",
          optionId: "retire",
          label: "Retired",
          month: ctx.month,
          importanceLevel: "major",
          mutations: [clearPrimaryJob(), { kind: "removeIncome", id: "spouse" }],
        }),
      outcome: { setStage: "retired", mergeFlags: { retired: true } },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Random events — the RNG "life happens" simulator (rolled once per year)
// ─────────────────────────────────────────────────────────────────────────────

/** A must-handle expense shock: one mandatory branch that spends cash. */
function randomForcedCost(p: { id: string; category: DecisionNode["category"]; title: string; prompt: string; costDollars: number; chance: number; repeatable?: boolean; available?: (ctx: LifeContext) => ReturnType<typeof eligible> }): DecisionNode {
  return {
    id: p.id,
    category: p.category,
    trigger: "random",
    title: p.title,
    prompt: p.prompt,
    importance: "minor",
    chance: { annualProbability: p.chance, oncePerLife: !p.repeatable },
    available: p.available ?? (() => eligible()),
    branches: [
      {
        id: "handle",
        label: `Pay $${p.costDollars.toLocaleString()}`,
        description: "It comes out of your cash.",
        importance: "minor",
        effect: (ctx) => buildEffect({ id: p.id, domain: p.category, optionId: "handle", label: p.title, month: ctx.month, mutations: [spendCash(p.costDollars)] }),
        outcome: p.repeatable ? { reopen: [p.id] } : {},
      },
    ],
  };
}

/** A pure inflow: one branch that adds cash. */
function randomWindfall(p: { id: string; title: string; prompt: string; amountDollars: number; chance: number; repeatable?: boolean; cooldownMonths?: number; available?: (ctx: LifeContext) => ReturnType<typeof eligible> }): DecisionNode {
  return {
    id: p.id,
    category: "financial",
    trigger: "random",
    title: p.title,
    prompt: p.prompt,
    importance: "minor",
    chance: { annualProbability: p.chance, oncePerLife: !p.repeatable },
    available: p.available ?? (() => eligible()),
    branches: [
      {
        id: "take",
        label: `Add $${p.amountDollars.toLocaleString()} to your cash`,
        description: "A welcome boost.",
        importance: "minor",
        effect: (ctx) => buildEffect({ id: p.id, domain: "windfall", optionId: "take", label: p.title, month: ctx.month, mutations: [gainCash(p.amountDollars)] }),
        resolution: p.repeatable ? { kind: "repeatable", cooldownMonths: p.cooldownMonths } : undefined,
        outcome: {},
      },
    ],
  };
}

/** Decline that blocks a once-per-life event (so it never re-offers) or is inert for a repeatable one. */
function declineBranch(_nodeId: string, oncePerLife: boolean, label = "Not now"): DecisionBranch {
  return oncePerLife
    ? { id: "decline", label, description: "You pass on it.", resolution: { kind: "permanent-decline" }, outcome: {} }
    : { ...DECLINE, label };
}

const UNEMPLOYMENT_SEARCH: DecisionNode = {
  id: "unemployment-search",
  category: "career",
  trigger: "milestone",
  title: "Choose your route back into work",
  prompt: "The layoff is now a real interval. How will you search, retrain, and protect your runway?",
  importance: "major",
  editorKind: "career-scenario",
  storyCoverage: ["direct-work-retail-family", "direct-work-tech-mobile", "air-force-civilian-family"],
  available: (ctx) => gate(ctx.stage === "unemployed" && monthsInStage(ctx) >= 6, "This follows an active unemployment period."),
  branches: [
    {
      id: "comparable-role",
      label: "Search longer for a comparable role",
      description: "Use more runway to protect role quality and compensation.",
      tradeoffs: { upfrontDollars: -6_000, weeklyHoursDelta: -20, health: -1, career: 1, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "unemployment-search", domain: "career", optionId: "comparable-role", label: "Returned to a comparable role after a longer search", month: ctx.month, mutations: [spendCash(6_000), ...setPrimaryJob({ label: "New career role", monthlyGrossDollars: 4_800, month: ctx.month })] }),
      outcome: { setStage: "working", mergeFlags: { unemployed: false, lastJobSearchOutcome: "comparable-role" }, updateProfile: (profile) => ({ ...profile, work: { ...profile.work, status: "full-time", weeklyHours: 40 } }) },
    },
    {
      id: "fast-reentry",
      label: "Take a faster re-entry role",
      description: "Return sooner at lower pay and rebuild from inside the workforce.",
      tradeoffs: { weeklyHoursDelta: -30, health: 0, career: -1, relationships: 0 },
      effect: (ctx) => buildEffect({ id: "unemployment-search", domain: "career", optionId: "fast-reentry", label: "Returned to work quickly after a layoff", month: ctx.month, mutations: setPrimaryJob({ label: "Re-entry role", monthlyGrossDollars: 3_600, month: ctx.month }) }),
      outcome: { setStage: "working", mergeFlags: { unemployed: false, lastJobSearchOutcome: "fast-reentry" }, updateProfile: (profile) => ({ ...profile, work: { ...profile.work, status: "full-time", weeklyHours: 40 } }) },
    },
    {
      id: "retrain",
      label: "Retrain and change direction",
      description: "Spend more cash and time now for a portable new skill path.",
      tradeoffs: { upfrontDollars: -8_000, weeklyHoursDelta: -35, health: -1, career: 2, relationships: -1 },
      effect: (ctx) => buildEffect({ id: "unemployment-search", domain: "career", optionId: "retrain", label: "Retrained after a layoff", month: ctx.month, mutations: [spendCash(8_000), ...setPrimaryJob({ label: "New-field role", monthlyGrossDollars: 3_900, annualGrowthRate: 0.05, month: ctx.month })] }),
      outcome: { setStage: "working", mergeFlags: { unemployed: false, retrainedAfterLayoff: true, lastJobSearchOutcome: "retrain" }, updateProfile: (profile) => ({ ...profile, work: { ...profile.work, status: "full-time", weeklyHours: 40 }, education: { ...profile.education, credentials: [...profile.education.credentials, "layoff-retraining"] } }) },
    },
  ],
};

const RNG_LAYOFF: DecisionNode = {
  id: "rng-layoff",
  category: "career",
  trigger: "random",
  title: "You've been laid off",
  prompt: "Your role was cut. How do you handle the gap?",
  importance: "major",
  chance: { annualProbability: 0.04, oncePerLife: true },
  available: (ctx) => allOf(gate(ctx.stage === "working", "Only affects the employed."), moneyGate(ctx, (f) => f.monthlyGrossCents >= cents(2_000), "You need a job to lose one.")),
  branches: [
    {
      id: "rebound",
      label: "Take a new role quickly (−15% pay)",
      description: "Back to work fast, but at lower pay.",
      importance: "major",
      effect: (ctx) => buildEffect({ id: "rng-layoff", domain: "career", optionId: "rebound", label: "Laid off — took a lower-paying role", month: ctx.month, importanceLevel: "major", mutations: [scalePrimaryJob(0.85)] }),
      outcome: { mergeFlags: { layoffExperienced: true, lastJobSearchOutcome: "rapid-rebound" } },
    },
    {
      id: "hold-out",
      label: "Hold out for a comparable role",
      description: "Burn ~$12k of savings but keep your pay.",
      importance: "major",
      effect: (ctx) => buildEffect({ id: "rng-layoff", domain: "career", optionId: "hold-out", label: "Laid off — began a longer search", month: ctx.month, importanceLevel: "major", mutations: [spendCash(12_000), clearPrimaryJob()] }),
      outcome: { setStage: "unemployed", mergeFlags: (ctx) => ({ layoffExperienced: true, unemployed: true, unemploymentStartedMonth: ctx.month }), updateProfile: (profile) => ({ ...profile, work: { ...profile.work, status: "not-working", weeklyHours: 0 }, wellbeing: { ...profile.wellbeing, stress: Math.min(100, profile.wellbeing.stress + 25), burnoutRisk: Math.max(0, profile.wellbeing.burnoutRisk - 10) } }) },
    },
  ],
};

const RNG_RENT_HIKE: DecisionNode = {
  id: "rng-rent-hike",
  category: "housing",
  trigger: "random",
  title: "Your rent is going up",
  prompt: "The landlord raised the rent. It's part of life as a renter.",
  importance: "minor",
  chance: { annualProbability: 0.1 },
  available: (ctx) => allOf(gate(!hasFlag(ctx, "homeowner"), "Only affects renters."), gate(ctx.stage === "working" || ctx.stage === "apprenticeship", "Only once you're paying your own rent.")),
  branches: [
    {
      id: "absorb",
      label: "Absorb the increase",
      description: "Cost of living ticks up ~8%.",
      importance: "minor",
      effect: (ctx) => buildEffect({ id: "rng-rent-hike", domain: "housing", optionId: "absorb", label: "Rent increased", month: ctx.month, mutations: [scaleLiving(1.08)] }),
      outcome: { reopen: ["rng-rent-hike"] },
    },
  ],
};

const RNG_PROMOTION: DecisionNode = {
  id: "rng-promotion",
  category: "career",
  trigger: "random",
  title: "A promotion offer",
  prompt: "Your work has been noticed — there's a step up on the table.",
  importance: "minor",
  chance: { annualProbability: 0.08 },
  available: (ctx) => allOf(gate(ctx.stage === "working", "For those in the workforce."), moneyGate(ctx, (f) => f.monthlyGrossCents >= cents(2_500), "You need a job to be promoted.")),
  branches: [
    {
      id: "accept",
      label: "Accept the promotion",
      description: "About +15% pay and more responsibility.",
      importance: "minor",
      effect: (ctx) => buildEffect({ id: "rng-promotion", domain: "career", optionId: "accept", label: "Accepted a promotion", month: ctx.month, mutations: [scalePrimaryJob(1.15)] }),
      outcome: { mergeFlags: (ctx) => ({ promotionCount: numberFlag(ctx, "promotionCount") + 1 }), reopen: ["rng-promotion"] },
    },
    { ...DECLINE, label: "Stay in your current role" },
  ],
};

const RNG_RECRUITER: DecisionNode = {
  id: "rng-recruiter",
  category: "career",
  trigger: "random",
  title: "A recruiter comes calling",
  prompt: "Another company wants you — for more money.",
  importance: "minor",
  chance: { annualProbability: 0.06 },
  available: (ctx) => allOf(gate(ctx.stage === "working", "For those in the workforce."), moneyGate(ctx, (f) => f.monthlyGrossCents >= cents(2_500), "You need a job to jump from.")),
  branches: [
    {
      id: "jump",
      label: "Take the new job (+12%)",
      description: "A raise now, though you start over on tenure.",
      importance: "minor",
      effect: (ctx) => buildEffect({ id: "rng-recruiter", domain: "career", optionId: "jump", label: "Changed jobs for a raise", month: ctx.month, mutations: [scalePrimaryJob(1.12)] }),
      outcome: { mergeFlags: (ctx) => ({ jobChangeCount: numberFlag(ctx, "jobChangeCount") + 1, lastJobChangeMonth: ctx.month }), reopen: ["rng-recruiter"] },
    },
    { ...DECLINE, label: "Stay put" },
  ],
};

const RNG_SIDE_GIG: DecisionNode = {
  id: "rng-side-gig",
  category: "career",
  trigger: "random",
  title: "A side-hustle opportunity",
  prompt: "A chance to earn ~$900/mo on the side. Worth the time?",
  importance: "minor",
  chance: { annualProbability: 0.06, oncePerLife: true },
  available: (ctx) => gate(ctx.stage === "working" || ctx.stage === "apprenticeship", "Best once you have a main gig."),
  branches: [
    {
      id: "start",
      label: "Start the side hustle",
      description: "Adds a small ongoing income.",
      importance: "minor",
      effect: (ctx) => buildEffect({ id: "rng-side-gig", domain: "career", optionId: "start", label: "Started a side hustle", month: ctx.month, mutations: [{ kind: "addIncome", income: { config: { id: "side-gig", label: "Side income", baseMonthlyGrossCents: cents(900), annualGrowthRate: 0.02, stateCode: "TX", pretaxDeferralRate: 0, startMonth: ctx.month } } }] }),
      outcome: { mergeFlags: { hasSideGig: true }, updateProfile: (profile) => ({ ...profile, work: { ...profile.work, weeklyHours: profile.work.weeklyHours + 8 }, wellbeing: { ...profile.wellbeing, stress: Math.min(100, profile.wellbeing.stress + 10), burnoutRisk: Math.min(100, profile.wellbeing.burnoutRisk + 15) } }) },
    },
    declineBranch("rng-side-gig", true, "Pass"),
  ],
};

const RNG_TRIP: DecisionNode = {
  id: "rng-trip",
  category: "lifestyle",
  trigger: "random",
  title: "A once-in-a-lifetime trip",
  prompt: "Friends are planning a big trip. Splurge, or sit this one out?",
  importance: "minor",
  chance: { annualProbability: 0.08 },
  available: () => eligible(),
  branches: [
    {
      id: "go",
      label: "Go for it ($12k)",
      description: "Memories now, less in the bank.",
      importance: "minor",
      effect: (ctx) => buildEffect({ id: "rng-trip", domain: "lifestyle", optionId: "go", label: "Took a dream trip", month: ctx.month, mutations: [spendCash(12_000)] }),
      outcome: { reopen: ["rng-trip"] },
    },
    { ...DECLINE, label: "Skip it and save" },
  ],
};

const PET_OPTIONS = [
  { key: "adult-dog", label: "Adult rescue dog", upfront: 650, monthly: 145, weeklyHours: 10, commitment: "10–14 years", description: "Daily walks and training in a pet-friendly home; a steady, active companion." },
  { key: "puppy", label: "Puppy", upfront: 1_400, monthly: 230, weeklyHours: 18, commitment: "12–15 years", description: "Frequent breaks, house training, socialization, supervision, and stable dog-friendly housing." },
  { key: "senior-dog", label: "Senior dog", upfront: 750, monthly: 190, weeklyHours: 9, commitment: "2–7 years", description: "A gentle pace with easy outdoor access and a larger medical and mobility reserve." },
  { key: "adult-cat", label: "Adult cat", upfront: 500, monthly: 90, weeklyHours: 5, commitment: "12–18 years", description: "Indoor pet-friendly housing, daily play, litter care, enrichment, and routine veterinary care." },
  { key: "bonded-cats", label: "Bonded cats", upfront: 850, monthly: 165, weeklyHours: 7, commitment: "12–18 years", description: "Housing must allow two cats; companionship is built in, while food, litter, and veterinary costs double." },
  { key: "rabbit", label: "Rabbit", upfront: 600, monthly: 100, weeklyHours: 7, commitment: "8–12 years", description: "A roomy rabbit-safe indoor exercise area, daily cleaning, hay, enrichment, and exotic-vet access." },
  { key: "guinea-pig-pair", label: "Guinea pig pair", upfront: 450, monthly: 80, weeklyHours: 5, commitment: "5–7 years", description: "A social pair needing a large stable enclosure, hay and vegetables, cleaning, and exotic-vet care." },
  { key: "hamster", label: "Hamster", upfront: 225, monthly: 35, weeklyHours: 2, commitment: "2–3 years", description: "A shorter, lower-cost commitment with a humane deep-bedding enclosure and nocturnal schedule." },
  { key: "parakeet", label: "Parakeet", upfront: 425, monthly: 55, weeklyHours: 5, commitment: "7–12 years", description: "Daily social time, safe flight, cage care, an avian vet, and housing where some noise is acceptable." },
  { key: "freshwater-aquarium", label: "Freshwater aquarium", upfront: 500, monthly: 45, weeklyHours: 2, commitment: "5–10 years", description: "Quiet and space-efficient, but dependent on tank cycling, water testing, cleaning, and reliable equipment." },
  { key: "leopard-gecko", label: "Leopard gecko", upfront: 550, monthly: 45, weeklyHours: 3, commitment: "10–20 years", description: "A quiet reptile needing reliable power, controlled heat, live food, supplements, and an exotic vet." },
  { key: "tortoise", label: "Tortoise", upfront: 900, monthly: 70, weeklyHours: 4, commitment: "40+ years", description: "A lifetime-scale commitment requiring a large climate-controlled habitat, UV light, and a future care plan." },
] as const;

const RNG_PET: DecisionNode = {
  id: "rng-pet",
  category: "lifestyle",
  trigger: "random",
  title: "Choose a companion",
  prompt: "Compare the time, housing, setup, monthly care, and lifetime commitment behind each possible pet.",
  importance: "minor",
  chance: { annualProbability: 0.06, oncePerLife: true },
  available: () => eligible(),
  branches: [
    ...PET_OPTIONS.map((pet): DecisionBranch => ({
      id: pet.key,
      label: pet.label,
      description: pet.description,
      importance: "minor",
      inputs: { upfrontDollars: pet.upfront, monthlyDollars: pet.monthly, weeklyCareHours: pet.weeklyHours, commitment: pet.commitment },
      tradeoffs: { upfrontDollars: -pet.upfront, monthlyCashFlowDollars: -pet.monthly, weeklyHoursDelta: -pet.weeklyHours, relationships: 1 },
      effect: (ctx) => buildEffect({
        id: "rng-pet",
        domain: "lifestyle",
        optionId: pet.key,
        label: `Adopted ${pet.label}`,
        month: ctx.month,
        inputs: { petType: pet.key, upfrontDollars: pet.upfront, monthlyDollars: pet.monthly, weeklyCareHours: pet.weeklyHours, commitment: pet.commitment },
        mutations: [
          spendCash(pet.upfront),
          { kind: "addExpense", expense: { config: { id: "pet", label: `${pet.label} care`, category: "fixed", baseMonthlyAmountCents: cents(pet.monthly), annualInflationRate: 0.03, startMonth: ctx.month } } },
        ],
      }),
      outcome: { mergeFlags: { hasPet: true, petType: pet.key, petWeeklyCareHours: pet.weeklyHours } },
    })),
    declineBranch("rng-pet", true, "Not now"),
  ],
};

const RNG_MEDICAL = randomForcedCost({ id: "rng-medical", category: "family", title: "A medical emergency", prompt: "An unexpected medical bill has landed. It has to be paid.", costDollars: 8_000, chance: 0.05, repeatable: true });
const RNG_CAR_REPAIR = randomForcedCost({ id: "rng-car-repair", category: "lifestyle", title: "Your car breaks down", prompt: "A major repair is due. No car, no commute.", costDollars: 2_500, chance: 0.12, repeatable: true, available: (ctx) => gate(hasFlag(ctx, "hasCar"), "You don't own a car.") });
const RNG_HOME_REPAIR = randomForcedCost({ id: "rng-home-repair", category: "housing", title: "The house needs a big repair", prompt: "A roof, an HVAC unit, a burst pipe — homeownership's hidden cost.", costDollars: 6_000, chance: 0.1, repeatable: true, available: (ctx) => gate(hasFlag(ctx, "homeowner"), "You don't own a home.") });
const DIRECT_BONUS_TRACKS = new Set(["sales", "real-estate"]);
const DEGREE_BONUS_MAJORS = new Set(["business", "accounting", "mechanical-engineering", "economics", "computer-science", "cybersecurity", "data-science", "finance"]);

const RNG_BONUS = randomWindfall({
  id: "rng-bonus",
  title: "A performance bonus",
  prompt: "Your bonus-eligible role paid out after a strong year.",
  amountDollars: 8_000,
  chance: 0.04,
  repeatable: true,
  cooldownMonths: 36,
  available: (ctx) => {
    const track = String(flag(ctx, "track") ?? "");
    const major = String(flag(ctx, "major") ?? "");
    const eligibleDirectRole = DIRECT_BONUS_TRACKS.has(track);
    const eligibleGraduateRole = hasFlag(ctx, "degreeEarned") && DEGREE_BONUS_MAJORS.has(major);
    return allOf(
      gate(ctx.stage === "working", "Bonuses only occur while working."),
      gate(eligibleDirectRole || eligibleGraduateRole, "This career path does not normally include performance bonuses."),
    );
  },
});
const RNG_TAX_REFUND = randomWindfall({ id: "rng-tax-refund", title: "A tax refund", prompt: "Your return came back larger than expected.", amountDollars: 3_000, chance: 0.14, repeatable: true });

/** The complete age-18 life graph. */
export const lifeGraph2026: LifeGraph = {
  id: "life-after-high-school",
  version: "2026.4",
  nodes: [
    HS_LAUNCH,
    DECLARE_MAJOR,
    SWAP_MAJOR,
    GRADUATE,
    GRAD_SCHOOL,
    GRAD_SCHOOL_COMPLETE,
    ENTRY_TRACK,
    WORK_CERT,
    WORK_PROMOTION,
    APPRENTICESHIP_TRADE,
    JOURNEYMAN_TICKET,
    MASTER_LICENSE,
    MILITARY_BRANCH,
    POST_SERVICE,
    MARRIAGE,
    FIRST_HOME,
    FIRST_CHILD,
    // Money-gated opportunities that fill the mid-life years.
    BUY_CAR,
    BOOST_RETIREMENT,
    BUILD_EMERGENCY,
    RETIREMENT_CATCHUP,
    RETIRE,
    UNEMPLOYMENT_SEARCH,
    // Context-sensitive reflection sessions derived from the ten-story critique.
    ...STORY_REFLECTION_NODES,
    // Random "life happens" events, ordered most-disruptive-first for the yearly roll.
    RNG_LAYOFF,
    RNG_MEDICAL,
    RNG_CAR_REPAIR,
    RNG_HOME_REPAIR,
    RNG_RENT_HIKE,
    RNG_RECRUITER,
    RNG_PROMOTION,
    RNG_SIDE_GIG,
    RNG_TRIP,
    RNG_PET,
    RNG_BONUS,
    RNG_TAX_REFUND,
  ],
};
