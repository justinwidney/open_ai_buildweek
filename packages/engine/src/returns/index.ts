export type { ReturnRequest, ReturnResult, ReturnsStrategy, ReturnsStrategyKind } from "./types.js";
export { annualToMonthlyRate, createFixedReturnsStrategy } from "./fixed.js";
export { createMonteCarloReturnsStrategy, type AssetClassDistribution } from "./monte-carlo.js";
export { createHistoricalBacktestStrategy, type HistoricalBacktestOptions } from "./historical-backtest.js";
