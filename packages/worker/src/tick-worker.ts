import { createRandomSource, referenceData2026, runSimulation, type LifeStateSnapshot, type RunSimulationResult } from "@control-ai/engine";
import { buildReturnsStrategy, type ReturnsStrategyConfig } from "./returns-config.js";

export interface TickJobPayload {
  fromSnapshot: LifeStateSnapshot;
  monthsToCompute: number;
  returnsStrategyConfig: ReturnsStrategyConfig;
  seed: string | number;
}

/**
 * The piscina worker-thread entry point. Deliberately pure CPU-bound
 * computation only — no `@control-ai/db` import here, and no persistence.
 * Two reasons: (1) PGlite (this project's zero-install Postgres-compatible
 * test/dev backend) doesn't support concurrent access to the same data
 * directory from multiple threads/processes, so "persist from inside the
 * worker" would only work against real Postgres and silently break local
 * dev/test; (2) it keeps the worker thread free of native DB driver
 * dependencies entirely, mirroring `@control-ai/engine`'s own "zero
 * Node-only/native deps" rule one level up. `orchestration.ts` (running on
 * the caller's thread) persists the returned `RunSimulationResult` through
 * a single shared connection instead — the standard pattern for an
 * embedded/pooled database connection regardless of the driver.
 */
export default async function runTickComputation(payload: TickJobPayload): Promise<RunSimulationResult> {
  const returnsStrategy = buildReturnsStrategy(payload.returnsStrategyConfig);
  const rng = createRandomSource(payload.seed);
  return runSimulation(payload.fromSnapshot, payload.monthsToCompute, { returnsStrategy, referenceData: referenceData2026, rng });
}
