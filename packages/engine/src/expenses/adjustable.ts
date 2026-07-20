import type { Adjustable } from "../adjustable/index.js";
import type { ExpenseState } from "./types.js";

const MONTHS_PER_YEAR = 12;

/**
 * Expenses have no tax/payroll pipeline of their own, but are still modeled
 * as `Adjustable`s (with an empty `adjustments` array by default) so a
 * future adjustment — an employer reimbursement, a subsidy, a one-time
 * discount — can be added as a line item without changing this folder's
 * public shape.
 */
export function buildExpenseAdjustable(state: ExpenseState, currentMonth: number): Adjustable {
  const { config } = state;
  const monthsActive = Math.max(0, currentMonth - config.startMonth);
  const yearsActive = monthsActive / MONTHS_PER_YEAR;

  return {
    id: config.id,
    label: config.label,
    grossCents(): number {
      const inflated = config.baseMonthlyAmountCents * Math.pow(1 + config.annualInflationRate, yearsActive);
      return Math.round(inflated);
    },
    adjustments: [],
  };
}
