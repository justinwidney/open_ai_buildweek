import { qualityForDevice, qualityProfile, type QualityTier } from "../postprocessing";

export type { QualityTier } from "../postprocessing";

export function detectQualityTier(): QualityTier {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return qualityForDevice({
    reducedMotion,
    deviceMemory: memory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  });
}

export function pixelRatioForQuality(quality: QualityTier) {
  return Math.min(window.devicePixelRatio, qualityProfile(quality).pixelRatioCap);
}
