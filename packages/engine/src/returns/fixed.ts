import type { ReturnRequest, ReturnResult, ReturnsStrategy } from "./types.js";

/** Converts an annual rate to an equivalent monthly compounding rate (not a flat /12 division). */
export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Deterministic constant return per asset class — ignores `rng` entirely.
 * Useful as a baseline scenario and for golden-master tests where the
 * simulation's output must be exactly reproducible without any
 * statistical variance.
 */
export function createFixedReturnsStrategy(annualRatesByAssetClass: Record<string, number>): ReturnsStrategy {
  return {
    id: "fixed",
    kind: "fixed",
    nextReturn(request: ReturnRequest): ReturnResult {
      const annualRate = annualRatesByAssetClass[request.assetClassId] ?? 0;
      return { month: request.month, assetClassId: request.assetClassId, nominalReturn: annualToMonthlyRate(annualRate) };
    },
  };
}
