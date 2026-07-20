import { Color, FogExp2, Scene } from "three";
import type { QualityTier } from "./quality";

export interface FantasyGradeOptions {
  readonly fogDensity?: number;
  readonly fogColor?: Color | number | string;
  readonly background?: Color | number | string | null;
}

/**
 * Applies the inexpensive part of the finished look without owning a composer.
 * It returns a restore callback so previews and route changes do not retain state.
 */
export function applyFantasySceneGrade(
  scene: Scene,
  tier: QualityTier,
  options: FantasyGradeOptions = {}
): () => void {
  const previousFog = scene.fog;
  const previousBackground = scene.background;
  const densityByTier: Record<QualityTier, number> = {
    high: 0.018,
    medium: 0.016,
    low: 0.012,
    off: 0
  };
  const density = options.fogDensity ?? densityByTier[tier];
  if (density > 0) scene.fog = new FogExp2(options.fogColor ?? 0x9fb6c9, density);
  if (options.background !== undefined) {
    scene.background = options.background === null ? null : new Color(options.background);
  }
  return () => {
    scene.fog = previousFog;
    scene.background = previousBackground;
  };
}
