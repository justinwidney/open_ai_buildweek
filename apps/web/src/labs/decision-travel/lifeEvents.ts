import {
  buyHome,
  changeContributionRate,
  changeJob,
  haveChild,
  marry,
  receiveWindfall,
  cents,
  type EventEffect,
  type StateMutation,
} from "@control-ai/engine";
import type { DecisionRouteKind } from "./decisionMaps";

export interface EventOption {
  id: string;
  label: string;
  description: string;
  /** null = decline / do nothing (the path continues unchanged). */
  build: ((month: number) => EventEffect) | null;
}

export interface LifeEvent {
  id: string;
  emoji: string;
  title: string;
  prompt: string;
  /** "scheduled" fires at a typical age; "chance" is a random roll while travelling. */
  kind: "scheduled" | "chance";
  /** Visual route grammar used by the decision-map popup. */
  routeKind: DecisionRouteKind;
  options: EventOption[];
}

const DECLINE: EventOption = { id: "decline", label: "Not now", description: "Stay the course — no change to your path.", build: null };

/** Build a manual one-time cash effect (a cost or a gift) when no catalog builder fits. */
function cashEffect(id: string, label: string, domain: string, amountCents: number, month: number): EventEffect {
  const mutations: StateMutation[] = [{ kind: "adjustCash", deltaCents: amountCents }];
  return { decision: { id: `${id}:${month}`, domain, optionId: id, label, effectiveFromMonth: month }, mutations };
}

function sideHustleEffect(month: number): EventEffect {
  const mutations: StateMutation[] = [
    { kind: "addIncome", income: { config: { id: `side-${month}`, label: "Side income", baseMonthlyGrossCents: cents(1200), annualGrowthRate: 0.02, stateCode: "TX", pretaxDeferralRate: 0, startMonth: month } } },
  ];
  return { decision: { id: `side-hustle:${month}`, domain: "career", optionId: "side-hustle", label: "Started a side hustle", effectiveFromMonth: month }, mutations };
}

// ---- Scheduled milestones ("at averages") ----
const SCHEDULED: Record<number, LifeEvent> = {
  27: {
    id: "career-step",
    emoji: "💼",
    title: "A career crossroads",
    prompt: "A recruiter offers a bigger role. Do you make the leap, or double down on saving where you are?",
    kind: "scheduled",
    routeKind: "fork-both",
    options: [
      { id: "jump", label: "Take the bigger job", description: "Higher pay, higher expectations.", build: (m) => changeJob({ oldIncomeId: "job", newJob: { id: "job", label: "New role", baseMonthlyGrossCents: cents(11500), annualGrowthRate: 0.035, stateCode: "TX", pretaxDeferralRate: 0.08 }, effectiveFromMonth: m }) },
      { id: "save", label: "Stay & save more", description: "Bump your 401(k) to 15%.", build: (m) => changeContributionRate({ incomeId: "job", newDeferralRate: 0.15, effectiveFromMonth: m }) },
      DECLINE,
    ],
  },
  30: {
    id: "marriage",
    emoji: "💍",
    title: "Settling down",
    prompt: "You're thinking about marriage. How does it change the household books?",
    kind: "scheduled",
    routeKind: "confusing",
    options: [
      { id: "dual", label: "Marry — dual income", description: "Partner earns $6.5k/mo. File jointly.", build: (m) => marry({ effectiveFromMonth: m, spouseIncome: { id: "spouse", label: "Partner", baseMonthlyGrossCents: cents(6500), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.05 }, weddingCostCents: cents(24000) }) },
      { id: "single", label: "Marry — single income", description: "A partner at home. File jointly, one income.", build: (m) => marry({ effectiveFromMonth: m, weddingCostCents: cents(18000) }) },
      DECLINE,
    ],
  },
  33: {
    id: "first-child",
    emoji: "🍼",
    title: "Starting a family",
    prompt: "A child would bring years of childcare costs. Are you ready?",
    kind: "scheduled",
    routeKind: "fork-left",
    options: [
      { id: "yes", label: "Have a child", description: "$1.6k/mo childcare for ~5 years.", build: (m) => haveChild({ childId: `kid-${m}`, effectiveFromMonth: m, oneTimeBirthCostCents: cents(6000), monthlyChildcareCents: cents(1600), childcareEndMonth: m + 60 }) },
      DECLINE,
    ],
  },
  36: {
    id: "home",
    emoji: "🏠",
    title: "Rent or buy?",
    prompt: "Home prices are steep but you're tired of renting. What's the move?",
    kind: "scheduled",
    routeKind: "network",
    options: [
      { id: "buy", label: "Buy a $420k home", description: "20% down, 30-year mortgage.", build: (m) => buyHome({ id: `home-${m}`, priceCents: cents(420000), downPaymentCents: cents(84000), closingCostsCents: cents(12600), mortgageAnnualRate: 0.065, termMonths: 360, monthlyEscrowCents: cents(525), monthlyMaintenanceCents: cents(350), annualAppreciationRate: 0.03, effectiveFromMonth: m }) },
      { id: "modest", label: "Buy modest ($300k)", description: "Smaller place, more cash free.", build: (m) => buyHome({ id: `home-${m}`, priceCents: cents(300000), downPaymentCents: cents(60000), closingCostsCents: cents(9000), mortgageAnnualRate: 0.065, termMonths: 360, monthlyEscrowCents: cents(375), monthlyMaintenanceCents: cents(250), annualAppreciationRate: 0.03, effectiveFromMonth: m }) },
      { id: "rent", label: "Keep renting", description: "Stay liquid, invest the difference.", build: null },
    ],
  },
  42: {
    id: "peak-savings",
    emoji: "📈",
    title: "Peak earning years",
    prompt: "Your income is at its peak. Push savings hard, or enjoy the fruits?",
    kind: "scheduled",
    routeKind: "fork-both",
    options: [
      { id: "max", label: "Max out savings (20%)", description: "Aggressively fund retirement.", build: (m) => changeContributionRate({ incomeId: "job", newDeferralRate: 0.2, effectiveFromMonth: m }) },
      { id: "trip", label: "Take a dream trip", description: "A $30k once-in-a-lifetime journey.", build: (m) => cashEffect("dream-trip", "Dream trip", "lifestyle", -cents(30000), m) },
      DECLINE,
    ],
  },
};

