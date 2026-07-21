import {
  buildMonthlyStatement,
  createRandomSource,
  forkWithEvent,
  referenceData2026,
  rootRun,
  runSimulation,
  cents,
  type EventEffect,
  type LifeStateSnapshot,
  type MonthDetail,
  type MonthlyStatement,
} from "@control-ai/engine";
import { buildInitialSnapshot, buildReturnsStrategy, type ReturnsStrategyConfig, type RootSeed } from "@control-ai/shared/sim";

export const HORIZON = 480; // 40 years of months
export const STOP_MONTHS = 12;
export const STOPS = HORIZON / STOP_MONTHS;

/**
 * The returns strategy as serializable config rather than a live strategy
 * object, because this is the exact value stored on the run — see
 * `@control-ai/shared/sim`. `buildReturnsStrategy` rehydrates it here the same
 * way the worker thread does on its side of a message boundary.
 */
export const RETURNS_STRATEGY: ReturnsStrategyConfig = { kind: "fixed", annualRatesByAssetClass: { equity: 0.07 } };
export const RNG_SEED = "decision-travel";

const returnsStrategy = buildReturnsStrategy(RETURNS_STRATEGY);
const runOptions = () => ({ returnsStrategy, referenceData: referenceData2026, rng: createRandomSource(RNG_SEED) });

export interface LifeSettings {
  age: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  startingCash: number;
  startingInvestments: number;
  deferralPct: number;
}

export const DEFAULT_SETTINGS: LifeSettings = { age: 24, monthlyIncome: 7500, monthlyExpenses: 3800, startingCash: 16000, startingInvestments: 9000, deferralPct: 6 };

/** One fork taken along a path — the engine's decision plus the catalog ids needed to replay it. */
export interface JourneyStep {
  month: number;
  label: string;
  eventId: string;
  optionId: string;
}

export interface JourneyPath {
  /** The persisted run this path belongs to, or null while it is unsaved. */
  runId: string | null;
  snapshots: readonly LifeStateSnapshot[];
  details: readonly MonthDetail[];
  /** The forks taken to reach this path, in order. */
  history: JourneyStep[];
}

/**
 * The setup form as a `RootSeed` — the value written to the run's seed field.
 * Everything the simulation needs to reproduce month 0 lives here, which is
 * what lets a saved life be restored by re-running the engine instead of
 * reloading megabytes of snapshots.
 */
export function seedFromSettings(settings: LifeSettings): RootSeed {
  return {
    version: 1,
    startCalendarYear: 2026,
    filingStatus: "single",
    ageYearsAtStart: settings.age,
    incomes: [
      {
        id: "job",
        label: "Career",
        baseMonthlyGrossCents: cents(settings.monthlyIncome),
        annualGrowthRate: 0.03,
        stateCode: "TX",
        pretaxDeferralRate: settings.deferralPct / 100,
        startMonth: 0,
      },
    ],
    expenses: [{ id: "living", label: "Living costs", category: "fixed", baseMonthlyAmountCents: cents(settings.monthlyExpenses), annualInflationRate: 0.03, startMonth: 0 }],
    debts: [],
    financialAssets: [{ config: { id: "cash", label: "Cash", annualInterestRate: 0.01 }, openingBalanceCents: cents(settings.startingCash) }],
    holdings: [{ config: { id: "brokerage", label: "Investments", assetClassId: "equity", accountType: "taxableBrokerage" }, openingBalanceCents: cents(settings.startingInvestments) }],
    physicalAssets: [],
    rngSeed: RNG_SEED,
  };
}

/** The inverse, for repopulating the setup form when a saved life is resumed. */
export function settingsFromSeed(seed: RootSeed): LifeSettings {
  const income = seed.incomes[0];
  const expense = seed.expenses[0];
  return {
    age: seed.ageYearsAtStart ?? DEFAULT_SETTINGS.age,
    monthlyIncome: (income?.baseMonthlyGrossCents ?? 0) / 100,
    monthlyExpenses: (expense?.baseMonthlyAmountCents ?? 0) / 100,
    startingCash: (seed.financialAssets[0]?.openingBalanceCents ?? 0) / 100,
    startingInvestments: (seed.holdings[0]?.openingBalanceCents ?? 0) / 100,
    deferralPct: (income?.pretaxDeferralRate ?? 0) * 100,
  };
}

export function buildInitial(settings: LifeSettings, runId = "life"): LifeStateSnapshot {
  return buildInitialSnapshot(runId, seedFromSettings(settings));
}

export function runBaseline(settings: LifeSettings, runId: string | null = null): JourneyPath {
  const { snapshots, details } = runSimulation(buildInitial(settings, runId ?? "life"), HORIZON, runOptions());
  return { runId, snapshots, details, history: [] };
}

/**
 * Re-forks a journey at `forkMonth` with an accepted event and recomputes
 * forward, keeping the shared prefix.
 *
 * `step` carries the catalog ids alongside the engine's own decision. The
 * `EventEffect` holds closures and cannot be persisted, so those two ids are
 * what a reload replays from — see `findOption` in lifeEvents.
 */
export function applyDecision(journey: JourneyPath, forkMonth: number, effect: EventEffect, step: Pick<JourneyStep, "eventId" | "optionId">): JourneyPath {
  const parentAtFork = journey.snapshots[forkMonth]!;
  const runId = journey.runId ?? "life";
  const { snapshot } = forkWithEvent({ parent: rootRun(runId), forkMonth, newRunId: runId, parentSnapshotAtFork: parentAtFork, effect });
  const forward = runSimulation(snapshot, HORIZON - forkMonth, runOptions());
  return {
    runId: journey.runId,
    snapshots: [...journey.snapshots.slice(0, forkMonth), ...forward.snapshots],
    details: [...journey.details.slice(0, forkMonth), ...forward.details],
    history: [...journey.history, { month: forkMonth, label: effect.decision.label, eventId: step.eventId, optionId: step.optionId }],
  };
}

/** The statement for a journey at a given month (detail included when the month was computed). */
export function statementAt(journey: JourneyPath, month: number, ageYearsAtStart: number): MonthlyStatement | null {
  const snapshot = journey.snapshots[month];
  if (!snapshot) return null;
  const detail = month > 0 ? journey.details[month - 1] : undefined;
  return buildMonthlyStatement({ snapshot, detail, context: { ageYearsAtStart } });
}
