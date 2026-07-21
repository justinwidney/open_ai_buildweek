import { cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { StateMutation } from "../events/mutations.js";
import type { EventEffect } from "../events/apply.js";

/**
 * The stable entity ids the life graph assumes exist on the seed snapshot so
 * career changes are just a replace: the graph always overwrites `PRIMARY_JOB`
 * rather than tracking whatever job id happened to exist before, and prices its
 * cost-of-living against `LIVING_EXPENSE`. A seed built for this graph should
 * use these ids (see rules/README.md).
 */
export const PRIMARY_JOB_ID = "job";
export const LIVING_EXPENSE_ID = "living";
export const TUITION_EXPENSE_ID = "tuition";

export interface JobParams {
  label: string;
  monthlyGrossDollars: number;
  annualGrowthRate?: number;
  pretaxDeferralRate?: number;
  stateCode?: string;
  month: MonthKey;
}

/**
 * Replace the primary job income. `removeIncome` is a no-op when the id is
 * absent, so this is safe whatever the prior state (student with no job, a
 * different job, etc.) — every career change funnels through the one id.
 */
export function setPrimaryJob(params: JobParams): StateMutation[] {
  return [
    { kind: "removeIncome", id: PRIMARY_JOB_ID },
    {
      kind: "addIncome",
      income: {
        config: {
          id: PRIMARY_JOB_ID,
          label: params.label,
          baseMonthlyGrossCents: cents(params.monthlyGrossDollars),
          annualGrowthRate: params.annualGrowthRate ?? 0.03,
          stateCode: params.stateCode ?? "TX",
          pretaxDeferralRate: params.pretaxDeferralRate ?? 0.03,
          startMonth: params.month,
        },
      },
    },
  ];
}

/** Stop earning the primary job income (e.g. leaving the workforce for school). */
export function clearPrimaryJob(): StateMutation {
  return { kind: "removeIncome", id: PRIMARY_JOB_ID };
}

/** Add (or replace) the tuition expense, ending at `endMonth` (expected graduation). */
export function setTuition(params: { monthlyDollars: number; month: MonthKey; endMonth?: MonthKey }): StateMutation[] {
  return [
    { kind: "removeExpense", id: TUITION_EXPENSE_ID },
    {
      kind: "addExpense",
      expense: {
        config: {
          id: TUITION_EXPENSE_ID,
          label: "Tuition & fees",
          category: "fixed",
          baseMonthlyAmountCents: cents(params.monthlyDollars),
          annualInflationRate: 0.04,
          startMonth: params.month,
          endMonth: params.endMonth,
        },
      },
    },
  ];
}

/** Remove the tuition expense (graduation / withdrawal). */
export function dropTuition(): StateMutation {
  return { kind: "removeExpense", id: TUITION_EXPENSE_ID };
}

/** Adjust the recurring cost of living (military housing lowers it; moving out raises it). */
export function setLivingCost(params: { monthlyDollars: number }): StateMutation {
  return { kind: "patchExpenseConfig", id: LIVING_EXPENSE_ID, patch: { baseMonthlyAmountCents: cents(params.monthlyDollars) } };
}

/** A one-time cost paid from primary cash (application fees, exam fees, tools). */
export function spendCash(dollars: number): StateMutation {
  return { kind: "adjustCash", deltaCents: -cents(dollars) };
}

/** A one-time cash inflow (bonus, refund, gift). */
export function gainCash(dollars: number): StateMutation {
  return { kind: "adjustCash", deltaCents: cents(dollars) };
}

/** Scale the primary job's pay by a factor — a raise (>1) or a cut (<1) — leaving any spouse income alone. */
export function scalePrimaryJob(factor: number): StateMutation {
  return { kind: "scaleIncome", id: PRIMARY_JOB_ID, factor };
}

/** Multiply the recurring cost of living (a rent hike, or a belt-tightening cut). */
export function scaleLiving(factor: number): StateMutation {
  return { kind: "scaleExpense", id: LIVING_EXPENSE_ID, factor };
}

export interface EffectParams {
  /** Stable base id for the decision record; the month is appended so replays stay unique. */
  id: string;
  domain: string;
  optionId: string;
  label: string;
  month: MonthKey;
  importanceLevel?: "major" | "minor";
  comparisonMetricKeys?: readonly string[];
  mutations: StateMutation[];
}

/** Assemble an `EventEffect` (audit decision + mutations) — the shape `applyEvent`/`forkWithEvent` consume. */
export function buildEffect(params: EffectParams): EventEffect {
  return {
    decision: {
      id: `${params.id}:${params.month}`,
      domain: params.domain,
      optionId: params.optionId,
      label: params.label,
      effectiveFromMonth: params.month,
      importance: params.importanceLevel
        ? {
            level: params.importanceLevel,
            reason: params.label,
            comparisonMetricKeys: params.comparisonMetricKeys ?? ["netWorthCents"],
            requiresExplicitConfirmation: params.importanceLevel === "major",
          }
        : undefined,
    },
    mutations: params.mutations,
  };
}
