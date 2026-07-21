import {
  createLocalRunStore,
  monthsFromRunResult,
  type QuotaEvent,
  type RootSeed,
  type StoredDecision,
  type StoredRun,
} from "@control-ai/shared/sim";
import { HORIZON, RETURNS_STRATEGY, applyDecision, runBaseline, settingsFromSeed, type JourneyPath, type JourneyStep, type LifeSettings } from "./pathModel";
import { findOption } from "./lifeEvents";

/**
 * Saving and resuming a life, on top of `@control-ai/shared/sim`'s
 * localStorage backend. No Convex deployment, no network, no sign-in.
 *
 * ## What is actually stored
 *
 * Not the simulation output. A 480-month path serializes to ~3.5 MB against a
 * ~5 MB browser budget, so storing paths verbatim would fit one life and fail
 * on the second. What is stored instead is the *description* of a life — its
 * `RootSeed` plus the ordered decisions taken — a few kilobytes, from which
 * the engine reproduces the path deterministically in about two milliseconds.
 * `restoreJourney` is that replay.
 *
 * The store still keeps a light per-month index (net worth + tax basis) so a
 * saved-life list can preview a path without re-running anything, and full
 * snapshots at 12-month keyframes — which line up exactly with the year stops
 * the UI travels between.
 *
 * ## Why one run rather than a fork per decision
 *
 * The store models branches (`forkRun`), and a comparison UI showing several
 * diverging lives at once should use them. This lab shows a single life the
 * user reshapes in place, so it keeps one run and overwrites the months after
 * each fork — `appendMonths` is idempotent per month, so re-appending a
 * recomputed range is the intended way to do that.
 */

export const runStore = createLocalRunStore({
  namespace: "control-ai/decision-travel/v1",
  // 12 months matches STOP_MONTHS, so every keyframe is a stop the UI can land on.
  keyframeInterval: 12,
  onQuotaExceeded: (event: QuotaEvent) => {
    lastQuotaEvent = event;
    // Not fatal: the timeline and the seed both survive, only older month
    // detail is dropped, and that detail is recomputable from the seed.
    console.warn(`[decision-travel] storage full — trimmed detail for ${event.evictedMonths.length} months`, event);
  },
});

let lastQuotaEvent: QuotaEvent | null = null;
export function consumeQuotaEvent(): QuotaEvent | null {
  const event = lastQuotaEvent;
  lastQuotaEvent = null;
  return event;
}

/** A saved life, as shown in the resume list. */
export interface SavedLife {
  run: StoredRun;
  settings: LifeSettings;
  /** Furthest month travelled to — where a resume picks up. */
  progressMonth: number;
  netWorthCents: number;
  decisionCount: number;
}

export async function listSavedLives(): Promise<SavedLife[]> {
  const runs = await runStore.listRuns();
  const lives = await Promise.all(
    runs.map(async (run) => {
      const latest = await runStore.getLatestMonth(run.id);
      const decisions = await runStore.listDecisions(run.id);
      return {
        run,
        settings: settingsFromSeed(run.rootSeed),
        progressMonth: latest?.month ?? 0,
        netWorthCents: latest?.netWorthCents ?? 0,
        decisionCount: decisions.length,
      };
    }),
  );
  // Most recently touched first — the one a returning user almost always wants.
  return lives.sort((a, b) => b.run.updatedAt - a.run.updatedAt);
}

/**
 * Creates a run for a new life and returns the path simulated under it.
 *
 * The run is created *before* the path is simulated so every snapshot is
 * stamped with the real run id. Building the path first and attaching the id
 * afterwards leaves `LifeStateSnapshot.runId` reading `"life"`, which then
 * disagrees with the same life after a reload — a discrepancy that survives
 * into any snapshot written to storage.
 *
 * Only month 0 is persisted up front even though the whole horizon is already
 * computed: months are appended as the user travels, which makes the stored
 * range double as the progress marker (`getLatestMonth`) without inventing a
 * field for it.
 */
