export type IslandTransitionPhase =
  | "idle"
  | "accelerating"
  | "cruising"
  | "decelerating"
  | "settling"
  | "complete";

export interface IslandTransitionDurations {
  accelerationMs: number;
  cruiseMs: number;
  decelerationMs: number;
  settlingMs: number;
  reducedMotionRevealMs: number;
}

export interface IslandTransitionDepthDesync {
  /** Maximum normalized delay for close scenery. */
  maxNearDepthLag: number;
  /** Maximum normalized delay for the distant backdrop. */
  maxBackgroundDepthLag: number;
  /** Makes the passed island clear the camera before travel finishes. */
  outgoingWorldLead: number;
}

export interface IslandTransitionOptions {
  durations?: Partial<IslandTransitionDurations>;
  depthDesync?: Partial<IslandTransitionDepthDesync>;
  travelDistance?: number;
  maxBlurPx?: number;
  maxMotionBlurIntensity?: number;
  reducedMotion?: boolean;
}

export interface IslandTransitionFrame {
  phase: IslandTransitionPhase;
  phaseProgress: number;
  /** Normalized time through the acceleration/cruise/deceleration journey. */
  progress: number;
  /** Distance-integrated progress. Equal timestamps always produce equal values. */
  easedProgress: number;
  overallProgress: number;
  /** Primary 0–1 value for moving the camera/world along its forward path. */
  worldOffsetProgress: number;
  forwardDistance: number;
  normalizedVelocity: number;
  velocityPerSecond: number;
  motionBlurIntensity: number;
  blurPx: number;
  /** Transient normalized lag relative to worldOffsetProgress. */
  nearDepthLag: number;
  /** Transient normalized lag relative to worldOffsetProgress. */
  backgroundDepthLag: number;
  nearLayerProgress: number;
  backgroundLayerProgress: number;
  outgoingWorldProgress: number;
  incomingWorldProgress: number;
  outgoingOpacity: number;
  incomingOpacity: number;
  shouldRenderOutgoing: boolean;
  shouldRenderIncoming: boolean;
  outgoingBehindCamera: boolean;
  inputLocked: boolean;
  reducedMotion: boolean;
  complete: boolean;
  /** Stateless completion condition; controllers provide the one-frame disposal pulse. */
  outgoingCanBeDisposed: boolean;
}

export interface IslandTransitionSnapshot extends IslandTransitionFrame {
  transitionId: number;
  completedTransitions: number;
  completedThisFrame: boolean;
  /** True once, on the update that transfers ownership to the incoming island. */
  shouldDisposeOutgoing: boolean;
}

export const DEFAULT_ISLAND_TRANSITION_DURATIONS: Readonly<IslandTransitionDurations> = {
  accelerationMs: 520,
  cruiseMs: 900,
  decelerationMs: 680,
  settlingMs: 180,
  reducedMotionRevealMs: 140
};

export const DEFAULT_ISLAND_TRANSITION_DEPTH_DESYNC: Readonly<IslandTransitionDepthDesync> = {
  maxNearDepthLag: 0.055,
  maxBackgroundDepthLag: 0.24,
  outgoingWorldLead: 0.16
};

interface ResolvedOptions {
  durations: IslandTransitionDurations;
  depthDesync: IslandTransitionDepthDesync;
  travelDistance: number;
  maxBlurPx: number;
  maxMotionBlurIntensity: number;
}

interface ActiveTransition {
  id: number;
  startedAtMs: number;
  reducedMotion: boolean;
}

