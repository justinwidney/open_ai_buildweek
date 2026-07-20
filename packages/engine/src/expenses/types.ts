import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";

export type ExpenseCategory = "fixed" | "discretionary";

export interface ExpenseConfig {
  id: string;
  label: string;
  category: ExpenseCategory;
  baseMonthlyAmountCents: Cents;
  /** Annual inflation rate this expense escalates by; 0 for a fixed-amount obligation (e.g. a level loan payment tracked elsewhere). */
  annualInflationRate: number;
  startMonth: MonthKey;
  endMonth?: MonthKey;
}

export interface ExpenseState {
  config: ExpenseConfig;
}

export function isExpenseActive(state: ExpenseState, month: MonthKey): boolean {
  return month >= state.config.startMonth && (state.config.endMonth === undefined || month < state.config.endMonth);
}
