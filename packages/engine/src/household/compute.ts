import { cents } from "../money/index.js";
import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { Dependent, Household, Person } from "./types.js";

const MONTHS_PER_YEAR = 12;

// 2026 child tax credit: $2,000 per qualifying child under 17. The MAGI phase-out
// ($200k single / $400k MFJ) is NOT modeled here — this is the pre-phase-out base
// amount. Source: IRC §24 as amended; verify against the final 2026 figure before
// relying on it for a high-income household.
const DEFAULT_CTC_PER_CHILD_CENTS = cents(2_000);
const CTC_MAX_AGE = 17; // must be under 17 at year-end

/** Whole-year age of someone with the given birth-month offset, at run month `month`. */
export function ageYearsAt(birthMonth: number, month: MonthKey): number {
  return Math.floor((month - birthMonth) / MONTHS_PER_YEAR);
}

/** The primary person of a household (throws if none is marked primary — a household must have one). */
export function primaryPerson(household: Household): Person {
  const primary = household.members.find((m) => m.role === "primary");
  if (!primary) throw new Error("Household has no primary member");
  return primary;
}

/** Dependents strictly under `maxAgeExclusive` at `month`. */
export function dependentsUnderAge(household: Household, month: MonthKey, maxAgeExclusive: number): readonly Dependent[] {
  return household.dependents.filter((d) => ageYearsAt(d.birthMonth, month) < maxAgeExclusive);
}

/** Children (kind === "child") who still qualify for the child tax credit (under 17) at `month`. */
export function qualifyingChildrenForCtc(household: Household, month: MonthKey): readonly Dependent[] {
  return dependentsUnderAge(household, month, CTC_MAX_AGE).filter((d) => d.kind === "child");
}

export interface ChildTaxCreditOptions {
  perChildCents?: Cents;
}

/**
 * The base child tax credit for a household at a given month: qualifying
 * children under 17 × the per-child amount. Pre-phase-out (MAGI limits not
 * modeled). Returned as a positive credit; wiring it into federal withholding
 * is a follow-up tax-integration step, not done here.
 */
export function childTaxCreditCents(household: Household, month: MonthKey, options: ChildTaxCreditOptions = {}): Cents {
  const perChild = options.perChildCents ?? DEFAULT_CTC_PER_CHILD_CENTS;
  return qualifyingChildrenForCtc(household, month).length * perChild;
}

export interface HouseholdContext {
  filingStatus: Household["filingStatus"];
  /** Whole-year age of the primary person at this month — the anchor for "results at a certain age". */
  primaryAgeYears: number;
  /** Whole-year age of the spouse, if there is one. */
  spouseAgeYears?: number;
  dependentCount: number;
  /** Children under 13 — the population for a childcare-cost estimate. */
  childrenUnder13: number;
  /** Qualifying children for the child tax credit (under 17). */
  qualifyingChildrenForCtc: number;
  estimatedAnnualChildTaxCreditCents: Cents;
}

/** Derives the month-specific facts a statement / tax layer wants from a household. */
export function householdContextAt(household: Household, month: MonthKey, options: ChildTaxCreditOptions = {}): HouseholdContext {
  const spouse = household.members.find((m) => m.role === "spouse");
  return {
    filingStatus: household.filingStatus,
    primaryAgeYears: ageYearsAt(primaryPerson(household).birthMonth, month),
    spouseAgeYears: spouse ? ageYearsAt(spouse.birthMonth, month) : undefined,
    dependentCount: household.dependents.length,
    childrenUnder13: dependentsUnderAge(household, month, 13).filter((d) => d.kind === "child").length,
    qualifyingChildrenForCtc: qualifyingChildrenForCtc(household, month).length,
    estimatedAnnualChildTaxCreditCents: childTaxCreditCents(household, month, options),
  };
}