export async function createLife(settings: LifeSettings, seed: RootSeed): Promise<{ runId: string; journey: JourneyPath }> {
  const runId = await runStore.createRun({ label: `Life from age ${settings.age}`, rootSeed: seed, returnsStrategy: RETURNS_STRATEGY });
  const journey = runBaseline(settings, runId);
  await persistThrough(runId, journey, 0, 0);
  await runStore.updateRunStatus(runId, "running");
  return { runId, journey };
}

/**
 * Persists the months in `[fromMonth, toMonth]` of a journey.
 *
 * Called on travel (to extend the stored range) and after a decision (to
 * overwrite the months the fork changed). `monthsFromRunResult` handles the
 * off-by-one that catches every persistence layer: `runSimulation` returns one
 * more snapshot than detail, because its first snapshot is the input month
 * rather than a computed one.
 */
export async function persistThrough(runId: string, journey: JourneyPath, fromMonth: number, toMonth: number): Promise<void> {
  const first = Math.max(0, fromMonth);
  const last = Math.min(toMonth, HORIZON);
  const months = monthsFromRunResult(
    {
      // A window of the path, shaped the way `monthsFromRunResult` expects:
      // snapshots leading by one, so index i of details pairs with i+1 of snapshots.
      snapshots: journey.snapshots.slice(first, last + 1),
      details: journey.details.slice(first, last),
    },
    { includeStartSnapshot: first === 0 },
  );
  if (months.length === 0) return;
  await runStore.appendMonths({ runId, months });
}

/** Records a fork on the run and rewrites every month it changed. */
export async function persistDecision(runId: string, journey: JourneyPath, step: JourneyStep, throughMonth: number): Promise<void> {
  const decision: Omit<StoredDecision, "runId"> = {
    // The catalog ids are what `restoreJourney` replays from, so they are the id.
    id: encodeStepId(step),
    month: step.month,
    domain: "life-event",
    optionId: step.optionId,
    label: step.label,
    effectiveFromMonth: step.month,
  };
  await runStore.appendMonths({ runId, months: [], decisions: [decision] });
  await persistThrough(runId, journey, step.month, throughMonth);
}

/**
 * Rebuilds a saved life by re-running the engine from its seed and replaying
 * every stored decision in order. Returns the path plus how far the user had
 * travelled and which events have already fired (so a scheduled milestone does
 * not offer itself twice).
 */
export async function restoreJourney(life: SavedLife): Promise<{ journey: JourneyPath; baseline: JourneyPath; fired: Set<string> }> {
  const baseline = runBaseline(life.settings, life.run.id);
  const decisions = await runStore.listDecisions(life.run.id);
  const steps = decisions
    .map((d) => decodeStepId(d.id, d.label))
    .filter((s): s is JourneyStep => s !== null)
    .sort((a, b) => a.month - b.month);

  let journey = baseline;
  const fired = new Set<string>();
  for (const step of steps) {
    fired.add(step.eventId);
    const option = findOption(step.eventId, step.optionId);
    // A declined option (`build: null`) still counts as fired but changes
    // nothing; an option removed from the catalog since the save is skipped
    // rather than throwing, so an old save stays loadable.
    if (!option?.build) continue;
    journey = applyDecision(journey, step.month, option.build(step.month), step);
  }
  return { journey, baseline, fired };
}

export async function deleteLife(runId: string): Promise<void> {
  await runStore.deleteRun(runId);
}

/**
 * A stored decision's id encodes the catalog choice that produced it. The
 * engine's own `Decision.id` is free-form, so this rides along in it instead of
 * needing a field the shared contract does not have — and it is what makes a
 * decision replayable rather than merely readable.
 */
function encodeStepId(step: JourneyStep): string {
  return `${step.eventId}#${step.optionId}@${step.month}`;
}

function decodeStepId(id: string, label: string): JourneyStep | null {
  const match = /^(.+)#(.+)@(\d+)$/.exec(id);
  if (!match) return null;
  return { eventId: match[1]!, optionId: match[2]!, month: Number(match[3]), label };
}

/** Storage health, for the footer indicator. `kind === "memory"` means nothing is really being saved. */
export function storageStatus(): { kind: string; kb: number; durable: boolean } {
  return { kind: runStore.kind, kb: Math.round(runStore.approximateBytesUsed() / 1024), durable: runStore.kind === "local" };
}
