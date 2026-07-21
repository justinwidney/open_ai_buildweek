import type { JsonValue, StableId } from "../contracts/values.js";
import type { MonthKey } from "../types/month.js";
import { initialLifeProfile, normalizeLifeProfile, type LifeProfileState } from "./life-profile.js";

/**
 * The coarse life phase the decision graph branches on — the single most
 * important piece of state ("you are in school" vs "you are working"). It is a
 * string union with an open `(string & {})` escape hatch so a catalog can add a
 * phase without an engine change, while the known set still autocompletes.
 */
export type LifeStage =
  | "pre-launch" // just finished high school, no path chosen yet
  | "school" // enrolled in a degree program
  | "working" // in the workforce
  | "apprenticeship" // paid trade apprenticeship, pre-ticket
  | "gap-year" // taking a year before re-choosing the root path
  | "military" // active service
  | "unemployed" // between jobs and actively choosing a search/retraining path
  // deno-lint-ignore ban-types
  | (string & {});

export const KNOWN_LIFE_STAGES = ["pre-launch", "school", "working", "apprenticeship", "gap-year", "military", "unemployed"] as const;

/**
 * The durable, JSON-serializable position in the life graph. Everything a
 * precondition needs to decide "is this crossroads reachable now" lives here —
 * nothing closes over functions, so a whole journey can be persisted and
 * replayed by re-walking the graph. `flags` is the fine-grained memory a branch
 * writes (`{ major: "nursing", degreeEarned: true }`) and later preconditions
 * read; `stage` is the coarse phase; the id lists gate re-firing.
 */
export interface LifeContext {
  /** Age in years at `month`. Drives age-gated availability (marriage, home). */
  ageYears: number;
  /** Run-relative month the context is evaluated at (month 0 = the anchor). */
  month: MonthKey;
  stage: LifeStage;
  /** The month the current stage was entered — lets a precondition ask "how many years in this stage." */
  stageStartedMonth: MonthKey;
  flags: Readonly<Record<string, JsonValue>>;
  /** Nodes already resolved, so a one-time crossroads never re-fires (a branch can `reopen` one). */
  resolvedNodeIds: readonly StableId[];
  /** Nodes a prior branch permanently removed from ever being offered. */
  blockedNodeIds: readonly StableId[];
  /** Nodes deferred until a later month; unlike a permanent block, they are automatically re-offered. */
  deferredNodeUntilMonth: Readonly<Record<StableId, MonthKey>>;
  /** Typed, versioned life state used by decisions instead of accumulating unstructured flags. */
  profile: LifeProfileState;
  /** Derived money summary for affordability gates; recomputed each year, not persisted. */
  finances?: FinancialSummary;
}

/**
 * A derived, point-in-time summary of the money path — the fields a
 * precondition needs to gate on affordability (a home when there's a down
 * payment, a car when there's cash, saving more when the rate is low). It is
 * *recomputed* from the current statement each year and attached to the
 * context; it is never a source of truth, so it is not persisted. Threshold
 * nodes read `ctx.finances`; when it's absent they simply aren't eligible yet.
 */
export interface FinancialSummary {
  /** Cash + taxable investments — what could fund a near-term purchase. */
  liquidCents: number;
  cashCents: number;
  monthlyGrossCents: number;
  monthlyTakeHomeCents: number;
  monthlySpendingCents: number;
  monthlyDebtPaymentCents: number;
  netWorthCents: number;
  /** Cash ÷ monthly spending — months of runway the emergency fund covers. */
  emergencyFundMonths: number;
  /** Total savings as a share of gross, in [0, 1]. */
  savingsRate: number;
}

/**
 * The structured result of testing a precondition. Per the events README, an
 * ineligible node/option is *shown with reasons*, never silently dropped — so
 * the UI can explain "not available until you've worked 3 years" rather than a
 * choice vanishing. `warnings` are non-blocking caveats on an eligible option.
 */
