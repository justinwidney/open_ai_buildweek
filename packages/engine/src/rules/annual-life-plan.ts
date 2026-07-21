import type { JsonValue, ValidationIssue, ValidationResult } from "../contracts/values.js";
import { validationResult } from "../contracts/values.js";
import { buildEffect, setLivingCost, spendCash } from "./effects.js";
import type { DecisionBranch } from "./graph.js";
import type { HousingTenure, LifeGoal, WeeklyTimeBudget } from "./life-profile.js";

export const ANNUAL_LIFE_PLAN_SCHEMA_VERSION = 1 as const;

export interface AnnualLifePlanInputs {
  schemaVersion: typeof ANNUAL_LIFE_PLAN_SCHEMA_VERSION;
  age: number;
  focus: { id: string; label: string; description: string; tradeoff: string };
  living: {
    id: string;
    label: string;
    housingTenure: HousingTenure;
    housingDollars: number;
    utilitiesDollars: number;
    moveCostDollars: number;
  };
  location: { id: string; label: string; monthlyDeltaDollars: number };
  transit: { id: string; label: string; monthlyDollars: number; weeklyHours: number };
  groceriesMonthlyDollars: number;
  schedule: Omit<WeeklyTimeBudget, "transit" | "flexible">;
}

export function annualLifePlanMonthlyCost(plan: AnnualLifePlanInputs): number {
  return Math.max(0, plan.living.housingDollars + plan.living.utilitiesDollars + plan.location.monthlyDeltaDollars + plan.transit.monthlyDollars + plan.groceriesMonthlyDollars);
}

export function annualLifePlanTimeBudget(plan: AnnualLifePlanInputs): WeeklyTimeBudget {
  const planned = Object.values(plan.schedule).reduce((sum, value) => sum + value, 0) + plan.transit.weeklyHours;
  return { ...plan.schedule, transit: plan.transit.weeklyHours, flexible: 168 - planned };
}

export function validateAnnualLifePlan(plan: AnnualLifePlanInputs): ValidationResult {
  const issues: ValidationIssue[] = [];
  const moneyFields: [string, number][] = [
    ["living.housingDollars", plan.living.housingDollars],
    ["living.utilitiesDollars", plan.living.utilitiesDollars],
    ["living.moveCostDollars", plan.living.moveCostDollars],
    ["transit.monthlyDollars", plan.transit.monthlyDollars],
    ["groceriesMonthlyDollars", plan.groceriesMonthlyDollars],
  ];
  for (const [path, value] of moneyFields) {
    if (!Number.isFinite(value) || value < 0) issues.push({ code: "annual-plan.invalid-money", severity: "error", message: `${path} must be a non-negative number.`, path: path.split(".") });
  }
  if (!Number.isInteger(plan.age) || plan.age < 18 || plan.age > 120) {
    issues.push({ code: "annual-plan.invalid-age", severity: "error", message: "Age must be a whole number from 18 to 120.", path: ["age"] });
  }
  if (!plan.focus.id || !plan.focus.label) {
    issues.push({ code: "annual-plan.missing-focus", severity: "error", message: "A yearly focus is required.", path: ["focus"] });
  }
  const time = annualLifePlanTimeBudget(plan);
  if (Object.values(plan.schedule).some((hours) => !Number.isFinite(hours) || hours < 0) || !Number.isFinite(plan.transit.weeklyHours) || plan.transit.weeklyHours < 0) {
    issues.push({ code: "annual-plan.invalid-time", severity: "error", message: "Weekly time values must be non-negative numbers.", path: ["schedule"] });
  }
  if (time.flexible < 0) {
    issues.push({ code: "annual-plan.overbooked", severity: "error", message: "The plan commits more than 168 hours per week.", path: ["schedule"] });
  } else if (time.flexible < 25) {
    issues.push({ code: "annual-plan.tight-week", severity: "warning", message: "Fewer than 25 weekly hours remain for meals, chores, recovery, and surprises.", path: ["schedule"] });
  }
  return validationResult(issues);
}

