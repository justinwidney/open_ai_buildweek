import type { Cents } from "../money/index.js";
import type { BudgetTarget } from "../budget/index.js";
import { hasFlag, type LifeContext } from "./context.js";

/**
 * Recommended monthly budgets keyed to where a life is — a "here's a sensible
 * plan" surface that changes after the events that reshape spending (graduating,
 * marrying, a first child, buying a home). It splits *take-home* pay across
 * categories by a profile chosen from stage + flags, and also emits a
 * `BudgetTarget` so the same recommendation can be scored against the actual
 * statement by `evaluateBudget`.
 */

export type BudgetCategoryKey =
  | "housing"
  | "food"
  | "transportation"
  | "insurance"
  | "childcare"
  | "discretionary"
  | "savings"
  | "debt";

export interface BudgetCategory {
  key: BudgetCategoryKey;
  label: string;
  monthlyCents: Cents;
  pctOfTakeHome: number;
}

export interface RecommendedBudget {
  /** The profile that was chosen (e.g. "new-parent"), for callouts after a life event. */
  profile: string;
  headline: string;
  rationale: string;
  monthlyTakeHomeCents: Cents;
  savingsRatePct: number;
  categories: readonly BudgetCategory[];
  /** The same plan as a scorable target for `evaluateBudget(target, statement)`. */
  target: BudgetTarget;
}

const LABELS: Record<BudgetCategoryKey, string> = {
  housing: "Housing",
  food: "Food & groceries",
  transportation: "Transportation",
  insurance: "Insurance & health",
  childcare: "Childcare",
  discretionary: "Fun & discretionary",
  savings: "Savings & retirement",
  debt: "Debt paydown",
};

const ORDER: readonly BudgetCategoryKey[] = ["housing", "food", "transportation", "insurance", "childcare", "discretionary", "debt", "savings"];

type Split = Partial<Record<BudgetCategoryKey, number>>;

interface Profile {
  id: string;
  headline: string;
  rationale: string;
  split: Split; // percentages of take-home; should sum to ~100
}

const PROFILES: Record<string, Profile> = {
  student: {
    id: "student",
    headline: "Student budget — keep fixed costs low",
    rationale: "Money is tight in school. Split rent with roommates, keep wants small, and protect a little savings.",
    split: { housing: 34, food: 20, transportation: 8, insurance: 6, discretionary: 12, debt: 15, savings: 5 },
  },
  serviceApprentice: {
    id: "service-apprentice",
    headline: "Earn-and-learn budget — save the difference",
    rationale: "With housing largely covered, this is the best time in your life to bank a big share of every check.",
    split: { housing: 18, food: 12, transportation: 10, insurance: 6, discretionary: 19, savings: 35 },
  },
  newGrad: {
    id: "new-grad",
    headline: "New-earner budget — save aggressively",
    rationale: "No dependents yet. A 25% savings rate now compounds for decades — front-load it.",
    split: { housing: 28, food: 12, transportation: 12, insurance: 8, discretionary: 15, savings: 25 },
  },
  married: {
    id: "married",
    headline: "Two-income budget — lock in the savings rate",
    rationale: "Two can share fixed costs. Hold your savings rate as lifestyle creep tempts you.",
    split: { housing: 26, food: 12, transportation: 10, insurance: 8, discretionary: 22, savings: 22 },
  },
  newParent: {
    id: "new-parent",
    headline: "New-parent budget — childcare is your second rent",
    rationale: "A child reshapes everything. Childcare becomes a top line; trim discretionary to keep saving.",
    split: { housing: 26, food: 14, transportation: 10, insurance: 10, childcare: 18, discretionary: 10, savings: 12 },
  },
  homeowner: {
    id: "homeowner",
    headline: "Homeowner budget — keep a repair buffer",
    rationale: "Owning adds upkeep and property costs. Budget housing high and keep saving for the surprises.",
    split: { housing: 32, food: 12, transportation: 10, insurance: 9, discretionary: 15, savings: 22 },
  },
  retired: {
    id: "retired",
    headline: "Retirement budget — spend from the nest egg",
    rationale: "Income now comes from withdrawals. Keep housing and health steady; enjoy the discretionary room you earned.",
    split: { housing: 30, food: 14, transportation: 10, insurance: 14, discretionary: 22, savings: 10 },
  },
};

/** Pick the budget profile that best fits the life context. Most-specific event wins. */
function selectProfile(ctx: LifeContext): Profile {
  if (ctx.stage === "retired") return PROFILES.retired!;
  if (hasFlag(ctx, "hasChild")) return PROFILES.newParent!;
  if (hasFlag(ctx, "homeowner")) return PROFILES.homeowner!;
  if (hasFlag(ctx, "married")) return PROFILES.married!;
  if (ctx.stage === "school") return PROFILES.student!;
  if (ctx.stage === "apprenticeship" || ctx.stage === "military") return PROFILES.serviceApprentice!;
  return PROFILES.newGrad!;
}

/**
 * The recommended budget for the current life context. Amounts are computed from
 * the take-home pay on `ctx.finances` (zero when finances haven't been attached
 * yet, in which case the percentages still describe the plan).
 */
export function recommendedBudget(ctx: LifeContext): RecommendedBudget {
  const profile = selectProfile(ctx);
  const takeHome = ctx.finances?.monthlyTakeHomeCents ?? 0;

  const categories: BudgetCategory[] = ORDER.filter((key) => profile.split[key] !== undefined).map((key) => {
    const pct = profile.split[key]!;
    return { key, label: LABELS[key], monthlyCents: Math.round((takeHome * pct) / 100), pctOfTakeHome: pct };
  });

  const savingsRatePct = profile.split.savings ?? 0;
  const spendingCents = categories.filter((c) => c.key !== "savings").reduce((sum, c) => sum + c.monthlyCents, 0);
  const discretionary = categories.find((c) => c.key === "discretionary");

  const target: BudgetTarget = {
    totalMonthlySpendingCents: spendingCents,
    savingsRateTarget: savingsRatePct / 100,
    lines: discretionary ? [{ key: "discretionary", match: "category", limitCents: discretionary.monthlyCents, label: "Discretionary" }] : [],
  };

  return {
    profile: profile.id,
    headline: profile.headline,
    rationale: profile.rationale,
    monthlyTakeHomeCents: takeHome,
    savingsRatePct,
    categories,
    target,
  };
}
