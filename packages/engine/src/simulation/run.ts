import type { RandomSource } from "../rng/index.js";
import type { ReferenceDataBundle } from "../reference-data/index.js";
import type { ReturnsStrategy } from "../returns/index.js";
import type { MonthKey } from "../types/month.js";
import type { DecisionSet, LifeStateSnapshot } from "./state.js";
import type { MonthDetail } from "./detail.js";
import { tick } from "./tick.js";

export interface RunSimulationOptions {
  returnsStrategy: ReturnsStrategy;
  referenceData: ReferenceDataBundle;
  rng: RandomSource;
  /** Decisions introduced at specific future months, e.g. `{ 24: [changeJobDecision] }`. */
  decisionDeltasByMonth?: Readonly<Record<MonthKey, DecisionSet>>;
}

export interface RunSimulationResult {
  /** Every snapshot including the starting one — length is always `monthsToSimulate + 1`. */
  snapshots: readonly LifeStateSnapshot[];
  /** Per-entity flow/balance detail for each *ticked* month — length is always `monthsToSimulate` (the starting month has no detail, nothing was computed for it). */
  details: readonly MonthDetail[];
}

/**
 * Ticks `initial` forward by `monthsToSimulate` months. This is the plain
 * in-memory driver; a worker chunk or a branch extension calls the same
 * `tick` function underneath, just starting from a different snapshot and
 * persisting `details` as it goes instead of collecting them in memory.
 */
export function runSimulation(initial: LifeStateSnapshot, monthsToSimulate: number, options: RunSimulationOptions): RunSimulationResult {
  const snapshots: LifeStateSnapshot[] = [initial];
  const details: MonthDetail[] = [];
  let current = initial;
  for (let i = 1; i <= monthsToSimulate; i++) {
    const month = initial.month + i;
    const decisionDeltas = options.decisionDeltasByMonth?.[month] ?? [];
    const result = tick({
      month,
      previous: current,
      decisionDeltas,
      returnsStrategy: options.returnsStrategy,
      referenceData: options.referenceData,
      rng: options.rng,
    });
    current = result.snapshot;
    snapshots.push(current);
    details.push(result.detail);
  }
  return { snapshots, details };
}
