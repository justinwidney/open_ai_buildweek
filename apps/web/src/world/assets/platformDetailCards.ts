import * as THREE from "three";

export type PlatformArtVariant = "tree" | "waterfall" | "castle" | "garden";

export const PLATFORM_DETAIL_ASSETS = {
  carvedPlatform: "/lab-assets/platform-details/carved-platform.png",
  smallPlatform: "/lab-assets/platform-details/small-platform.png",
  treeIsland: "/lab-assets/platform-details/tree-island.png",
  waterfallIsland: "/lab-assets/platform-details/waterfall-island.png",
  castleIsland: "/lab-assets/platform-details/castle-island.png",
  bridge: "/lab-assets/platform-details/rope-bridge.png",
  tree: "/lab-assets/platform-details/storybook-tree.png",
  flowers: "/lab-assets/platform-details/flower-bed.png",
  lantern: "/lab-assets/platform-details/lantern.png",
  sign: "/lab-assets/platform-details/sign.png",
  flag: "/lab-assets/platform-details/purple-flag.png",
} as const;

interface ArtPlaneOptions {
  readonly aspect: number;
  readonly width: number;
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly opacity?: number;
  readonly name?: string;
}

export interface PlatformArtStackOptions {
  readonly radius: number;
  readonly surfaceY?: number;
  readonly variant?: PlatformArtVariant;
  readonly detailSpread?: number;
  readonly includeDetails?: boolean;
}

const loader = new THREE.TextureLoader();

function createArtPlane(src: string, options: ArtPlaneOptions) {
  const height = options.width / options.aspect;
  const texture = loader.load(src, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.needsUpdate = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    alphaTest: .035,
    depthWrite: false,
    map: texture,
    opacity: options.opacity ?? 1,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  material.userData.baseOpacity = options.opacity ?? 1;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(options.width, height), material);
  plane.name = options.name ?? `atlas-card:${src.split("/").at(-1)}`;
  plane.position.set(options.x ?? 0, options.y ?? 0, options.z ?? 0);
  plane.renderOrder = 12;
  plane.userData.atlasSource = src;
  plane.userData.aspect = options.aspect;
  return plane;
}

/**
 * Builds a physically transformable 2.5D card stack from the hand-painted
 * 10_23_53 AM atlas. The low-poly mesh remains the collision/ground volume;
 * these planes own the visible silhouette and close-range texture detail.
 */
export function createPlatformArtStack({
  radius,
  surfaceY = 0,
  variant = "tree",
  detailSpread = 1,
  includeDetails = true,
}: PlatformArtStackOptions) {
  const group = new THREE.Group();
  group.name = `atlas-platform-art:${variant}`;
  group.userData.source = "ChatGPT Image Jul 20, 2026, 10_23_53 AM.png";

  const mainByVariant = {
    tree: { src: PLATFORM_DETAIL_ASSETS.treeIsland, aspect: 106 / 171, topFraction: .355 },
    waterfall: { src: PLATFORM_DETAIL_ASSETS.waterfallIsland, aspect: 114 / 159, topFraction: .29 },
    castle: { src: PLATFORM_DETAIL_ASSETS.castleIsland, aspect: 115 / 174, topFraction: .61 },
    garden: { src: PLATFORM_DETAIL_ASSETS.smallPlatform, aspect: 125 / 108, topFraction: .35 },
  } as const;
  const mainSpec = mainByVariant[variant];
  const mainWidth = radius * (variant === "garden" ? 1.82 : 1.88);
  const mainHeight = mainWidth / mainSpec.aspect;
  const mainCenterY = surfaceY - (.5 - mainSpec.topFraction) * mainHeight;
  group.add(createArtPlane(mainSpec.src, {
    aspect: mainSpec.aspect,
    name: `atlas-main:${variant}`,
    width: mainWidth,
    y: mainCenterY,
    z: .08,
  }));

  if (includeDetails) {
    const flowerWidth = radius * .92;
    group.add(createArtPlane(PLATFORM_DETAIL_ASSETS.flowers, {
      aspect: 177 / 122,
      name: "atlas-detail:flowers",
      width: flowerWidth,
      x: radius * .2,
      y: surfaceY + flowerWidth * .18,
      z: .22 + detailSpread * .32,
    }));

    const lanternWidth = radius * .27;
    const lanternHeight = lanternWidth / (65 / 117);
    group.add(createArtPlane(PLATFORM_DETAIL_ASSETS.lantern, {
      aspect: 65 / 117,
      name: "atlas-detail:lantern",
      width: lanternWidth,
      x: -radius * .54,
      y: surfaceY + lanternHeight * .44,
      z: .34 + detailSpread * .46,
    }));

    if (variant === "garden") {
      const treeWidth = radius * 1.08;
      const treeHeight = treeWidth / (146 / 142);
      group.add(createArtPlane(PLATFORM_DETAIL_ASSETS.tree, {
        aspect: 146 / 142,
        name: "atlas-detail:tree",
        width: treeWidth,
        x: -radius * .18,
        y: surfaceY + treeHeight * .42,
        z: .3 + detailSpread * .68,
      }));
    }
  }

  group.userData.layerCount = group.children.length;
  return group;
}

export function setArtStackOpacity(root: THREE.Object3D, opacity: number) {
  const clamped = THREE.MathUtils.clamp(opacity, 0, 1);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const baseOpacity = Number(material.userData.baseOpacity ?? 1);
      material.transparent = true;
      material.opacity = baseOpacity * clamped;
      material.depthWrite = false;
    });
  });
  root.visible = clamped > .001;
}
