import * as THREE from "three";
import { createLayeredPlatform } from "../world/geometry/platforms";
import { createBasePlatformMaterialSet } from "../world/assets/basePlatformMaterials";
import { makeWatercolorTexture } from "./threeLab";

export interface LabPlatformOptions {
  radius?: number;
  seed?: number;
  jaggedness?: number;
  cragDepth?: number;
  profile?: "storybook" | "ancient" | "wild";
  details?: boolean;
  /** Uses the approved neutral stone base instead of procedural lab materials. */
  baseArt?: boolean;
  /** Disable image maps when the lab needs a silhouette-only comparison. */
  textures?: boolean;
}

function makeKit(profile: NonNullable<LabPlatformOptions["profile"]>, seed: number, baseArt = false, textures = true) {
  if (baseArt) {
    const base = createBasePlatformMaterialSet({ texturesEnabled: textures });
    return {
      stone: base.wall,
      stoneDark: base.wallDark,
      rim: base.rim,
      top: base.top,
      detail: new THREE.MeshStandardMaterial({ color: 0xd8b55f, emissive: 0x372348, emissiveIntensity: .09, roughness: .8 }),
    };
  }
  const ancient = profile === "ancient";
  const wild = profile === "wild";
  const stoneMap = makeWatercolorTexture(seed, ancient ? "#8e8a7c" : "#8796a2", ancient ? "#cfc0a4" : "#d7c9b6");
  const topMap = makeWatercolorTexture(seed + 1, wild ? "#607c50" : "#71885b", "#aeba7c");
  const stone = new THREE.MeshStandardMaterial({ color: ancient ? 0xb0a68d : 0xb5bec2, map: stoneMap, bumpMap: stoneMap, bumpScale: .08, roughness: .92, metalness: 0, flatShading: true });
  const stoneDark = new THREE.MeshStandardMaterial({ color: wild ? 0x4d5961 : 0x626b72, map: stoneMap, bumpMap: stoneMap, bumpScale: .12, roughness: .97, flatShading: true });
  const rim = new THREE.MeshStandardMaterial({ color: ancient ? 0x90795a : 0xb29a68, roughness: .74, metalness: .06, flatShading: true });
  const top = new THREE.MeshStandardMaterial({ color: wild ? 0x758e58 : 0x839868, map: topMap, roughness: .96, flatShading: true });
  const detail = new THREE.MeshStandardMaterial({ color: profile === "storybook" ? 0xf0c66e : 0xb5a4d3, emissive: 0x372348, emissiveIntensity: .09, roughness: .8 });
  return { stone, stoneDark, rim, top, detail };
}

export function createLabTree(scale = 1) {
  const group = new THREE.Group();
  group.name = "lab-tree";
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x66513b, roughness: 1 });
  const leafMaterials = [0x627852, 0x809462, 0x9aa66e].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.08 * scale, .16 * scale, 1.1 * scale, 7), trunkMaterial);
  trunk.position.y = .55 * scale;
  trunk.castShadow = true;
  group.add(trunk);
  const positions = [[0,1.2,0],[-.28,1.12,.02],[.28,1.08,-.03],[.04,1.45,-.02]] as const;
  positions.forEach(([x,y,z], index) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.42 * scale * (index === 3 ? .82 : 1), 1), leafMaterials[index % leafMaterials.length]);
    crown.position.set(x * scale, y * scale, z * scale);
    crown.scale.y = .72;
    crown.castShadow = true;
    group.add(crown);
  });
  return group;
}

export function createLabPlatform(id: string, options: LabPlatformOptions = {}) {
  const radius = options.radius ?? 4.8;
  const seed = options.seed ?? 41;
  const profile = options.profile ?? "storybook";
  const materials = makeKit(profile, seed, options.baseArt, options.textures ?? true);
  const build = createLayeredPlatform({
    id,
    radius,
    seed,
    materials,
    radialFacetCount: 48,
    verticalFacetCount: profile === "wild" ? 10 : 8,
    jaggedness: options.jaggedness ?? (profile === "wild" ? .22 : profile === "ancient" ? .1 : .14),
    cragDepth: options.cragDepth ?? (profile === "wild" ? 1.34 : 1.16),
    baseShape: options.baseArt ? "stone-cylinder" : "floating-crag",
    edgeStoneCount: options.baseArt ? 0 : Math.round(radius * 8),
    detailCount: options.baseArt ? 0 : Math.round(radius * 7),
    shadows: true,
  });
  const group = build.group;

  // Thin inset rings and stepping motifs break the large top into authored regions.
  const ringMaterial = materials.rim.clone();
  ringMaterial.color.offsetHSL(0, -.06, .08);
  [0.34, 0.54, 0.7].forEach((ratio, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * ratio, .025 + index * .008, 5, 48), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = build.surfaceY + .03;
    ring.receiveShadow = true;
    group.add(ring);
  });

  if (options.details !== false) {
    const tree = createLabTree(Math.max(.62, radius * .16));
    tree.position.set(-radius * .48, build.surfaceY, -radius * .08);
    group.add(tree);
    const treeSmall = createLabTree(Math.max(.42, radius * .1));
    treeSmall.position.set(radius * .38, build.surfaceY, -radius * .38);
    group.add(treeSmall);

    const flowerGeometry = new THREE.ConeGeometry(.045, .22, 5);
    const flowerMaterial = materials.detail.clone();
    const flowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, 22);
    const matrix = new THREE.Matrix4();
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 22; index += 1) {
      const angle = index * 2.3999632297 + seed;
      const distance = radius * (.5 + (index % 5) * .04);
      dummy.position.set(Math.sin(angle) * distance, build.surfaceY + .12, Math.cos(angle) * distance);
      dummy.rotation.y = angle;
      dummy.scale.setScalar(.75 + (index % 3) * .16);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      flowers.setMatrixAt(index, matrix);
    }
    flowers.castShadow = true;
    group.add(flowers);
  }
  return { group, build, materials };
}

export function createLabBridge(length = 10, width = 1.05) {
  const group = new THREE.Group();
  group.name = "lab-bridge";
  const wood = new THREE.MeshStandardMaterial({ color: 0x856646, roughness: .95, flatShading: true });
  const rope = new THREE.MeshStandardMaterial({ color: 0x4b3828, roughness: 1 });
  const count = Math.max(7, Math.round(length / .7));
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, .1, .48), wood);
    plank.position.set(0, -Math.sin(t * Math.PI) * .5, -t * length);
    plank.rotation.z = Math.sin(index * 1.9) * .025;
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  for (const side of [-1, 1]) {
    const points = Array.from({ length: count }, (_, index) => {
      const t = index / (count - 1);
      return new THREE.Vector3(side * width * .55, .55 - Math.sin(t * Math.PI) * .5, -t * length);
    });
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, .025, 5, false), rope));
  }
  return group;
}

export function disposeLabObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const mapped = material as THREE.MeshStandardMaterial;
      mapped.map?.dispose();
      mapped.bumpMap?.dispose();
      material.dispose();
    });
  });
  root.removeFromParent();
}
