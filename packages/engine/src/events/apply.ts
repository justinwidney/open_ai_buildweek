import type { Decision, LifeStateSnapshot } from "../simulation/state.js";
import type { MonthKey } from "../types/month.js";
import { forkRun, type RunRef } from "../simulation/branch.js";
import { applyMutations, type StateMutation } from "./mutations.js";

/**
 * The applied form of a life-event choice: the audit `decision` to record and
 * the `mutations` that transform the state. Catalog builders (`catalog.ts`)
 * produce these; `applyEvent` folds one into a snapshot.
 */
export interface EventEffect {
  decision: Decision;
  mutations: readonly StateMutation[];
}

/** Replaces an existing decision with the same id, or appends it — keeps the audit trail one row per decision id. */
function upsertDecision(decisions: readonly Decision[], decision: Decision): readonly Decision[] {
  const existing = decisions.findIndex((d) => d.id === decision.id);
  if (existing < 0) return [...decisions, decision];
  return decisions.map((d, i) => (i === existing ? decision : d));
}

/**
 * Interprets a life-event choice into a new snapshot — the missing seam the
 * simulation kernel deliberately left to the caller (`tick` records decisions
 * but never acts on them). The result is the *diverged fork snapshot* a branch
 * runs forward from: same `runId`/`month`/`parentSnapshotRef` as the input
 * (the branching layer sets those), with the event's state changes applied and
 * the decision recorded. Pure: the input snapshot is not mutated.
 */
export function applyEvent(snapshot: LifeStateSnapshot, effect: EventEffect): LifeStateSnapshot {
  const mutated = applyMutations(snapshot, effect.mutations);
  return { ...mutated, decisions: upsertDecision(mutated.decisions, effect.decision) };
}

/** Applies several events in sequence (e.g. "marry and buy a home in the same month"). */
export function applyEvents(snapshot: LifeStateSnapshot, effects: readonly EventEffect[]): LifeStateSnapshot {
  return effects.reduce(applyEvent, snapshot);
}

export interface ForkWithEventParams {
  parent: RunRef;
  forkMonth: MonthKey;
  newRunId: string;
  /** The parent's snapshot at the fork month — the shared point the branch diverges from. */
  parentSnapshotAtFork: LifeStateSnapshot;
  /** The event(s) that make the branch different. One or many applied in order. */
  effect: EventEffect | readonly EventEffect[];
}

export interface ForkWithEventResult {
  ref: RunRef;
  /** The diverged fork snapshot, ready to hand to `runSimulation`/`extendRun` to run forward. */
  snapshot: LifeStateSnapshot;
}

/**
 * The end-to-end "what-if" in one call: fork a new run at `forkMonth` and
 * apply a life-event choice to the parent's snapshot there, yielding the
 * branch's `RunRef` and its diverged starting snapshot. Combines
 * `simulation/forkRun` (identity/branch bookkeeping) with `applyEvent` (the
 * state change) so a caller doesn't have to wire the `runId`/
 * `parentSnapshotRef` plumbing by hand.
 */
export function forkWithEvent(params: ForkWithEventParams): ForkWithEventResult {
  const ref = forkRun(params.parent, params.forkMonth, params.newRunId);
  const base: LifeStateSnapshot = {
    ...params.parentSnapshotAtFork,
    runId: params.newRunId,
    parentSnapshotRef: { runId: params.parent.runId, month: params.forkMonth },
  };
  const effects = Array.isArray(params.effect) ? params.effect : [params.effect as EventEffect];
  return { ref, snapshot: applyEvents(base, effects) };
}