function asReplayInputs(plan: AnnualLifePlanInputs): Readonly<Record<string, JsonValue>> {
  return {
    schemaVersion: plan.schemaVersion,
    age: plan.age,
    focus: plan.focus,
    living: plan.living,
    location: plan.location,
    transit: plan.transit,
    groceriesMonthlyDollars: plan.groceriesMonthlyDollars,
    schedule: plan.schedule,
  };
}

/** Build the stable engine branch used both by the live editor and save replay. */
export function createAnnualLifePlanBranch(nodeId: string, plan: AnnualLifePlanInputs): DecisionBranch {
  const validation = validateAnnualLifePlan(plan);
  if (!validation.valid) throw new Error(validation.issues.map((issue) => issue.message).join(" "));
  const monthlyCost = annualLifePlanMonthlyCost(plan);
  const time = annualLifePlanTimeBudget(plan);
  const inputs = asReplayInputs(plan);

  return {
    id: `annual-plan:${plan.focus.id}`,
    label: plan.focus.label,
    description: `${plan.focus.description} ${plan.living.label}, ${plan.location.label}, ${plan.transit.label}, and $${plan.groceriesMonthlyDollars.toLocaleString()} monthly groceries.`,
    importance: "minor",
    inputs,
    effect: (ctx) => {
      const moving = ctx.profile.place.housingTenure === plan.living.housingTenure ? 0 : plan.living.moveCostDollars;
      return buildEffect({
        id: nodeId,
        domain: "lifestyle",
        optionId: plan.focus.id,
        label: `Age ${plan.age}: ${plan.focus.label}`,
        month: ctx.month,
        importanceLevel: "minor",
        comparisonMetricKeys: ["monthlySpendingCents", "savingsRate", "emergencyFundMonths"],
        inputs,
        mutations: [setLivingCost({ monthlyDollars: monthlyCost }), ...(moving > 0 ? [spendCash(moving)] : [])],
      });
    },
    outcome: {
      mergeFlags: {
        lifestylePlanAge: plan.age,
        lifestyleFocus: plan.focus.id,
        lifestyleLiving: plan.living.id,
        lifestyleLocation: plan.location.id,
        lifestyleTransit: plan.transit.id,
        lifestyleGroceriesMonthly: plan.groceriesMonthlyDollars,
        lifestyleMonthlyCost: monthlyCost,
        lifestyleWeeklySchedule: { work: time.work, study: time.study, sleep: time.sleep, friends: time.friends, fitness: time.fitness, transit: time.transit, flexible: time.flexible },
      },
      updateProfile: (profile, ctx) => {
        const goal: LifeGoal = {
          id: `annual-focus-${plan.age}`,
          label: plan.focus.label,
          domain: "lifestyle",
          reviewMonth: ctx.month + 12,
          status: "active",
        };
        return {
          ...profile,
          place: {
            locationPattern: plan.location.id,
            housingTenure: plan.living.housingTenure,
            commuteMode: plan.transit.id,
            monthlyLivingCostDollars: monthlyCost,
          },
          time,
          wellbeing: {
            ...profile.wellbeing,
            stress: Math.min(100, Math.max(0, Math.round(70 - time.flexible))),
            burnoutRisk: Math.min(100, Math.max(0, Math.round(50 - time.flexible))),
          },
          goals: [...profile.goals.filter((item) => item.id !== goal.id), goal],
        };
      },
    },
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Parse and validate a persisted custom-decision payload without trusting storage. */
export function parseAnnualLifePlanInputs(value: unknown): AnnualLifePlanInputs | null {
  const root = record(value);
  const focus = record(root?.focus);
  const living = record(root?.living);
  const location = record(root?.location);
  const transit = record(root?.transit);
  const schedule = record(root?.schedule);
  if (!root || !focus || !living || !location || !transit || !schedule || root.schemaVersion !== ANNUAL_LIFE_PLAN_SCHEMA_VERSION) return null;
  const plan = root as unknown as AnnualLifePlanInputs;
  return validateAnnualLifePlan(plan).valid ? plan : null;
}
