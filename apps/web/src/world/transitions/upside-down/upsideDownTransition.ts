import { sampleSunsetWorldTurn } from "../../animation/world-spin";

const HALF_TURN_RADIANS = Math.PI;

export type UpsideDownTransitionPhase =
  | "idle"
  | "preparing"
  | "flipping"
  | "revealing"
  | "settling";

export interface UpsideDownTransitionDurations {
  preparingMs: number;
  flippingMs: number;
  revealingMs: number;
  settlingMs: number;
  reducedMotionRevealMs: number;
}

export interface UpsideDownTransitionOptions {
  durations?: Partial<UpsideDownTransitionDurations>;
  /**
   * Legacy normalized-time reveal point. Prefer incomingRevealAngleRadians so
   * custom easing cannot move the handoff away from the intended horizon.
   */
  contentSwapProgress?: number;
  /** Defaults to PI / 2: the incoming world begins appearing at 90 degrees. */
  incomingRevealAngleRadians?: number;
  reducedMotion?: boolean;
}

export interface UpsideDownTransitionFrame {
  phase: UpsideDownTransitionPhase;
  phaseProgress: number;
  overallProgress: number;
  /** Apply to the shared transition root's Z rotation. */
  rotationRadians: number;
  /** Apply to staged incoming content so it finishes the flip upright. */
  incomingContentRotationRadians: number;
  outgoingOpacity: number;
  incomingOpacity: number;
  shouldRenderOutgoing: boolean;
  shouldRenderIncoming: boolean;
  incomingRevealStarted: boolean;
  motionBlurIntensity: number;
  inputLocked: boolean;
  reducedMotion: boolean;
  complete: boolean;
  /** Stateless completion condition; controllers provide the one-frame pulse. */
  outgoingCanBeDisposed: boolean;
}

export interface UpsideDownTransitionSnapshot extends UpsideDownTransitionFrame {
  transitionId: number;
  completedTransitions: number;
  /** True for the first update that commits the newly revealed content. */
  completedThisFrame: boolean;
  /** True once, on the update where the outgoing world should be disposed. */
  shouldDisposeOutgoing: boolean;
}

export const DEFAULT_UPSIDE_DOWN_TRANSITION_DURATIONS: Readonly<UpsideDownTransitionDurations> = {
  preparingMs: 180,
  flippingMs: 2_600,
  revealingMs: 360,
  settlingMs: 220,
  reducedMotionRevealMs: 140
};

interface ResolvedOptions {
  durations: UpsideDownTransitionDurations;
  incomingRevealAngleRadians: number;
}

