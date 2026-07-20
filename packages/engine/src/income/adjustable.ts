import type { Adjustable } from "../adjustable/index.js";
import {
  federalIncomeTaxAdjustment,
  ficaMedicareAdjustment,
  ficaSocialSecurityAdjustment,
  retirement401kPretaxAdjustment,
  stateTaxAdjustment,
} from "../tax/index.js";
import type { IncomeState } from "./types.js";

/** Months per year, used to convert an annual growth rate into a per-month compounding step. */
const MONTHS_PER_YEAR = 12;

export function buildIncomeAdjustable(state: IncomeState, currentMonth: number): Adjustable {
  const { config } = state;
  const monthsActive = Math.max(0, currentMonth - config.startMonth);
  const yearsActive = monthsActive / MONTHS_PER_YEAR;

  return {
    id: config.id,
    label: config.label,
    grossCents(): number {
      const grown = config.baseMonthlyGrossCents * Math.pow(1 + config.annualGrowthRate, yearsActive);
      return Math.round(grown);
    },
    // Order matters: the pretax deferral must run before the tax adjustments so they see and
    // exclude it from taxable wages (see tax/pretax-keys.ts).
    adjustments: [
      retirement401kPretaxAdjustment({ deferralRate: config.pretaxDeferralRate }),
      federalIncomeTaxAdjustment(),
      stateTaxAdjustment(config.stateCode),
      ficaSocialSecurityAdjustment(),
      ficaMedicareAdjustment(),
    ],
  };
}
