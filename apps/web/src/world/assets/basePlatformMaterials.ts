import * as THREE from "three";

export const BASE_PLATFORM_ASSETS = {
  reference: "/platform-base/base-platform-reference.png",
  top: "/platform-base/platform-top.png",
  wall: "/platform-base/platform-wall.png",
  groundStrip: "/platform-base/platform-ground-strip.png",
} as const;

export interface BasePlatformMaterialSet {
  readonly top: THREE.MeshStandardMaterial;
  readonly wall: THREE.MeshStandardMaterial;
  readonly wallDark: THREE.MeshStandardMaterial;
  readonly rim: THREE.MeshStandardMaterial;
}

function configureTexture(texture: THREE.Texture, repeatX = 1) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  if (repeatX !== 1) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = repeatX;
  }
  texture.needsUpdate = true;
  return texture;
}

/**
 * Materials for the single neutral gameplay platform. Purpose-specific trees,
 * signs, lanterns, flowers, and milestones are separate physical meshes.
 */
export function createBasePlatformMaterialSet(options: { texturesEnabled?: boolean } = {}): BasePlatformMaterialSet {
  const texturesEnabled = options.texturesEnabled ?? true;
  const loader = texturesEnabled ? new THREE.TextureLoader() : undefined;
  const topTexture = loader ? configureTexture(loader.load(BASE_PLATFORM_ASSETS.top), 1) : null;
  const wallTexture = loader ? configureTexture(loader.load(BASE_PLATFORM_ASSETS.wall), 4) : null;
  const rimTexture = loader ? configureTexture(loader.load(BASE_PLATFORM_ASSETS.top), 3) : null;

  return {
    top: new THREE.MeshStandardMaterial({
      name: "base-platform-top",
      color: topTexture ? 0xffffff : 0xbba774,
      map: topTexture,
      metalness: 0,
      roughness: .9,
    }),
    wall: new THREE.MeshStandardMaterial({
      name: "base-platform-wall",
      color: wallTexture ? 0xffffff : 0x8f846e,
      map: wallTexture,
      metalness: 0,
      roughness: .94,
    }),
    wallDark: new THREE.MeshStandardMaterial({
      name: "base-platform-wall-shadow",
      color: wallTexture ? 0x837962 : 0x6d6556,
      map: wallTexture,
      metalness: 0,
      roughness: .98,
    }),
    rim: new THREE.MeshStandardMaterial({
      name: "base-platform-rim",
      color: rimTexture ? 0xf1dfb8 : 0xcdb889,
      map: rimTexture,
      metalness: 0,
      roughness: .84,
    }),
  };
}
