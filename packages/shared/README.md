# @control-ai/shared

Cross-package contracts. Two independent subpaths — import the one you need, never the root, in new code.

| Import | Holds | Depends on |
| --- | --- | --- |
| `@control-ai/shared/world` | 3D world geometry (`WorldDefinition`, `WorldPath`, `WorldPlatform`) | nothing |
| `@control-ai/shared/sim` | Simulation **persistence** contracts | `@control-ai/engine` (types) |
| `@control-ai/shared/life-sim` | Portable domain value contracts re-exported from the engine | `@control-ai/engine` |
| `@control-ai/shared` (root) | Re-exports `/world` only, for back-compat | nothing |

## The layering rule

```
@control-ai/engine        owns the domain model, knows nothing about storage
        ▲
@control-ai/shared/sim    owns what it means to persist one
        ▲
db · convex · worker · web · (cube, by test)
```

`sim` imports engine types; **the engine must never import `sim`.** The engine stays free of persistence concerns, and that one-directional edge is what prevents a cycle.

## Why `/sim` exists

Five packages were storing the same entities under different names and types:

- The core entity was a `run` in the engine, db, worker and Cube — and a `scenario` in Convex.
- `runs.status` was an untyped Postgres `text` column, a literal union in Convex, and a prose comment in Cube.
- `ReturnsStrategyConfig` lived in `@control-ai/worker`, which depends on `worker_threads` — so db, Convex and the web app all persisted that exact shape while unable to import its type, and stored it as `unknown` / `v.any()`.
- `rootSeed` had no type at all, anywhere.
- Convex's `decisions` table dropped the engine's `Decision.id`, so decisions could not round-trip back into a snapshot.
- The `domain`/`viewKey` vocabulary existed only as string literals inside `tick()`; Cube's YAML documented 3 of the 9 income view keys.

`/sim` is the single declaration of all of it. Two tests keep it honest:

- `src/sim/vocabulary.test.ts` runs a real simulation and asserts the vocabulary matches what `tick()` emits **in both directions** — a missing key and a stale key both fail.
- `packages/convex/convex/validators.ts` pins every Convex validator to its shared union at compile time, and `packages/cube/test/model.test.mjs` reads these constants out of the source to check the YAML documents them.

## `RunStore` — swapping backends

Application code depends on the `RunStore` interface, never a concrete backend, so "work offline" is a store swap at the composition root rather than a second code path through the UI.

```ts
import { createLocalRunStore, buildInitialSnapshot, monthsFromRunResult } from "@control-ai/shared/sim";

const store = createLocalRunStore({
  onQuotaExceeded: ({ evictedMonths }) => toast(`Trimmed detail for ${evictedMonths.length} older months`),
});

const runId = await store.createRun({ label: "Baseline", rootSeed: seed, returnsStrategy: { kind: "fixed", annualRatesByAssetClass: { equity: 0.07 } } });
const result = runSimulation(buildInitialSnapshot(runId, seed), 480, options);
await store.appendMonths({ runId, months: monthsFromRunResult(result), status: "done" });

await store.getNetWorthSeries(runId); // 480 points, cheap
```

`createMemoryRunStore()` has identical semantics for tests and SSR. `store.kind` reports `"memory"` rather than `"local"` when localStorage turned out to be unwritable (Safari private mode, blocked cookies), so the UI can warn that nothing is actually being saved.

### Storing a 40-year run in 5 MB

localStorage allows roughly 5 MB per origin. Measured, for one 480-month run with income, expenses, a mortgage, cash, a brokerage holding and a home:

| `persistDetail` | Size | Timeline |
| --- | --- | --- |
| `"all"` — every month verbatim | **3.59 MB** | 480 pts |
| `"keyframes"` (default, every 12th month + newest) | **0.64 MB** | 480 pts |
| `"none"` — index only | **0.38 MB** | 480 pts |

Storing every month verbatim fits exactly one run and fails partway through the second. Three properties follow:

1. **Light and heavy data are split.** Each run keeps one small index of `{ month, netWorthCents, taxBasis }`; each month's snapshot/statement/flows live under their own key. Eviction only touches heavy keys — the timeline and run list survive a full disk intact.
2. **Heavy detail is sampled, not stored wholesale.** The engine is deterministic and 480 months takes milliseconds, so a seed plus a nearby keyframe rebuilds any month far more cheaply than storing it. `nearestAnchorBefore(runId, month)` returns the anchor to restart from.
3. **Quota is a normal condition, not an exception.** A write that trips it evicts oldest-first (never the newest month — that is the resume point), retries, and reports through `onQuotaExceeded`. The light index is committed first, so a failure costs detail, never the timeline.

This is also why `RootSeed` is typed and paired with `buildInitialSnapshot`: seed + decisions + rng seed is a complete, replayable description of a run in a few kilobytes.
