import type { HistoricalReturnsDataset } from "../reference-data/types.js";
import type { ReturnRequest, ReturnResult, ReturnsStrategy } from "./types.js";
import { annualToMonthlyRate } from "./fixed.js";

export interface HistoricalBacktestOptions {
  datasetsByAssetClass: Record<string, HistoricalReturnsDataset>;
  /**
   * The historical calendar year the simulation's month 0 replays. If
   * omitted, a single random start year is chosen once (via the supplied
   * `RandomSource`, on the first call) and held fixed for the rest of the
   * run — the common "randomly-chosen historical sequence" backtest mode
   * (à la FIRECalc/cFIREcalc), without needing a second strategy shape.
   */
  startYear?: number;
}

/**
 * Replays a real, dated annual-return sequence, spreading each year's
 * annual figure evenly across its 12 months (a simplification — real
 * markets aren't evenly distributed within a year, but monthly-resolution
 * historical data isn't in `reference-data/` yet). When the replay runs
 * past the dataset's last year, it wraps back to the first year rather
 * than erroring, so a run longer than the dataset's span still produces a
 * result — flagged here rather than hidden, since a wrapped sequence
 * repeats history rather than extending it.
 */
export function createHistoricalBacktestStrategy(options: HistoricalBacktestOptions): ReturnsStrategy {
  let resolvedStartYear: number | null = options.startYear ?? null;

  return {
    id: "historical-backtest",
    kind: "historical-backtest",
    nextReturn(request: ReturnRequest): ReturnResult {
      const dataset = options.datasetsByAssetClass[request.assetClassId];
      if (!dataset || dataset.annualReturns.length === 0) {
        return { month: request.month, assetClassId: request.assetClassId, nominalReturn: 0 };
      }

      if (resolvedStartYear === null) {
        const index = Math.floor(request.rng.next() * dataset.annualReturns.length);
        resolvedStartYear = dataset.annualReturns[index]!.year;
      }

      const yearOffset = Math.floor(request.month / 12);
      const years = dataset.annualReturns;
      const startIndex = years.findIndex((r) => r.year === resolvedStartYear);
      const safeStartIndex = startIndex === -1 ? 0 : startIndex;
      const index = (safeStartIndex + yearOffset) % years.length;
      const annualReturn = years[index]!.totalReturn;

      return { month: request.month, assetClassId: request.assetClassId, nominalReturn: annualToMonthlyRate(annualReturn) };
    },
  };
}
