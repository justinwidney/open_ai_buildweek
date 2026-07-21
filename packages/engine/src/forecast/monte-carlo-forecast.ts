import { createRandomSource } from "../rng/index.js";
import type { ReferenceDataBundle } from "../reference-data/index.js";
import type { ReturnsStrategy } from "../returns/index.js";
import type { MonthKey } from "../types/month.js";
import type { DecisionSet, LifeStateSnapshot } from "../simulation/state.js";
import { runSimulation } from "../simulation/run.js";
import { meanOf, percentileOfSorted } from "./percentile.js";

const DEFAULT_PERCENTILES = [10, 25, 50, 75, 90] as const;

export interface MonteCarloForecastParams {
  /** The month-0 starting point every sampled life begins from. */
  initial: LifeStateSnapshot;
  monthsToSimulate: number;
  /** How many independent sampled lives to run. More paths = smoother, more stable percentile bands. */
  paths: number;
  /**
   * The per-tick return model. For a genuine forecast this is normally a
   * Monte Carlo strategy (`createMonteCarloReturnsStrategy`), whose draws
   * come from each path's own `RandomSource`; a fixed strategy would make
   * every path identical and collapse the distribution to a single line.
   */
  returnsStrategy: ReturnsStrategy;
  referenceData: ReferenceDataBundle;
  /**
   * Base seed. Each path derives a distinct child seed deterministically
   * from it, so the same `(seed, paths)` reproduces the exact same forecast
   * — reproducibility is the whole point of threading an explicit RNG.
   */
  seed: string | number;
  /** Optional future decisions, applied identically across every path (a scenario, not a source of variance). */
  decisionDeltasByMonth?: Readonly<Record<MonthKey, DecisionSet>>;
  /** Percentiles (0–100) to report per month. Defaults to P10/P25/P50/P75/P90. */
  percentiles?: readonly number[];
  /** Net-worth goal used for `successProbability`; a path "succeeds" if its final-month net worth ≥ this. Defaults to 0. */
  goalCents?: number;
}

export interface MonthlyForecastBand {
  month: MonthKey;
  /** Mean net worth (cents) across all paths for this month. */
  meanCents: number;
  /** Requested-percentile → net-worth-cents for this month. Keys are the numbers passed in `percentiles`. */
  percentileCents: Record<number, number>;
}

export interface MonteCarloForecastResult {
  paths: number;
  monthsToSimulate: number;
  percentiles: readonly number[];
  /** Per-month net-worth distribution across all paths. Length is always `monthsToSimulate + 1` (month 0 included). */
  bands: readonly MonthlyForecastBand[];
  /** Every path's final-month net worth (cents), ascending — the raw terminal distribution for any custom stat. */
  terminalNetWorthCents: readonly number[];
  /** Each path's final-month snapshot (in path order), so any metric — not just net worth — can be evaluated over the distribution (see goals/). */
  terminalSnapshots: readonly LifeStateSnapshot[];
  /** Fraction (0–1) of paths whose final-month net worth ≥ `goalCents`. */
  successProbability: number;
  /** Fraction (0–1) of paths whose net worth dips below zero in any month (ran out of money at some point). */
  ruinProbability: number;
}

/** Deterministically derives a distinct child seed per path from the base seed. */
function pathSeed(base: string | number, pathIndex: number): string {
  return `${base}:path:${pathIndex}`;
}

/**
 * Runs `paths` independent simulated lives from the same starting point,
 * each with its own deterministic RNG stream, and aggregates their net
 * worth into per-month percentile bands plus terminal success/ruin
 * probabilities — the standard "Monte Carlo retirement projection" output.
 *
 * Pure and reproducible: same params in, same result out, no `Math.random`
 * and no mutation of `initial`.
 */
export function runMonteCarloForecast(params: MonteCarloForecastParams): MonteCarloForecastResult {
  if (params.paths <= 0) throw new Error("runMonteCarloForecast requires at least one path");
  const percentiles = params.percentiles ?? DEFAULT_PERCENTILES;
  const goalCents = params.goalCents ?? 0;
  const monthCount = params.monthsToSimulate + 1; // includes month 0

  // netWorthByMonth[m] gathers every path's net worth at month m, so a column read gives that month's distribution.
  const netWorthByMonth: number[][] = Array.from({ length: monthCount }, () => [] as number[]);
  const terminalNetWorthCents: number[] = [];
  const terminalSnapshots: LifeStateSnapshot[] = [];
  let ruinCount = 0;
  let successCount = 0;

  for (let pathIndex = 0; pathIndex < params.paths; pathIndex++) {
    const rng = createRandomSource(pathSeed(params.seed, pathIndex));
    const { snapshots } = runSimulation(params.initial, params.monthsToSimulate, {
      returnsStrategy: params.returnsStrategy,
      referenceData: params.referenceData,
      rng,
      decisionDeltasByMonth: params.decisionDeltasByMonth,
    });

    let dippedBelowZero = false;
    for (let m = 0; m < snapshots.length; m++) {
      const netWorth = snapshots[m]!.netWorthCents;
      netWorthByMonth[m]!.push(netWorth);
      if (netWorth < 0) dippedBelowZero = true;
    }
    if (dippedBelowZero) ruinCount++;

    const terminalSnapshot = snapshots[snapshots.length - 1]!;
    terminalSnapshots.push(terminalSnapshot);
    const terminal = terminalSnapshot.netWorthCents;
    terminalNetWorthCents.push(terminal);
    if (terminal >= goalCents) successCount++;
  }

  const bands: MonthlyForecastBand[] = netWorthByMonth.map((column, month) => {
    const sorted = [...column].sort((a, b) => a - b);
    const percentileCents: Record<number, number> = {};
    for (const p of percentiles) percentileCents[p] = Math.round(percentileOfSorted(sorted, p));
    return { month, meanCents: Math.round(meanOf(column)), percentileCents };
  });

  return {
    paths: params.paths,
    monthsToSimulate: params.monthsToSimulate,
    percentiles: [...percentiles],
    bands,
    terminalNetWorthCents: [...terminalNetWorthCents].sort((a, b) => a - b),
    terminalSnapshots,
    successProbability: successCount / params.paths,
    ruinProbability: ruinCount / params.paths,
  };
}