interface TravelSample {
  phase: Exclude<IslandTransitionPhase, "idle" | "settling" | "complete">;
  phaseProgress: number;
  progress: number;
  distanceProgress: number;
  normalizedVelocity: number;
  velocityPerSecond: number;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

function smoothstepBetween(value: number, start: number, end: number) {
  if (start === end) return value >= end ? 1 : 0;
  return smoothstep((value - start) / (end - start));
}

function assertFiniteNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite, non-negative number.`);
  }
}

function assertTimestamp(name: string, value: number) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

function resolveOptions(options: IslandTransitionOptions = {}): ResolvedOptions {
  const durations = {
    ...DEFAULT_ISLAND_TRANSITION_DURATIONS,
    ...options.durations
  };
  const depthDesync = {
    ...DEFAULT_ISLAND_TRANSITION_DEPTH_DESYNC,
    ...options.depthDesync
  };
  for (const [name, value] of Object.entries(durations)) assertFiniteNonNegative(name, value);
  for (const [name, value] of Object.entries(depthDesync)) assertFiniteNonNegative(name, value);

  const travelDistance = options.travelDistance ?? 24;
  const maxBlurPx = options.maxBlurPx ?? 8;
  const maxMotionBlurIntensity = options.maxMotionBlurIntensity ?? 0.82;
  assertFiniteNonNegative("travelDistance", travelDistance);
  assertFiniteNonNegative("maxBlurPx", maxBlurPx);
  assertFiniteNonNegative("maxMotionBlurIntensity", maxMotionBlurIntensity);
  if (maxMotionBlurIntensity > 1) {
    throw new RangeError("maxMotionBlurIntensity must not exceed 1.");
  }

  return { durations, depthDesync, travelDistance, maxBlurPx, maxMotionBlurIntensity };
}

/** Integrates a continuous trapezoidal velocity profile into 0–1 distance. */
function sampleTravel(elapsedMs: number, options: ResolvedOptions): TravelSample {
  const { accelerationMs, cruiseMs, decelerationMs } = options.durations;
  const travelDurationMs = accelerationMs + cruiseMs + decelerationMs;
  if (travelDurationMs === 0) {
    return {
      phase: "decelerating",
      phaseProgress: 1,
      progress: 1,
      distanceProgress: 1,
      normalizedVelocity: 0,
      velocityPerSecond: 0
    };
  }

  const safeElapsed = Math.min(travelDurationMs, Math.max(0, elapsedMs));
  const effectiveAreaMs = accelerationMs / 2 + cruiseMs + decelerationMs / 2;
  const peakProgressPerMs = effectiveAreaMs === 0 ? 0 : 1 / effectiveAreaMs;
  const accelerationDistance = peakProgressPerMs * accelerationMs / 2;
  const cruiseDistance = peakProgressPerMs * cruiseMs;

  if (accelerationMs > 0 && safeElapsed < accelerationMs) {
    const phaseProgress = safeElapsed / accelerationMs;
    return {
      phase: "accelerating",
      phaseProgress,
      progress: safeElapsed / travelDurationMs,
      distanceProgress: clamp01(accelerationDistance * phaseProgress * phaseProgress),
      normalizedVelocity: phaseProgress,
      velocityPerSecond: peakProgressPerMs * phaseProgress * 1_000
    };
  }

  const cruiseElapsed = safeElapsed - accelerationMs;
  if (cruiseMs > 0 && cruiseElapsed < cruiseMs) {
    return {
      phase: "cruising",
      phaseProgress: cruiseElapsed / cruiseMs,
      progress: safeElapsed / travelDurationMs,
      distanceProgress: clamp01(accelerationDistance + peakProgressPerMs * cruiseElapsed),
      normalizedVelocity: 1,
      velocityPerSecond: peakProgressPerMs * 1_000
    };
  }

  const decelerationElapsed = Math.max(0, cruiseElapsed - cruiseMs);
  const phaseProgress = decelerationMs === 0 ? 1 : clamp01(decelerationElapsed / decelerationMs);
  const decelerationDistance = decelerationMs === 0
    ? 0
    : peakProgressPerMs * decelerationMs * (phaseProgress - phaseProgress * phaseProgress / 2);
  return {
    phase: "decelerating",
    phaseProgress,
    progress: safeElapsed / travelDurationMs,
    distanceProgress: clamp01(accelerationDistance + cruiseDistance + decelerationDistance),
    normalizedVelocity: safeElapsed >= travelDurationMs ? 0 : 1 - phaseProgress,
    velocityPerSecond: safeElapsed >= travelDurationMs
      ? 0
      : peakProgressPerMs * (1 - phaseProgress) * 1_000
  };
}

function makeFrame(
  elapsedMs: number,
  options: ResolvedOptions,
  reducedMotion: boolean
): IslandTransitionFrame {
  const { accelerationMs, cruiseMs, decelerationMs, settlingMs, reducedMotionRevealMs } = options.durations;

  if (reducedMotion) {
    const progress = reducedMotionRevealMs === 0
      ? 1
      : clamp01(Math.max(0, elapsedMs) / reducedMotionRevealMs);
    const reveal = smoothstep(progress);
    const complete = progress >= 1;
    return {
      phase: complete ? "complete" : "settling",
      phaseProgress: progress,
      progress,
      easedProgress: reveal,
      overallProgress: progress,
      worldOffsetProgress: 0,
      forwardDistance: 0,
      normalizedVelocity: 0,
      velocityPerSecond: 0,
      motionBlurIntensity: 0,
      blurPx: 0,
      nearDepthLag: 0,
      backgroundDepthLag: 0,
      nearLayerProgress: 0,
      backgroundLayerProgress: 0,
      outgoingWorldProgress: 0,
      incomingWorldProgress: 1,
      outgoingOpacity: 1 - reveal,
      incomingOpacity: reveal,
      shouldRenderOutgoing: !complete,
      shouldRenderIncoming: true,
      outgoingBehindCamera: false,
      inputLocked: !complete,
      reducedMotion: true,
      complete,
      outgoingCanBeDisposed: complete
    };
  }

  const travelDurationMs = accelerationMs + cruiseMs + decelerationMs;
  const totalDurationMs = travelDurationMs + settlingMs;
  const safeElapsed = Math.max(0, elapsedMs);
  const travel = sampleTravel(safeElapsed, options);
  const complete = totalDurationMs === 0 || safeElapsed >= totalDurationMs;
  const isSettling = !complete && safeElapsed >= travelDurationMs;
  const worldOffsetProgress = travel.distanceProgress;
  const desyncEnvelope = Math.sin(worldOffsetProgress * Math.PI);
  const nearDepthLag = desyncEnvelope * options.depthDesync.maxNearDepthLag;
  const backgroundDepthLag = desyncEnvelope * options.depthDesync.maxBackgroundDepthLag;
  const nearLayerProgress = clamp01(worldOffsetProgress - nearDepthLag);
  const backgroundLayerProgress = clamp01(worldOffsetProgress - backgroundDepthLag);
  const outgoingWorldProgress = clamp01(
    worldOffsetProgress * (1 + options.depthDesync.outgoingWorldLead)
  );
  const incomingWorldProgress = nearLayerProgress;
  const motionBlurIntensity = travel.normalizedVelocity * options.maxMotionBlurIntensity;
  const outgoingOpacity = 1 - smoothstepBetween(outgoingWorldProgress, 0.2, 0.82);
  const incomingOpacity = smoothstepBetween(incomingWorldProgress, 0.18, 0.88);
  const settlingProgress = settlingMs === 0
    ? 1
    : clamp01((safeElapsed - travelDurationMs) / settlingMs);

  return {
    phase: complete ? "complete" : isSettling ? "settling" : travel.phase,
    phaseProgress: complete ? 1 : isSettling ? settlingProgress : travel.phaseProgress,
    progress: travel.progress,
    easedProgress: worldOffsetProgress,
    overallProgress: totalDurationMs === 0 ? 1 : clamp01(safeElapsed / totalDurationMs),
    worldOffsetProgress,
    forwardDistance: worldOffsetProgress * options.travelDistance,
    normalizedVelocity: travel.normalizedVelocity,
    velocityPerSecond: travel.velocityPerSecond * options.travelDistance,
    motionBlurIntensity,
    blurPx: travel.normalizedVelocity * options.maxBlurPx,
    nearDepthLag,
    backgroundDepthLag,
    nearLayerProgress,
    backgroundLayerProgress,
    outgoingWorldProgress,
    incomingWorldProgress,
    outgoingOpacity: complete ? 0 : outgoingOpacity,
    incomingOpacity: complete ? 1 : incomingOpacity,
    shouldRenderOutgoing: !complete && outgoingOpacity > 0,
    shouldRenderIncoming: true,
    outgoingBehindCamera: outgoingWorldProgress >= 0.84,
    inputLocked: !complete,
    reducedMotion: false,
    complete,
    outgoingCanBeDisposed: complete
  };
}

/** Pure, frame-rate-independent transition sampling for render loops and tests. */
export function sampleIslandTransition(
  elapsedMs: number,
  options: IslandTransitionOptions = {}
): IslandTransitionFrame {
  assertTimestamp("elapsedMs", elapsedMs);
  return makeFrame(Math.max(0, elapsedMs), resolveOptions(options), options.reducedMotion ?? false);
}

function makeIdleFrame(reducedMotion: boolean): IslandTransitionFrame {
  return {
    phase: "idle",
    phaseProgress: 1,
    progress: 1,
    easedProgress: 1,
    overallProgress: 1,
    worldOffsetProgress: 0,
    forwardDistance: 0,
    normalizedVelocity: 0,
    velocityPerSecond: 0,
    motionBlurIntensity: 0,
    blurPx: 0,
    nearDepthLag: 0,
    backgroundDepthLag: 0,
    nearLayerProgress: 0,
    backgroundLayerProgress: 0,
    outgoingWorldProgress: 0,
    incomingWorldProgress: 0,
    outgoingOpacity: 1,
    incomingOpacity: 0,
    shouldRenderOutgoing: true,
    shouldRenderIncoming: false,
    outgoingBehindCamera: false,
    inputLocked: false,
    reducedMotion,
    complete: true,
    outgoingCanBeDisposed: false
  };
}

export class IslandTransitionController {
  readonly #options: ResolvedOptions;
  #active?: ActiveTransition;
  #completedTransitions = 0;
  #nextTransitionId = 1;
  #reducedMotion: boolean;

  constructor(options: IslandTransitionOptions = {}) {
    this.#options = resolveOptions(options);
    this.#reducedMotion = options.reducedMotion ?? false;
  }

  get inputLocked() {
    return this.#active !== undefined;
  }

  get isActive() {
    return this.#active !== undefined;
  }

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

  update(nowMs: number): IslandTransitionSnapshot {
    assertTimestamp("nowMs", nowMs);
    const active = this.#active;
    if (!active) return this.#idleSnapshot(false);

    const frame = makeFrame(
      Math.max(0, nowMs - active.startedAtMs),
      this.#options,
      active.reducedMotion
    );
    if (frame.complete) {
      this.#active = undefined;
      this.#completedTransitions += 1;
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

  cancel(): IslandTransitionSnapshot {
    this.#active = undefined;
    return this.#idleSnapshot(false);
  }

  /** Changing preference mid-flight immediately commits the already-staged island. */
  setReducedMotion(reducedMotion: boolean): IslandTransitionSnapshot {
    this.#reducedMotion = reducedMotion;
    const active = this.#active;
    if (active && active.reducedMotion !== reducedMotion) {
      this.#active = undefined;
      this.#completedTransitions += 1;
      const { accelerationMs, cruiseMs, decelerationMs, settlingMs, reducedMotionRevealMs } =
        this.#options.durations;
      const completionElapsedMs = reducedMotion
        ? reducedMotionRevealMs
        : accelerationMs + cruiseMs + decelerationMs + settlingMs;
      const finalFrame = makeFrame(completionElapsedMs, this.#options, reducedMotion);
      return {
        ...finalFrame,
        transitionId: active.id,
        completedTransitions: this.#completedTransitions,
        completedThisFrame: true,
        shouldDisposeOutgoing: true
      };
    }
    return this.#idleSnapshot(false);
  }

  #idleSnapshot(completedThisFrame: boolean): IslandTransitionSnapshot {
    return {
      ...makeIdleFrame(this.#reducedMotion),
      transitionId: this.#active?.id ?? 0,
      completedTransitions: this.#completedTransitions,
      completedThisFrame,
      shouldDisposeOutgoing: false
    };
  }
}

export function createIslandTransitionController(options: IslandTransitionOptions = {}) {
  return new IslandTransitionController(options);
}
