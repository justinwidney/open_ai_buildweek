import { BackSide, Color, ShaderMaterial, type ColorRepresentation } from "three";
import type { QualityTier } from "../postprocessing";
import { FANTASY_PALETTE } from "../materials/palette";

export interface SkyGradientOptions {
  readonly top?: ColorRepresentation;
  readonly horizon?: ColorRepresentation;
  readonly lower?: ColorRepresentation;
  readonly tier?: QualityTier;
  readonly opacity?: number;
}

export function createSkyGradientMaterial(options: SkyGradientOptions = {}): ShaderMaterial {
  const detailed = options.tier === undefined || options.tier === "high" || options.tier === "medium";
  return new ShaderMaterial({
    name: "fantasy-sky-gradient",
    side: BackSide,
    depthWrite: false,
    transparent: (options.opacity ?? 1) < 1,
    fog: false,
    uniforms: {
      uTop: { value: new Color(options.top ?? FANTASY_PALETTE.skyTop) },
      uHorizon: { value: new Color(options.horizon ?? FANTASY_PALETTE.skyHorizon) },
      uLower: { value: new Color(options.lower ?? FANTASY_PALETTE.skyLower) },
      uDetail: { value: detailed ? 1 : 0 },
      uOpacity: { value: options.opacity ?? 1 }
    },
    vertexShader: /* glsl */ `
      varying float vHeight;
      varying vec3 vDirection;
      void main() {
        vHeight = normalize(position).y;
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uLower;
      uniform float uDetail;
      uniform float uOpacity;
      varying float vHeight;
      varying vec3 vDirection;

      float hash21(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        float upperMix = smoothstep(-0.05, 0.82, vHeight);
        float lowerMix = smoothstep(-0.72, 0.02, vHeight);
        vec3 lowerBand = mix(uLower, uHorizon, lowerMix);
        vec3 color = mix(lowerBand, uTop, upperMix);
        float halo = exp(-pow((vHeight - 0.02) * 5.1, 2.0));
        color += vec3(1.0, 0.83, 0.52) * halo * 0.10;
        float grain = (hash21(gl_FragCoord.xy) - 0.5) * 0.012 * uDetail;
        gl_FragColor = vec4(color + grain, uOpacity);
      }
    `
  });
}
