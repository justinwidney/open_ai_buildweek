export interface WorldSpinOptions {
  speedRadiansPerSecond?: number;
  phaseRadians?: number;
  reducedMotion?: boolean;
}

export interface SunsetWorldTurnOptions {
  /** Duration of the spatial half-turn. */
  durationMs?: number;
  /** Signed direction around the camera-forward axis. */
  direction?: 1 | -1;
  /** Angle at which the staged world starts being revealed. */
  incomingRevealAngleRadians?: number;
  reducedMotion?: boolean;
}

export interface SunsetWorldTurnSnapshot {
  progress: number;
  easedProgress: number;
  rotationRadians: number;
  /** Constant counter-rotation for an incoming child of the turning root. */
  incomingCounterRotationRadians: number;
  angularVelocityRadiansPerSecond: number;
  normalizedAngularVelocity: number;
  incomingRevealProgress: number;
  incomingRevealStarted: boolean;
  motionBlurIntensity: number;
  reducedMotion: boolean;
  complete: boolean;
}

export const DEFAULT_SUNSET_WORLD_TURN_DURATION_MS = 2_600;

const HALF_TURN_RADIANS = Math.PI;
const QUARTER_TURN_RADIANS = Math.PI / 2;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeInOutSine(value: number) {
  return -(Math.cos(Math.PI * clamp01(value)) - 1) / 2;
}

function assertFinite(name: string, value: number) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

/** Absolute-time decorative rotation. The hero 180° roll remains transition-owned. */
export function sampleWorldSpin(elapsedSeconds: number, options: WorldSpinOptions = {}) {
  assertFinite("elapsedSeconds", elapsedSeconds);
  const phase = options.phaseRadians ?? 0;
  if (options.reducedMotion) return phase;
  return phase + elapsedSeconds * (options.speedRadiansPerSecond ?? .28);
}

/**
 * Samples the slow 180-degree "sunset" turn used by world transitions.
 * The incoming world is eligible for reveal when the pivot reaches the
 * configured angle (90 degrees by default), rather than at a frame-dependent
 * or wall-clock checkpoint.
 */
export function sampleSunsetWorldTurn(
  elapsedMs: number,
  options: SunsetWorldTurnOptions = {}
): SunsetWorldTurnSnapshot {
  assertFinite("elapsedMs", elapsedMs);
  const durationMs = options.durationMs ?? DEFAULT_SUNSET_WORLD_TURN_DURATION_MS;
  assertFinite("durationMs", durationMs);
  if (durationMs < 0) throw new RangeError("durationMs must be non-negative.");

  const revealAngle = options.incomingRevealAngleRadians ?? QUARTER_TURN_RADIANS;
  assertFinite("incomingRevealAngleRadians", revealAngle);
  if (revealAngle <= 0 || revealAngle >= HALF_TURN_RADIANS) {
    throw new RangeError("incomingRevealAngleRadians must be between 0 and PI radians.");
  }

  const direction = options.direction ?? 1;
  if (direction !== 1 && direction !== -1) {
    throw new RangeError("direction must be 1 or -1.");
  }

  if (options.reducedMotion) {
    return {
      progress: 1,
      easedProgress: 1,
      rotationRadians: 0,
      incomingCounterRotationRadians: 0,
      angularVelocityRadiansPerSecond: 0,
      normalizedAngularVelocity: 0,
      incomingRevealProgress: 1,
      incomingRevealStarted: true,
      motionBlurIntensity: 0,
      reducedMotion: true,
      complete: true
    };
  }

  const progress = durationMs === 0 ? 1 : clamp01(Math.max(0, elapsedMs) / durationMs);
  const easedProgress = easeInOutSine(progress);
  const unsignedRotation = easedProgress * HALF_TURN_RADIANS;
  const normalizedAngularVelocity = progress <= 0 || progress >= 1
    ? 0
    : Math.sin(Math.PI * progress);
  const peakRadiansPerSecond = durationMs === 0
    ? 0
    : Math.PI * Math.PI / (2 * (durationMs / 1_000));
  const incomingRevealProgress = clamp01(
    (unsignedRotation - revealAngle) / (HALF_TURN_RADIANS - revealAngle)
  );

  return {
    progress,
    easedProgress,
    rotationRadians: unsignedRotation * direction,
    incomingCounterRotationRadians: -HALF_TURN_RADIANS * direction,
    angularVelocityRadiansPerSecond: peakRadiansPerSecond * normalizedAngularVelocity * direction,
    normalizedAngularVelocity,
    incomingRevealProgress,
    incomingRevealStarted: unsignedRotation + Number.EPSILON * HALF_TURN_RADIANS >= revealAngle,
    motionBlurIntensity: normalizedAngularVelocity,
    reducedMotion: false,
    complete: progress >= 1
  };
}
