import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Piscina from "piscina";

/**
 * Resolves the worker entry file for whichever mode we're running in:
 * after `pnpm build`, `tick-worker.js` exists alongside this file and
 * needs no special loader; running from source (tests, `pnpm dev`) via
 * `tsx`, only `tick-worker.ts` exists on disk, so the spawned worker
 * thread needs the same `tsx` loader the main thread already has.
 */
function resolveWorkerEntry(): { filename: string; execArgv: string[] } {
  const compiledPath = fileURLToPath(new URL("./tick-worker.js", import.meta.url));
  if (existsSync(compiledPath)) {
    return { filename: compiledPath, execArgv: [] };
  }
  const sourcePath = fileURLToPath(new URL("./tick-worker.ts", import.meta.url));
  return { filename: sourcePath, execArgv: ["--import", "tsx"] };
}

export function createPool(overrides: Partial<ConstructorParameters<typeof Piscina>[0]> = {}): Piscina {
  const { filename, execArgv } = resolveWorkerEntry();
  return new Piscina({ filename, execArgv, ...overrides });
}
