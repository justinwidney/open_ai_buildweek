import { MeshBasicMaterial, MeshStandardMaterial, type Material, type Texture } from "three";
import { qualityProfile, type QualityTier } from "../postprocessing";
import { FANTASY_PALETTE } from "./palette";
import { createProceduralTexture, type ProceduralTextureKind } from "./proceduralTextures";

export interface TextureManifestEntry {
  readonly id: ProceduralTextureKind;
  readonly source: "procedural-canvas";
  readonly license: "project-generated";
  readonly colorSpace: "srgb";
  readonly wrap: "repeat";
  readonly owner: "fantasy-material-kit";
}

const PROCEDURAL_TEXTURE_KINDS = ["parchment", "stone", "foliage", "trim"] as const;

export const FANTASY_TEXTURE_MANIFEST: readonly TextureManifestEntry[] = PROCEDURAL_TEXTURE_KINDS.map((id): TextureManifestEntry => ({
  id,
  source: "procedural-canvas",
  license: "project-generated",
  colorSpace: "srgb",
  wrap: "repeat",
  owner: "fantasy-material-kit"
}));

export interface FantasyMaterialKit {
  readonly stone: MeshStandardMaterial;
  readonly foliage: MeshStandardMaterial;
  readonly trim: MeshStandardMaterial;
  readonly bridge: MeshStandardMaterial;
  readonly parchment: MeshStandardMaterial;
  readonly atmospheric: MeshBasicMaterial;
  readonly textures: ReadonlyMap<ProceduralTextureKind, Texture>;
  readonly materials: readonly Material[];
  dispose(): void;
}

export interface FantasyMaterialKitOptions {
  readonly tier?: QualityTier;
  readonly seed?: number;
  readonly maxAnisotropy?: number;
}

export function createFantasyMaterialKit(options: FantasyMaterialKitOptions = {}): FantasyMaterialKit {
  const tier = options.tier ?? "high";
  const profile = qualityProfile(tier);
  const textures = new Map<ProceduralTextureKind, Texture>();
  if (profile.textureSize > 0) {
    for (const [index, kind] of (["parchment", "stone", "foliage", "trim"] as const).entries()) {
      textures.set(kind, createProceduralTexture(kind, {
        size: profile.textureSize,
        seed: (options.seed ?? 1947) + index * 977,
        anisotropy: Math.min(options.maxAnisotropy ?? 4, tier === "high" ? 4 : 2)
      }));
    }
  }
  const stone = new MeshStandardMaterial({
    name: "fantasy-stone",
    color: textures.has("stone") ? 0xffffff : FANTASY_PALETTE.stone,
    map: textures.get("stone") ?? null,
    roughness: 0.92,
    metalness: 0.01
  });
  const foliage = new MeshStandardMaterial({
    name: "fantasy-foliage",
    color: textures.has("foliage") ? 0xffffff : FANTASY_PALETTE.foliage,
    map: textures.get("foliage") ?? null,
    roughness: 0.98,
    metalness: 0
  });
  const trim = new MeshStandardMaterial({
    name: "fantasy-gold-trim",
    color: textures.has("trim") ? 0xffffff : FANTASY_PALETTE.trim,
    map: textures.get("trim") ?? null,
    roughness: 0.68,
    metalness: 0.06
  });
  const bridge = new MeshStandardMaterial({
    name: "fantasy-bridge",
    color: FANTASY_PALETTE.bridge,
    roughness: 0.84,
    metalness: 0
  });
  const parchment = new MeshStandardMaterial({
    name: "fantasy-parchment",
    color: textures.has("parchment") ? 0xffffff : FANTASY_PALETTE.parchment,
    map: textures.get("parchment") ?? null,
    roughness: 0.96,
    metalness: 0
  });
  const atmospheric = new MeshBasicMaterial({
    name: "fantasy-atmospheric-fallback",
    color: FANTASY_PALETTE.mist,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    fog: false
  });
  const materials: readonly Material[] = [stone, foliage, trim, bridge, parchment, atmospheric];
  let disposed = false;
  return {
    stone,
    foliage,
    trim,
    bridge,
    parchment,
    atmospheric,
    textures,
    materials,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const material of materials) material.dispose();
      for (const texture of textures.values()) texture.dispose();
      textures.clear();
    }
  };
}
