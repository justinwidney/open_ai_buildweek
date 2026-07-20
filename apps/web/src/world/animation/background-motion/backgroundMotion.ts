const TAU = Math.PI * 2;

export interface MotionVector3 {
  x: number;
  y: number;
  z: number;
}

export interface BackgroundMotionSpec {
  anchor: MotionVector3;
  periodMs: number;
  seed?: number;
  phaseRadians?: number;
  positionAmplitude?: Partial<MotionVector3>;
  baseRotationRadians?: Partial<MotionVector3>;
  rotationAmplitudeRadians?: Partial<MotionVector3>;
  baseScale?: number;
  scaleAmplitude?: number;
}

export interface BackgroundMotionSample {
  position: MotionVector3;
  rotationRadians: MotionVector3;
  scale: number;
}

export interface BackgroundMotionSampleOptions {
  /** Set for prefers-reduced-motion; the helper returns the authored rest pose. */
  reducedMotion?: boolean;
  /** A 0..1 multiplier useful for scene-wide ambient-motion controls. */
  intensity?: number;
}

export interface BackgroundMotionTarget {
  position: { set(x: number, y: number, z: number): unknown };
  rotation: { set(x: number, y: number, z: number): unknown };
  scale: { setScalar(scale: number): unknown };
}

interface ResolvedBackgroundMotionSpec {
  anchor: MotionVector3;
  periodMs: number;
  phaseRadians: number;
  positionAmplitude: MotionVector3;
  baseRotationRadians: MotionVector3;
  rotationAmplitudeRadians: MotionVector3;
  baseScale: number;
  scaleAmplitude: number;
}

const ZERO_VECTOR: Readonly<MotionVector3> = { x: 0, y: 0, z: 0 };

function assertFinite(name: string, value: number) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number.`);
}

function resolveVector(
  name: string,
  value: Partial<MotionVector3> | undefined,
  fallback: Readonly<MotionVector3> = ZERO_VECTOR
): MotionVector3 {
  const resolved = {
    x: value?.x ?? fallback.x,
    y: value?.y ?? fallback.y,
    z: value?.z ?? fallback.z
  };
  assertFinite(`${name}.x`, resolved.x);
  assertFinite(`${name}.y`, resolved.y);
  assertFinite(`${name}.z`, resolved.z);
  return resolved;
}

/** A stable integer hash converted to a phase; it never calls Math.random(). */
export function phaseRadiansFromSeed(seed: number) {
  assertFinite("seed", seed);
  let value = Math.trunc(seed) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x1_0000_0000 * TAU;
}

function resolveSpec(spec: BackgroundMotionSpec): ResolvedBackgroundMotionSpec {
  if (!Number.isFinite(spec.periodMs) || spec.periodMs <= 0) {
    throw new RangeError("periodMs must be a finite number greater than 0.");
  }

  const anchor = resolveVector("anchor", spec.anchor);
  const baseScale = spec.baseScale ?? 1;
  const scaleAmplitude = spec.scaleAmplitude ?? 0;
  assertFinite("baseScale", baseScale);
  assertFinite("scaleAmplitude", scaleAmplitude);
  if (baseScale <= 0) throw new RangeError("baseScale must be greater than 0.");
  if (Math.abs(scaleAmplitude) >= baseScale) {
    throw new RangeError("scaleAmplitude must be smaller than baseScale so scale stays positive.");
  }

  const phaseRadians = spec.phaseRadians ?? phaseRadiansFromSeed(spec.seed ?? 0);
  assertFinite("phaseRadians", phaseRadians);

  return {
    anchor,
    periodMs: spec.periodMs,
    phaseRadians,
    positionAmplitude: resolveVector("positionAmplitude", spec.positionAmplitude),
    baseRotationRadians: resolveVector("baseRotationRadians", spec.baseRotationRadians),
    rotationAmplitudeRadians: resolveVector("rotationAmplitudeRadians", spec.rotationAmplitudeRadians),
    baseScale,
    scaleAmplitude
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function sampleResolvedBackgroundMotion(
  timeMs: number,
  spec: ResolvedBackgroundMotionSpec,
  options: BackgroundMotionSampleOptions = {}
): BackgroundMotionSample {
  assertFinite("timeMs", timeMs);
  const intensity = options.reducedMotion ? 0 : clamp01(options.intensity ?? 1);
  if (!Number.isFinite(intensity)) throw new RangeError("intensity must be a finite number.");

  // Wrapping first avoids precision loss during very long-running render sessions.
  const wrappedTimeMs = ((timeMs % spec.periodMs) + spec.periodMs) % spec.periodMs;
  const angle = wrappedTimeMs / spec.periodMs * TAU + spec.phaseRadians;
  const waveX = Math.sin(angle + 0.73);
  const waveY = Math.sin(angle);
  const waveZ = Math.sin(angle + 2.11);

  return {
    position: {
      x: spec.anchor.x + spec.positionAmplitude.x * waveX * intensity,
      y: spec.anchor.y + spec.positionAmplitude.y * waveY * intensity,
      z: spec.anchor.z + spec.positionAmplitude.z * waveZ * intensity
    },
    rotationRadians: {
      x: spec.baseRotationRadians.x + spec.rotationAmplitudeRadians.x * waveY * intensity,
      y: spec.baseRotationRadians.y + spec.rotationAmplitudeRadians.y * waveZ * intensity,
      z: spec.baseRotationRadians.z + spec.rotationAmplitudeRadians.z * waveX * intensity
    },
    scale: spec.baseScale + spec.scaleAmplitude * Math.sin(angle + 0.31) * intensity
  };
}

/** Samples from an absolute clock; equal timestamps always produce equal transforms. */
export function sampleBackgroundMotion(
  timeMs: number,
  spec: BackgroundMotionSpec,
  options: BackgroundMotionSampleOptions = {}
): BackgroundMotionSample {
  return sampleResolvedBackgroundMotion(timeMs, resolveSpec(spec), options);
}

/** Resolves validation and defaults once, suitable for a requestAnimationFrame loop. */
export function createBackgroundMotionSampler(spec: BackgroundMotionSpec) {
  const resolved = resolveSpec(spec);
  return (timeMs: number, options: BackgroundMotionSampleOptions = {}) =>
    sampleResolvedBackgroundMotion(timeMs, resolved, options);
}

/** Applies an absolute sample with set(), preventing frame-rate-dependent drift. */
export function applyBackgroundMotion(target: BackgroundMotionTarget, sample: BackgroundMotionSample) {
  target.position.set(sample.position.x, sample.position.y, sample.position.z);
  target.rotation.set(sample.rotationRadians.x, sample.rotationRadians.y, sample.rotationRadians.z);
  target.scale.setScalar(sample.scale);
}
