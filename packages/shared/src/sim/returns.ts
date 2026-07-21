import {
  createFixedReturnsStrategy,
  createHistoricalBacktestStrategy,
  createMonteCarloReturnsStrategy,
  referenceData2026,
  type ReturnsStrategy,
  type ReturnsStrategyKind,
} from "@control-ai/engine";

/**
 * The serializable description of a returns strategy — what actually gets
 * stored in a run's `returns_strategy` column / document field.
 *
 * A live `ReturnsStrategy` closes over functions, so it can neither cross a
 * `worker_threads` boundary nor be written to a database; this plain-data
 * config is what travels, and `buildReturnsStrategy` rehydrates it.
 *
 * This used to live in @control-ai/worker, which depends on `piscina` and
 * `worker_threads` — meaning @control-ai/db, @control-ai/convex and the web
 * app all persisted this exact shape while being unable to import its type,
 * and so typed the column `unknown` / `v.any()`. It belongs here, next to the
 * record types that store it.
 */
export type ReturnsStrategyConfig =
  | { kind: "fixed"; annualRatesByAssetClass: Record<string, number> }
  | { kind: "monte-carlo"; distributionsByAssetClass: Record<string, { annualMeanReturn: number; annualVolatility: number }> }
  | { kind: "historical-backtest"; assetClassIds: readonly string[]; startYear?: number };

/** Compile-time guarantee that the config union covers exactly the engine's strategy kinds. */
type _AssertKindsMatch = ReturnsStrategyConfig["kind"] extends ReturnsStrategyKind ? (ReturnsStrategyKind extends ReturnsStrategyConfig["kind"] ? true : never) : never;
const _kindsMatch: _AssertKindsMatch = true;
void _kindsMatch;

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

export function isReturnsStrategyConfig(value: unknown): value is ReturnsStrategyConfig {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === "fixed" || kind === "monte-carlo" || kind === "historical-backtest";
}
