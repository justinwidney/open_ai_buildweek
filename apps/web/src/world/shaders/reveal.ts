import { Color, type ColorRepresentation, type MeshStandardMaterial } from "three";

export interface DissolveRevealOptions {
  readonly edgeColor?: ColorRepresentation;
  readonly feather?: number;
  readonly initialProgress?: number;
}

export interface DissolveRevealController {
  readonly material: MeshStandardMaterial;
  setProgress(progress: number): void;
  dispose(): void;
}

/** Adds a screen-independent dither reveal to an existing PBR material. */
export function installDissolveReveal(
  material: MeshStandardMaterial,
  options: DissolveRevealOptions = {}
): DissolveRevealController {
  const progressUniform = { value: clamp01(options.initialProgress ?? 1) };
  const edgeColorUniform = { value: new Color(options.edgeColor ?? 0xffd682) };
  const featherUniform = { value: Math.max(0.001, options.feather ?? 0.08) };
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;
  const cacheToken = `fantasy-dissolve-${material.uuid}`;
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
    shader.uniforms.uFantasyReveal = progressUniform;
    shader.uniforms.uFantasyRevealEdge = edgeColorUniform;
    shader.uniforms.uFantasyRevealFeather = featherUniform;
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vFantasyLocalPosition;\nvoid main() {")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFantasyLocalPosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", /* glsl */ `
        uniform float uFantasyReveal;
        uniform vec3 uFantasyRevealEdge;
        uniform float uFantasyRevealFeather;
        varying vec3 vFantasyLocalPosition;
        float fantasyHash(vec3 point) {
          return fract(sin(dot(point, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }
        void main() {
      `)
      .replace("#include <dithering_fragment>", /* glsl */ `
        float fantasyThreshold = fantasyHash(floor(vFantasyLocalPosition * 9.0));
        if (fantasyThreshold > uFantasyReveal + uFantasyRevealFeather) discard;
        float fantasyEdge = 1.0 - smoothstep(0.0, uFantasyRevealFeather,
          abs(fantasyThreshold - uFantasyReveal));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFantasyRevealEdge, fantasyEdge * 0.38);
        #include <dithering_fragment>
      `);
  };
  material.customProgramCacheKey = () => `${previousCacheKey.call(material)}-${cacheToken}`;
  material.needsUpdate = true;
  let disposed = false;
  return {
    material,
    setProgress: (progress) => {
      progressUniform.value = clamp01(progress);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      material.needsUpdate = true;
    }
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
