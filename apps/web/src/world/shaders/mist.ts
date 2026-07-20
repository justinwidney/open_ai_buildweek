import { Color, DoubleSide, ShaderMaterial, type ColorRepresentation } from "three";
import type { QualityTier } from "../postprocessing";
import { FANTASY_PALETTE } from "../materials/palette";

export interface MistMaterialOptions {
  readonly color?: ColorRepresentation;
  readonly opacity?: number;
  readonly tier?: QualityTier;
}

export interface AnimatedMistMaterial {
  readonly material: ShaderMaterial;
  update(elapsedSeconds: number): void;
  setOpacity(opacity: number): void;
}

export function createMistMaterial(options: MistMaterialOptions = {}): AnimatedMistMaterial {
  const tier = options.tier ?? "high";
  const material = new ShaderMaterial({
    name: "fantasy-atmospheric-mist",
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: options.opacity ?? 0.18 },
      uColor: { value: new Color(options.color ?? FANTASY_PALETTE.mist) },
      uDetail: { value: tier === "high" ? 2 : tier === "medium" ? 1 : 0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDetail;
      uniform vec3 uColor;
      varying vec2 vUv;

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 345.45));
        point += dot(point, point + 34.345);
        return fract(point.x * point.y);
      }

      float smoothNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
          mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), local.x), local.y);
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float falloff = smoothstep(0.52, 0.03, abs(centered.y)) * smoothstep(0.56, 0.12, abs(centered.x));
        float broad = smoothNoise(vUv * vec2(3.0, 1.5) + vec2(uTime * 0.025, 0.0));
        float detail = smoothNoise(vUv * 8.0 - vec2(uTime * 0.018, 0.0));
        float density = mix(0.78, broad, min(1.0, uDetail));
        density = mix(density, density * 0.7 + detail * 0.3, step(1.5, uDetail));
        gl_FragColor = vec4(uColor, falloff * density * uOpacity);
      }
    `
  });
  return {
    material,
    update: (elapsedSeconds) => {
      material.uniforms.uTime!.value = elapsedSeconds;
    },
    setOpacity: (opacity) => {
      material.uniforms.uOpacity!.value = Math.max(0, Math.min(1, opacity));
    }
  };
}
