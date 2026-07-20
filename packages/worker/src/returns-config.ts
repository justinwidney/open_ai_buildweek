import {
  createFixedReturnsStrategy,
  createHistoricalBacktestStrategy,
  createMonteCarloReturnsStrategy,
  referenceData2026,
  type ReturnsStrategy,
} from "@control-ai/engine";

/**
 * A `ReturnsStrategy` isn't serializable (it closes over functions) and
 * can't cross a `worker_threads` message boundary, so a job payload
 * carries this plain-data config instead — the worker thread reconstructs
 * the real strategy from it via `buildReturnsStrategy`, using the same
 * `@control-ai/engine` factories the main thread would use directly.
 */
export type ReturnsStrategyConfig =
  | { kind: "fixed"; annualRatesByAssetClass: Record<string, number> }
  | { kind: "monte-carlo"; distributionsByAssetClass: Record<string, { annualMeanReturn: number; annualVolatility: number }> }
  | { kind: "historical-backtest"; assetClassIds: readonly string[]; startYear?: number };

export function buildReturnsStrategy(config: ReturnsStrategyConfig): ReturnsStrategy {
  switch (config.kind) {
    case "fixed":
      return createFixedReturnsStrategy(config.annualRatesByAssetClass);
    case "monte-carlo":
      return createMonteCarloReturnsStrategy(config.distributionsByAssetClass);
    case "historical-backtest": {
      const datasetsByAssetClass = Object.fromEntries(
        config.assetClassIds.filter((id) => id in referenceData2026.historicalReturns).map((id) => [id, referenceData2026.historicalReturns[id]!]),
      );
      return createHistoricalBacktestStrategy({ datasetsByAssetClass, startYear: config.startYear });
    }
  }
}