interface ActiveTransition {
  id: number;
  startedAtMs: number;
  reducedMotion: boolean;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function assertNonNegativeDuration(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite, non-negative number.`);
  }
}

function assertTimestamp(name: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
}

function resolveOptions(options: UpsideDownTransitionOptions = {}): ResolvedOptions {
  const durations: UpsideDownTransitionDurations = {
    ...DEFAULT_UPSIDE_DOWN_TRANSITION_DURATIONS,
    ...options.durations
  };

  for (const [name, duration] of Object.entries(durations)) {
    assertNonNegativeDuration(name, duration);
  }

  const contentSwapProgress = options.contentSwapProgress ?? 0.5;
  if (!Number.isFinite(contentSwapProgress) || contentSwapProgress <= 0 || contentSwapProgress >= 1) {
    throw new RangeError("contentSwapProgress must be greater than 0 and less than 1.");
  }

  const incomingRevealAngleRadians = options.incomingRevealAngleRadians
    ?? easeInOutSine(contentSwapProgress) * HALF_TURN_RADIANS;
  if (
    !Number.isFinite(incomingRevealAngleRadians)
    || incomingRevealAngleRadians <= 0
    || incomingRevealAngleRadians >= HALF_TURN_RADIANS
  ) {
    throw new RangeError("incomingRevealAngleRadians must be between 0 and PI radians.");
  }

  return { durations, incomingRevealAngleRadians };
}

function easeInOutSine(value: number) {
  return -(Math.cos(Math.PI * clamp01(value)) - 1) / 2;
}

function makeIdleFrame(reducedMotion: boolean): UpsideDownTransitionFrame {
  return {
    phase: "idle",
    phaseProgress: 1,
    overallProgress: 1,
    rotationRadians: 0,
    incomingContentRotationRadians: 0,
    outgoingOpacity: 1,
    incomingOpacity: 0,
    shouldRenderOutgoing: true,
    shouldRenderIncoming: false,
    incomingRevealStarted: false,
    motionBlurIntensity: 0,
    inputLocked: false,
    reducedMotion,
    complete: true,
    outgoingCanBeDisposed: false
  };
}

function makeCompletedFrame(reducedMotion: boolean): UpsideDownTransitionFrame {
  return {
    phase: "idle",
    phaseProgress: 1,
    overallProgress: 1,
    rotationRadians: reducedMotion ? 0 : HALF_TURN_RADIANS,
    incomingContentRotationRadians: reducedMotion ? 0 : -HALF_TURN_RADIANS,
    outgoingOpacity: 0,
    incomingOpacity: 1,
    shouldRenderOutgoing: false,
    shouldRenderIncoming: true,
    incomingRevealStarted: true,
    motionBlurIntensity: 0,
    inputLocked: false,
    reducedMotion,
    complete: true,
    outgoingCanBeDisposed: true
  };
}

function sampleReducedMotion(elapsedMs: number, options: ResolvedOptions): UpsideDownTransitionFrame {
  const duration = options.durations.reducedMotionRevealMs;
  if (duration === 0 || elapsedMs >= duration) return makeCompletedFrame(true);

  const progress = clamp01(elapsedMs / duration);
  const eased = easeOutCubic(progress);
  return {
    phase: "revealing",
    phaseProgress: progress,
    overallProgress: progress,
    rotationRadians: 0,
    incomingContentRotationRadians: 0,
    outgoingOpacity: 1 - eased,
    incomingOpacity: eased,
    shouldRenderOutgoing: progress < 1,
    shouldRenderIncoming: true,
    incomingRevealStarted: true,
    motionBlurIntensity: 0,
    inputLocked: true,
    reducedMotion: true,
    complete: false,
    outgoingCanBeDisposed: false
  };
}

function sampleFullMotion(elapsedMs: number, options: ResolvedOptions): UpsideDownTransitionFrame {
  const { preparingMs, flippingMs, revealingMs, settlingMs } = options.durations;
  const totalMs = preparingMs + flippingMs + revealingMs + settlingMs;
  if (totalMs === 0 || elapsedMs >= totalMs) return makeCompletedFrame(false);

  const preparingEnd = preparingMs;
  const flippingEnd = preparingEnd + flippingMs;
  const revealingEnd = flippingEnd + revealingMs;
  const overallProgress = clamp01(elapsedMs / totalMs);

  if (preparingMs > 0 && elapsedMs < preparingEnd) {
    return {
      phase: "preparing",
      phaseProgress: clamp01(elapsedMs / preparingMs),
      overallProgress,
      rotationRadians: 0,
      incomingContentRotationRadians: -HALF_TURN_RADIANS,
      outgoingOpacity: 1,
      incomingOpacity: 0,
      shouldRenderOutgoing: true,
      shouldRenderIncoming: false,
      incomingRevealStarted: false,
      motionBlurIntensity: 0,
      inputLocked: true,
      reducedMotion: false,
      complete: false,
      outgoingCanBeDisposed: false
    };
  }

  if (flippingMs > 0 && elapsedMs < flippingEnd) {
    const progress = clamp01((elapsedMs - preparingEnd) / flippingMs);
    const turn = sampleSunsetWorldTurn(elapsedMs - preparingEnd, {
      durationMs: flippingMs,
      incomingRevealAngleRadians: options.incomingRevealAngleRadians
    });
    const unsignedRotation = Math.abs(turn.rotationRadians);
    const hasSwapped = turn.incomingRevealStarted;
    const outgoingProgress = clamp01(unsignedRotation / options.incomingRevealAngleRadians);
    return {
      phase: "flipping",
      phaseProgress: progress,
      overallProgress,
      rotationRadians: turn.rotationRadians,
      incomingContentRotationRadians: turn.incomingCounterRotationRadians,
      outgoingOpacity: 1 - easeOutCubic(outgoingProgress),
      incomingOpacity: hasSwapped ? easeOutCubic(turn.incomingRevealProgress) * 0.65 : 0,
      shouldRenderOutgoing: !hasSwapped,
      shouldRenderIncoming: hasSwapped,
      incomingRevealStarted: hasSwapped,
      motionBlurIntensity: turn.motionBlurIntensity,
      inputLocked: true,
      reducedMotion: false,
      complete: false,
      outgoingCanBeDisposed: false
    };
  }

  if (revealingMs > 0 && elapsedMs < revealingEnd) {
    const progress = clamp01((elapsedMs - flippingEnd) / revealingMs);
    return {
      phase: "revealing",
      phaseProgress: progress,
      overallProgress,
      rotationRadians: HALF_TURN_RADIANS,
      incomingContentRotationRadians: -HALF_TURN_RADIANS,
      outgoingOpacity: 0,
      incomingOpacity: 0.65 + easeOutCubic(progress) * 0.35,
      shouldRenderOutgoing: false,
      shouldRenderIncoming: true,
      incomingRevealStarted: true,
      motionBlurIntensity: 0,
      inputLocked: true,
      reducedMotion: false,
      complete: false,
      outgoingCanBeDisposed: false
    };
  }

  const progress = settlingMs === 0 ? 1 : clamp01((elapsedMs - revealingEnd) / settlingMs);
  return {
    phase: "settling",
    phaseProgress: progress,
    overallProgress,
    rotationRadians: HALF_TURN_RADIANS,
    incomingContentRotationRadians: -HALF_TURN_RADIANS,
    outgoingOpacity: 0,
    incomingOpacity: 1,
    shouldRenderOutgoing: false,
    shouldRenderIncoming: true,
    incomingRevealStarted: true,
    motionBlurIntensity: 0,
    inputLocked: true,
    reducedMotion: false,
    complete: false,
    outgoingCanBeDisposed: false
  };
}

/**
 * Samples a transition from elapsed time. This pure function is useful for tests,
 * storybook controls, and render loops that already own their lifecycle.
 */
export function sampleUpsideDownTransition(
  elapsedMs: number,
  options: UpsideDownTransitionOptions = {}
): UpsideDownTransitionFrame {
  assertTimestamp("elapsedMs", elapsedMs);
  const resolved = resolveOptions(options);
  const safeElapsedMs = Math.max(0, elapsedMs);
  return options.reducedMotion
    ? sampleReducedMotion(safeElapsedMs, resolved)
    : sampleFullMotion(safeElapsedMs, resolved);
}

/**
 * Lifecycle wrapper around the pure sampler. Pass the same monotonic time source
 * (normally requestAnimationFrame's timestamp) to begin and update.
 */
export class UpsideDownTransitionController {
  readonly #options: ResolvedOptions;
  #active?: ActiveTransition;
  #completedTransitions = 0;
  #nextTransitionId = 1;
  #reducedMotion: boolean;

  constructor(options: UpsideDownTransitionOptions = {}) {
    this.#options = resolveOptions(options);
    this.#reducedMotion = options.reducedMotion ?? false;
  }

  get inputLocked() {
    return this.#active !== undefined;
  }

  get isActive() {
    return this.#active !== undefined;
  }

  /** Returns false when another transition already owns input. */
  begin(nowMs: number) {
    assertTimestamp("nowMs", nowMs);
    if (this.#active) return false;
    this.#active = {
      id: this.#nextTransitionId,
      startedAtMs: nowMs,
      reducedMotion: this.#reducedMotion
    };
    this.#nextTransitionId += 1;
    return true;
  }

  update(nowMs: number): UpsideDownTransitionSnapshot {
    assertTimestamp("nowMs", nowMs);
    const active = this.#active;
    if (!active) return this.#idleSnapshot(false);

    const elapsedMs = Math.max(0, nowMs - active.startedAtMs);
    const frame = active.reducedMotion
      ? sampleReducedMotion(elapsedMs, this.#options)
      : sampleFullMotion(elapsedMs, this.#options);

    if (frame.complete) {
      this.#completedTransitions += 1;
      this.#active = undefined;
      return {
        ...frame,
        transitionId: active.id,
        completedTransitions: this.#completedTransitions,
        completedThisFrame: true,
        shouldDisposeOutgoing: true
      };
    }

    return {
      ...frame,
      transitionId: active.id,
      completedTransitions: this.#completedTransitions,
      completedThisFrame: false,
      shouldDisposeOutgoing: false
    };
  }

  /** Cancels without committing the staged content. */
  cancel(): UpsideDownTransitionSnapshot {
    this.#active = undefined;
    return this.#idleSnapshot(false);
  }

  /**
   * Updates the preference for future transitions. Enabling reduced motion while
   * active immediately commits the staged content and removes the spatial motion.
   */
  setReducedMotion(reducedMotion: boolean): UpsideDownTransitionSnapshot {
    this.#reducedMotion = reducedMotion;
    const active = this.#active;
    if (active && active.reducedMotion !== reducedMotion) {
      this.#completedTransitions += 1;
      this.#active = undefined;
      return {
        ...makeCompletedFrame(reducedMotion),
        transitionId: active.id,
        completedTransitions: this.#completedTransitions,
        completedThisFrame: true,
        shouldDisposeOutgoing: true
      };
    }
    return this.#idleSnapshot(false);
  }

  #idleSnapshot(completedThisFrame: boolean): UpsideDownTransitionSnapshot {
    return {
      ...makeIdleFrame(this.#reducedMotion),
      transitionId: this.#active?.id ?? 0,
      completedTransitions: this.#completedTransitions,
      completedThisFrame,
      shouldDisposeOutgoing: false
    };
  }
}

export function createUpsideDownTransitionController(options: UpsideDownTransitionOptions = {}) {
  return new UpsideDownTransitionController(options);
}
