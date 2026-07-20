import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";

export interface IncomeSourceConfig {
  id: string;
  label: string;
  /** Monthly gross amount at the time the source becomes active, before any growth is applied. */
  baseMonthlyGrossCents: Cents;
  /** Annual growth rate (raises/COLA), compounded once per simulated year the source has been active. */
  annualGrowthRate: number;
  stateCode: string;
  /** Fraction of gross deferred pretax into a 401(k)-style account each month; 0 to disable. */
  pretaxDeferralRate: number;
  /** The month this income source starts being paid — lets a "choose a job" decision add a source mid-run. */
  startMonth: MonthKey;
  /** The month (exclusive) this income source stops, e.g. a job change or retirement; undefined = indefinite. */
  endMonth?: MonthKey;
}

export interface IncomeState {
  config: IncomeSourceConfig;
}

export function isIncomeActive(state: IncomeState, month: MonthKey): boolean {
  return month >= state.config.startMonth && (state.config.endMonth === undefined || month < state.config.endMonth);
}
