import type { MonthKey } from "../types/month.js";
import type { RandomSource } from "../rng/index.js";

export interface ReturnRequest {
  month: MonthKey;
  assetClassId: string;
  rng: RandomSource;
}

export interface ReturnResult {
  month: MonthKey;
  assetClassId: string;
  /** This month's nominal return as a decimal fraction, e.g. 0.01 for +1%. */
  nominalReturn: number;
}

export type ReturnsStrategyKind = "fixed" | "monte-carlo" | "historical-backtest";

/**
 * Unifies fixed, Monte Carlo, and historical-backtest return generation
 * behind one interface `portfolio/` can consume without caring which mode
 * is active. Every call is pure given its inputs (including `rng`'s
 * current state) — no strategy may read `Math.random()` or any other
 * hidden global, so a run stays reproducible from its seed and safe to
 * resume mid-way through a worker chunk.
 */
export interface ReturnsStrategy {
  id: string;
  kind: ReturnsStrategyKind;
  nextReturn(request: ReturnRequest): ReturnResult;
}
