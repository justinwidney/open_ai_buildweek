import {
  buildMonthlyStatement,
  createRandomSource,
  forkWithEvent,
  initialLifeContext,
  referenceData2026,
  resolveBranch,
  rootRun,
  runSimulation,
  cents,
  type DecisionBranch,
  type DecisionNode,
  type LifeContext,
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

/** A just-graduated 18-year-old: a small part-time wage, low costs, little saved. */
export const DEFAULT_SETTINGS: LifeSettings = { age: 18, monthlyIncome: 1600, monthlyExpenses: 1400, startingCash: 3000, startingInvestments: 0, deferralPct: 0 };

/** One fork taken along a path — the engine's decision plus the life-graph ids needed to replay it. */
export interface JourneyStep {
  month: number;
  label: string;
  /** The decision node and chosen branch, so a reload replays the exact life-graph walk. */
  nodeId: string;
  branchId: string;
}

export interface JourneyPath {
  /** The persisted run this path belongs to, or null while it is unsaved. */
  runId: string | null;
  snapshots: readonly LifeStateSnapshot[];
  details: readonly MonthDetail[];
  /** The forks taken to reach this path, in order. */
  history: JourneyStep[];
  /** Where this life stands in the decision graph — the state the rule engine navigates by. */
  context: LifeContext;
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
  return { runId, snapshots, details, history: [], context: initialLifeContext({ ageYears: settings.age }) };
}

/** Advance the life context's clock as the traveller moves to a new year (no decision taken). */
export function travelContext(journey: JourneyPath, month: number, ageYears: number): JourneyPath {
  return { ...journey, context: { ...journey.context, month, ageYears } };
}

/**
 * Resolve a chosen decision branch at `forkMonth`: advance the life context
 * (stage/flags) via the rule engine, and — when the branch carries a financial
 * effect — re-fork the money path and recompute forward, keeping the shared
 * prefix. A branch with no effect (choosing "start working", declining) only
 * moves the context; the balance sheet is untouched until a later branch adds
 * income or a cost.
 *
 * The branch's `effect` closes over functions and cannot be persisted, so the
 * `(nodeId, branchId)` pair is what a reload replays from — the context is
 * rebuilt by re-walking the graph. `ctxAtFork` must already be advanced to
 * `forkMonth` (the caller does this on travel).
 */
export function applyDecision(journey: JourneyPath, forkMonth: number, node: DecisionNode, branch: DecisionBranch): JourneyPath {
  const ctxAtFork: LifeContext = { ...journey.context, month: forkMonth };
  const effect = branch.effect?.(ctxAtFork) ?? null;
  const nextContext = resolveBranch(ctxAtFork, node, branch);

  let snapshots = journey.snapshots;
  let details = journey.details;
  if (effect) {
    const runId = journey.runId ?? "life";
    const parentAtFork = journey.snapshots[forkMonth]!;
    const { snapshot } = forkWithEvent({ parent: rootRun(runId), forkMonth, newRunId: runId, parentSnapshotAtFork: parentAtFork, effect });
    const forward = runSimulation(snapshot, HORIZON - forkMonth, runOptions());
    snapshots = [...journey.snapshots.slice(0, forkMonth), ...forward.snapshots];
    details = [...journey.details.slice(0, forkMonth), ...forward.details];
  }

  return {
    runId: journey.runId,
    snapshots,
    details,
    history: [...journey.history, { month: forkMonth, label: effect?.decision.label ?? branch.label, nodeId: node.id, branchId: branch.id }],
    context: nextContext,
  };
}

/** The statement for a journey at a given month (detail included when the month was computed). */
export function statementAt(journey: JourneyPath, month: number, ageYearsAtStart: number): MonthlyStatement | null {
  const snapshot = journey.snapshots[month];
  if (!snapshot) return null;
  const detail = month > 0 ? journey.details[month - 1] : undefined;
  return buildMonthlyStatement({ snapshot, detail, context: { ageYearsAtStart } });
}