export interface Eligibility {
  eligible: boolean;
  reasons: readonly string[];
  warnings: readonly string[];
}

export function eligible(warnings: readonly string[] = []): Eligibility {
  return { eligible: true, reasons: [], warnings };
}

export function ineligible(...reasons: readonly string[]): Eligibility {
  return { eligible: false, reasons, warnings: [] };
}

/** The workhorse for authoring a precondition: eligible iff `condition`, otherwise blocked with `reason`. */
export function gate(condition: boolean, reason: string): Eligibility {
  return condition ? eligible() : ineligible(reason);
}

/** Combine several checks: eligible iff every check is, accumulating all reasons and warnings. */
export function allOf(...checks: readonly Eligibility[]): Eligibility {
  return {
    eligible: checks.every((c) => c.eligible),
    reasons: checks.flatMap((c) => c.reasons),
    warnings: checks.flatMap((c) => c.warnings),
  };
}

/**
 * Gate on the derived finances: ineligible (with `reason`) when the summary is
 * missing or the predicate fails. The single helper every affordability
 * precondition uses, so a threshold is never evaluated against absent money.
 */
export function moneyGate(ctx: LifeContext, predicate: (f: FinancialSummary) => boolean, reason: string): Eligibility {
  return ctx.finances && predicate(ctx.finances) ? eligible() : ineligible(reason);
}

/** Attach a freshly computed money summary to a context (called each travel year by the caller). */
export function withFinances(ctx: LifeContext, finances: FinancialSummary): LifeContext {
  return { ...ctx, finances };
}

/** Months elapsed in the current life stage. */
export function monthsInStage(ctx: LifeContext): number {
  return ctx.month - ctx.stageStartedMonth;
}

/** Whole years elapsed in the current life stage. */
export function yearsInStage(ctx: LifeContext): number {
  return Math.floor(monthsInStage(ctx) / 12);
}

/** Raw flag value, or undefined when unset. */
export function flag(ctx: LifeContext, key: string): JsonValue | undefined {
  return ctx.flags[key];
}

/** True when a flag is set to a truthy value (present, not null, not false). */
export function hasFlag(ctx: LifeContext, key: string): boolean {
  const value = ctx.flags[key];
  return value !== undefined && value !== null && value !== false;
}

/** A flag read as a number (0 when unset or non-numeric) — for timers like a graduation delay. */
export function numberFlag(ctx: LifeContext, key: string): number {
  const value = ctx.flags[key];
  return typeof value === "number" ? value : 0;
}

export interface InitialLifeContextParams {
  ageYears: number;
  month?: MonthKey;
  stage?: LifeStage;
  flags?: Record<string, JsonValue>;
}

/** The starting context for a fresh life — by default an 18-year-old at the pre-launch crossroads. */
export function initialLifeContext(params: InitialLifeContextParams): LifeContext {
  const month = params.month ?? 0;
  return {
    ageYears: params.ageYears,
    month,
    stage: params.stage ?? "pre-launch",
    stageStartedMonth: month,
    flags: params.flags ?? {},
    resolvedNodeIds: [],
    blockedNodeIds: [],
    deferredNodeUntilMonth: {},
    profile: initialLifeProfile(),
  };
}

/** Runtime migration guard for contexts restored from older JSON. */
export function normalizeLifeContext(ctx: LifeContext): LifeContext {
  return {
    ...ctx,
    deferredNodeUntilMonth: ctx.deferredNodeUntilMonth ?? {},
    profile: normalizeLifeProfile(ctx.profile),
  };
}

/**
 * Advance the clock to a new month/age without changing stage or flags — the
 * "a year rolled by" step the caller applies as the simulation ticks forward
 * between decisions.
 */
export function advanceLifeContext(ctx: LifeContext, params: { month: MonthKey; ageYears: number }): LifeContext {
  return { ...ctx, month: params.month, ageYears: params.ageYears };
}
