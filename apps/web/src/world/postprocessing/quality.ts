import type { WebGLRenderer } from "three";

/** Shared visual-cost switch used by atmosphere, materials and future passes. */
export type QualityTier = "high" | "medium" | "low" | "off";

export interface QualityProfile {
  readonly pixelRatioCap: number;
  readonly textureSize: 0 | 128 | 256 | 512;
  readonly atmosphereLayers: 0 | 1 | 2 | 3;
  readonly particleCount: number;
  readonly balloonCount: number;
  readonly shadows: boolean;
  readonly shaderDetail: 0 | 1 | 2;
}

export const QUALITY_PROFILES: Readonly<Record<QualityTier, QualityProfile>> = {
  high: {
    pixelRatioCap: 2,
    textureSize: 512,
    atmosphereLayers: 3,
    particleCount: 110,
    balloonCount: 7,
    shadows: true,
    shaderDetail: 2
  },
  medium: {
    pixelRatioCap: 1.5,
    textureSize: 256,
    atmosphereLayers: 2,
    particleCount: 64,
    balloonCount: 5,
    shadows: true,
    shaderDetail: 1
  },
  low: {
    pixelRatioCap: 1,
    textureSize: 128,
    atmosphereLayers: 1,
    particleCount: 28,
    balloonCount: 3,
    shadows: false,
    shaderDetail: 0
  },
  off: {
    pixelRatioCap: 1,
    textureSize: 0,
    atmosphereLayers: 0,
    particleCount: 0,
    balloonCount: 0,
    shadows: false,
    shaderDetail: 0
  }
};

export function qualityProfile(tier: QualityTier): QualityProfile {
  return QUALITY_PROFILES[tier];
}

export function configureRendererForQuality(
  renderer: WebGLRenderer,
  tier: QualityTier,
  devicePixelRatio = globalThis.devicePixelRatio ?? 1
): void {
  const profile = qualityProfile(tier);
  renderer.setPixelRatio(Math.min(devicePixelRatio, profile.pixelRatioCap));
  renderer.shadowMap.enabled = profile.shadows;
}

export function qualityForDevice(options: {
  reducedMotion?: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
} = {}): QualityTier {
  if (options.reducedMotion) return "low";
  const cores = options.hardwareConcurrency ?? globalThis.navigator?.hardwareConcurrency ?? 4;
  const memory = options.deviceMemory ?? readDeviceMemory();
  if (cores <= 2 || memory <= 2) return "low";
  if (cores <= 4 || memory <= 4) return "medium";
  return "high";
}

function readDeviceMemory(): number {
  const navigatorWithMemory = globalThis.navigator as Navigator & { deviceMemory?: number };
  return navigatorWithMemory?.deviceMemory ?? 4;
}
