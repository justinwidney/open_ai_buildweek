/**
 * A month index relative to a run's anchor start date: month 0 is the
 * anchor month itself, month 1 is one calendar month later, and so on.
 * Using an integer offset (rather than a Date) keeps every domain reducer
 * pure and trivially comparable/sortable, and keeps calendar concerns
 * (which tax year a month falls in, month-of-year for seasonal effects)
 * as an explicit conversion at the edges instead of scattered Date math.
 */
export type MonthKey = number;

/** Converts a run-relative month offset to a concrete calendar date. */
export function monthKeyToDate(anchorDate: Date, month: MonthKey): Date {
  const result = new Date(anchorDate);
  result.setUTCMonth(result.getUTCMonth() + month);
  return result;
}

/** The calendar year a given run month falls in, e.g. for tax bracket lookup. */
export function calendarYearOf(anchorDate: Date, month: MonthKey): number {
  return monthKeyToDate(anchorDate, month).getUTCFullYear();
}

/** 1-12 calendar month-of-year, e.g. for seasonal expenses or bonus timing. */
export function monthOfYear(anchorDate: Date, month: MonthKey): number {
  return monthKeyToDate(anchorDate, month).getUTCMonth() + 1;
}

/** True for the last simulated month of a calendar year (for YTD resets). */
export function isDecember(anchorDate: Date, month: MonthKey): boolean {
  return monthOfYear(anchorDate, month) === 12;
}
