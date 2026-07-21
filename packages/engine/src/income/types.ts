import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { PaySchedule, StableId, VersionedReference, WorkSchedule } from "../contracts/index.js";

export interface IncomeSourceConfig {
  id: StableId;
  label: string;
  /** Household member who earns this income. Optional while legacy seeds migrate. */
  personId?: StableId;
  /** Immutable catalog definition selected for this job; actual pay terms remain snapshotted below. */
  occupationRef?: VersionedReference;
  /** Monthly gross amount at the time the source becomes active, before any growth is applied. */
  baseMonthlyGrossCents: Cents;
  /** Annual growth rate (raises/COLA), compounded once per simulated year the source has been active. */
  annualGrowthRate: number;
  stateCode: string;
  /** Fraction of gross deferred pretax into a 401(k)-style account each month; 0 to disable. */
  pretaxDeferralRate: number;
  /** Real paycheck cadence. When absent, the legacy monthly-normalized behavior is used. */
  paySchedule?: PaySchedule;
  /** Calendar-anchored work pattern, including schedules such as 7/7 and 10/4. */
  workSchedule?: WorkSchedule;
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
