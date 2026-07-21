import { isIsoDate, validationResult, type ValidationIssue, type ValidationResult } from "./values.js";

export const PAY_CADENCES = ["weekly", "biweekly", "semimonthly", "monthly"] as const;
export type PayCadence = (typeof PAY_CADENCES)[number];

export const PAYMENTS_PER_NORMAL_YEAR: Readonly<Record<PayCadence, number>> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export type NonBusinessDayPolicy = "previous-business-day" | "next-business-day" | "same-calendar-day";

/** Serializable rules for producing paycheck dates from a real calendar. */
export type PaySchedule =
  | {
      cadence: "weekly" | "biweekly";
      /** One known payday that fixes the continuing 7/14-day phase. */
      anchorPayDate: string;
    }
  | {
      cadence: "semimonthly";
      /** Two distinct 1-31 calendar days; values beyond month-end roll by policy. */
      daysOfMonth: readonly [number, number];
      nonBusinessDayPolicy: NonBusinessDayPolicy;
    }
  | {
      cadence: "monthly";
      dayOfMonth: number;
      nonBusinessDayPolicy: NonBusinessDayPolicy;
    };

export const SHIFT_KINDS = ["day", "evening", "night", "rotating", "on-call"] as const;
export type ShiftKind = (typeof SHIFT_KINDS)[number];

export type WorkPattern =
  | { kind: "weekly"; daysPerWeek: number }
  | {
      kind: "rotation";
      daysOn: number;
      daysOff: number;
      /** First on-duty day; rotation phase never resets at a month boundary. */
      anchorOnDate: string;
    };

export interface WorkSchedule {
  hoursPerShift: number;
  pattern: WorkPattern;
  shift: ShiftKind;
  expectedUnpaidWeeksPerYear?: number;
}

export function paymentsPerNormalYear(cadence: PayCadence): number {
  return PAYMENTS_PER_NORMAL_YEAR[cadence];
}

export function validatePaySchedule(schedule: PaySchedule): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (schedule.cadence === "weekly" || schedule.cadence === "biweekly") {
    if (!isIsoDate(schedule.anchorPayDate)) {
      issues.push({ code: "pay-schedule.invalid-anchor", severity: "error", message: "anchorPayDate must be a valid YYYY-MM-DD date", path: ["anchorPayDate"] });
    }
  } else if (schedule.cadence === "semimonthly") {
    const [first, second] = schedule.daysOfMonth;
    if (!isDayOfMonth(first) || !isDayOfMonth(second) || first === second) {
      issues.push({ code: "pay-schedule.invalid-days", severity: "error", message: "Semimonthly pay days must be distinct integers from 1 through 31", path: ["daysOfMonth"] });
    }
  } else if (schedule.cadence === "monthly" && !isDayOfMonth(schedule.dayOfMonth)) {
    issues.push({ code: "pay-schedule.invalid-day", severity: "error", message: "Monthly pay day must be an integer from 1 through 31", path: ["dayOfMonth"] });
  }
  return validationResult(issues);
}

export function validateWorkSchedule(schedule: WorkSchedule): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(schedule.hoursPerShift) || schedule.hoursPerShift <= 0 || schedule.hoursPerShift > 24) {
    issues.push({ code: "work-schedule.invalid-shift-hours", severity: "error", message: "hoursPerShift must be greater than 0 and at most 24", path: ["hoursPerShift"] });
  }
  if (schedule.expectedUnpaidWeeksPerYear !== undefined && (!Number.isFinite(schedule.expectedUnpaidWeeksPerYear) || schedule.expectedUnpaidWeeksPerYear < 0 || schedule.expectedUnpaidWeeksPerYear > 52)) {
    issues.push({ code: "work-schedule.invalid-unpaid-weeks", severity: "error", message: "expectedUnpaidWeeksPerYear must be from 0 through 52", path: ["expectedUnpaidWeeksPerYear"] });
  }
  if (schedule.pattern.kind === "weekly") {
    if (!Number.isInteger(schedule.pattern.daysPerWeek) || schedule.pattern.daysPerWeek < 1 || schedule.pattern.daysPerWeek > 7) {
      issues.push({ code: "work-schedule.invalid-days-per-week", severity: "error", message: "daysPerWeek must be an integer from 1 through 7", path: ["pattern", "daysPerWeek"] });
    }
  } else {
    if (!Number.isInteger(schedule.pattern.daysOn) || schedule.pattern.daysOn < 1) {
      issues.push({ code: "work-schedule.invalid-days-on", severity: "error", message: "daysOn must be a positive integer", path: ["pattern", "daysOn"] });
    }
    if (!Number.isInteger(schedule.pattern.daysOff) || schedule.pattern.daysOff < 1) {
      issues.push({ code: "work-schedule.invalid-days-off", severity: "error", message: "daysOff must be a positive integer", path: ["pattern", "daysOff"] });
    }
    if (!isIsoDate(schedule.pattern.anchorOnDate)) {
      issues.push({ code: "work-schedule.invalid-anchor", severity: "error", message: "anchorOnDate must be a valid YYYY-MM-DD date", path: ["pattern", "anchorOnDate"] });
    }
  }
  return validationResult(issues);
}

function isDayOfMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}
