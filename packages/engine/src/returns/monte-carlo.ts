import type { ReturnRequest, ReturnResult, ReturnsStrategy } from "./types.js";
import { annualToMonthlyRate } from "./fixed.js";

export interface AssetClassDistribution {
  /** Expected annual return (arithmetic mean of the underlying monthly lognormal process). */
  annualMeanReturn: number;
  /** Annual return standard deviation (volatility). */
  annualVolatility: number;
}

/**
 * Samples each month's return from a lognormal distribution parameterized
 * by annual mean/volatility — the standard model for "Monte Carlo
 * retirement simulator" tools, which avoids the (small but real) chance a
 * plain normal distribution assigns of returns below -100%. Every draw
 * consumes the supplied `RandomSource`, so the same seed reproduces the
 * exact same sample path.
 */
export function createMonteCarloReturnsStrategy(distributionsByAssetClass: Record<string, AssetClassDistribution>): ReturnsStrategy {
  return {
    id: "monte-carlo",
    kind: "monte-carlo",
    nextReturn(request: ReturnRequest): ReturnResult {
      const distribution = distributionsByAssetClass[request.assetClassId];
      if (!distribution) {
        return { month: request.month, assetClassId: request.assetClassId, nominalReturn: 0 };
      }
      const monthlyMean = annualToMonthlyRate(distribution.annualMeanReturn);
      const monthlyVolatility = distribution.annualVolatility / Math.sqrt(12);

      // Lognormal: log(1 + r) ~ Normal(mu, sigma), mu chosen so E[1+r] matches the target monthly mean.
      const sigma = monthlyVolatility;
      const mu = Math.log(1 + monthlyMean) - (sigma * sigma) / 2;
      const z = request.rng.nextGaussian();
      const nominalReturn = Math.exp(mu + sigma * z) - 1;

      return { month: request.month, assetClassId: request.assetClassId, nominalReturn };
    },
  };
}