// ---- Random events ("through randomness") ----
interface ChanceEvent {
  chancePerYear: number;
  oncePerLife: boolean;
  event: LifeEvent;
}

const RANDOM_EVENTS: ChanceEvent[] = [
  {
    chancePerYear: 0.05,
    oncePerLife: true,
    event: {
      id: "inheritance",
      emoji: "🎁",
      title: "An unexpected inheritance",
      prompt: "A relative has left you a sum. What do you do with it?",
      kind: "chance",
      routeKind: "curve",
      options: [
        { id: "invest", label: "Invest $80k", description: "Straight into the portfolio (as cash to deploy).", build: (m) => receiveWindfall({ id: "inheritance", amountCents: cents(80000), effectiveFromMonth: m, label: "Inheritance invested" }) },
        DECLINE,
      ],
    },
  },
  {
    chancePerYear: 0.06,
    oncePerLife: false,
    event: {
      id: "bonus",
      emoji: "💰",
      title: "A surprise bonus",
      prompt: "Your work paid out a windfall bonus this year.",
      kind: "chance",
      routeKind: "straight",
      options: [
        { id: "take", label: "Bank the $15k", description: "Adds to cash.", build: (m) => receiveWindfall({ id: `bonus-${m}`, amountCents: cents(15000), effectiveFromMonth: m, label: "Work bonus" }) },
        DECLINE,
      ],
    },
  },
  {
    chancePerYear: 0.07,
    oncePerLife: false,
    event: {
      id: "expense",
      emoji: "🚑",
      title: "An unexpected expense",
      prompt: "A car breaks down / a medical bill lands. It has to be paid.",
      kind: "chance",
      routeKind: "straight",
      options: [{ id: "pay", label: "Pay the $12k", description: "Comes out of cash.", build: (m) => cashEffect("emergency", "Emergency expense", "lifestyle", -cents(12000), m) }],
    },
  },
  {
    chancePerYear: 0.05,
    oncePerLife: true,
    event: {
      id: "side-hustle",
      emoji: "🛠️",
      title: "A side opportunity",
      prompt: "A chance to start a side hustle earning ~$1.2k/mo. Worth the time?",
      kind: "chance",
      routeKind: "fork-right",
      options: [
        { id: "start", label: "Start it", description: "Adds a small ongoing income.", build: (m) => sideHustleEffect(m) },
        DECLINE,
      ],
    },
  },
];

/**
 * Every event that can ever fire, keyed by id. This is what makes a saved life
 * resumable: a stored decision records which `(eventId, optionId)` was chosen,
 * and replaying it means looking the option back up here and re-running its
 * `build`. Both ids are stable and hand-authored, so they survive a reload —
 * unlike the `EventEffect` itself, which closes over functions and cannot be
 * serialized.
 */
const ALL_EVENTS: readonly LifeEvent[] = [...Object.values(SCHEDULED), ...RANDOM_EVENTS.map((r) => r.event)];

export function findEvent(eventId: string): LifeEvent | null {
  return ALL_EVENTS.find((e) => e.id === eventId) ?? null;
}

/** Resolves a stored choice back to the option that produced it, or null if the catalog no longer has it. */
export function findOption(eventId: string, optionId: string): EventOption | null {
  return findEvent(eventId)?.options.find((o) => o.id === optionId) ?? null;
}

/**
 * Determines the life event (if any) for a given age. Scheduled milestones take
 * priority; otherwise each random event is rolled once against the supplied RNG.
 * `fired` prevents once-per-life events (and every scheduled one) from repeating.
 */
export function eventForAge(age: number, fired: Set<string>, rng: () => number): LifeEvent | null {
  const scheduled = SCHEDULED[age];
  if (scheduled && !fired.has(scheduled.id)) return scheduled;
  for (const r of RANDOM_EVENTS) {
    if (r.oncePerLife && fired.has(r.event.id)) continue;
    if (rng() < r.chancePerYear) return r.event;
  }
  return null;
}
