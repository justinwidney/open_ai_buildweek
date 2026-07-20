import * as THREE from "three";
import {
  createFacetedAnnulusGeometry,
  createFacetedRadialGeometry,
  createJaggedRadialProfile,
  type FacetedRadialRing,
} from "./createFacetedRadialGeometry";

export type PlatformVector = THREE.Vector3 | readonly [number, number, number];

export interface LayeredPlatformMaterials {
  /** Main rock shelf. Owned by the caller and safe to share across platforms. */
  stone: THREE.Material;
  /** Darker lower shelf and strata accents. */
  stoneDark: THREE.Material;
  /** Raised metallic, stone, or carved border. */
  rim: THREE.Material;
  /** Walkable grass, moss, or painted top. */
  top: THREE.Material;
  /** Small flowers, crystals, or route markers. */
  detail: THREE.Material;
}

export interface PlatformSocketOptions {
  id: string;
  /** Radians around local Y. Zero points toward local -Z. */
  angle: number;
  /** Radial inset from the outer rim. Defaults to 8% of platform radius. */
  inset?: number;
}

export interface LayeredPlatformOptions {
  id: string;
  radius: number;
  materials: LayeredPlatformMaterials;
  position?: PlatformVector;
  rotationY?: number;
  seed?: number;
  /** Preferred number of facets around the silhouette. Defaults to 28. */
  radialFacetCount?: number;
  /** Number of tapered ledges between the upper shelf and crag tip. Defaults to 6. */
  verticalFacetCount?: number;
  /** Fractional variation in the island outline, from 0 through .45. Defaults to .13. */
  jaggedness?: number;
  /** Underside depth as a multiple of radius. Defaults to 1. */
  cragDepth?: number;
  /** Neutral gameplay bases use a short masonry cylinder; scenery may retain a tapered crag. */
  baseShape?: "floating-crag" | "stone-cylinder";
  /** @deprecated Use radialFacetCount. Retained for existing quality settings. */
  radialSegments?: number;
  edgeStoneCount?: number;
  detailCount?: number;
  sockets?: readonly PlatformSocketOptions[];
  shadows?: boolean;
}

export interface PlatformConnectionSocket {
  id: string;
  /** Local-space transform whose +Z axis points away from the platform. */
  anchor: THREE.Object3D;
  /** Normalized outward direction in platform-local space. */
  direction: THREE.Vector3;
}

export interface LayeredPlatformBuild {
  group: THREE.Group;
  radius: number;
  /** Y coordinate of the walkable surface in group-local space. */
  surfaceY: number;
  sockets: ReadonlyMap<string, PlatformConnectionSocket>;
  /** Disposes only geometries created by this factory. Shared input materials are untouched. */
  dispose: () => void;
}

const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);

function toVector3(value: PlatformVector | undefined): THREE.Vector3 {
  if (!value) return new THREE.Vector3();
  return value instanceof THREE.Vector3
    ? value.clone()
    : new THREE.Vector3(value[0], value[1], value[2]);
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite number greater than zero.`);
  }
}

function resolveFacetCount(value: number | undefined, fallback: number, minimum: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`);
  }
  return Math.max(minimum, Math.floor(resolved));
}

/** Small deterministic generator so authored decoration layouts remain stable. */
function createRandom(seed: number): () => number {
  let state = (Math.trunc(seed) || 1) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function markMesh(mesh: THREE.Mesh | THREE.InstancedMesh, shadows: boolean): void {
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
}

/**
 * Builds a reusable floating island with a jagged shelf, tapered faceted crag,
 * carved strata, raised rim, walkable top, instanced edge stones, and details.
 * The group's origin lies at the center of the platform.
 */
export function createLayeredPlatform(options: LayeredPlatformOptions): LayeredPlatformBuild {
  assertFinitePositive(options.radius, "Platform radius");

  const radius = options.radius;
  const radialFacetCount = resolveFacetCount(
    options.radialFacetCount ?? options.radialSegments,
    28,
    12,
    "Platform radial facet count",
  );
  const verticalFacetCount = resolveFacetCount(
    options.verticalFacetCount,
    6,
    3,
    "Platform vertical facet count",
  );
  const jaggedness = options.jaggedness ?? 0.13;
  const cragDepth = options.cragDepth ?? 1;
  const baseShape = options.baseShape ?? "floating-crag";
  if (!Number.isFinite(jaggedness) || jaggedness < 0 || jaggedness > 0.45) {
    throw new RangeError("Platform jaggedness must be between zero and 0.45.");
  }
  if (!Number.isFinite(cragDepth) || cragDepth < 0.55) {
    throw new RangeError("Platform crag depth must be a finite radius multiplier of at least 0.55.");
  }
  const edgeStoneCount = Math.max(0, Math.floor(options.edgeStoneCount ?? radius * 5));
  const detailCount = Math.max(0, Math.floor(options.detailCount ?? radius * 4));
  const shadows = options.shadows ?? true;
  const seed = options.seed ?? 1;
  const random = createRandom(seed);
  const radialProfile = createJaggedRadialProfile({
    facetCount: radialFacetCount,
    jaggedness,
    seed,
  });
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const group = new THREE.Group();
  group.name = `platform:${options.id}`;
  group.position.copy(toVector3(options.position));
  group.rotation.y = options.rotationY ?? 0;
  group.userData.kind = "layered-platform";
  group.userData.platformId = options.id;

  const addMesh = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
  ): THREE.Mesh => {
    ownedGeometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    markMesh(mesh, shadows);
    group.add(mesh);
    return mesh;
  };

  // The walkable surface is deliberately near local Y=0 so bridge sockets and
  // character paths can use an intuitive origin.
  const surfaceY = 0.12;
  const shelf = addMesh(
    "stone-shelf",
    createFacetedRadialGeometry({
      profile: radialProfile,
      rings: baseShape === "stone-cylinder"
        ? [
            { y: surfaceY - radius * 0.035, radius: radius * .91, profileScale: .35 },
            { y: surfaceY - radius * .14, radius: radius * .915, profileScale: .3 },
            { y: surfaceY - radius * .28, radius: radius * .9, profileScale: .32 },
            { y: surfaceY - radius * .4, radius: radius * .89, profileScale: .28 },
          ]
        : [
            { y: surfaceY - radius * 0.04, radius: radius * 0.9, profileScale: 0.8 },
            { y: surfaceY - radius * 0.14, radius: radius * 0.95, profileScale: 1 },
            { y: surfaceY - radius * 0.28, radius: radius * 0.84, profileScale: 1.12, twist: Math.PI / radialFacetCount * 0.1 },
            { y: surfaceY - radius * 0.4, radius: radius * 0.73, profileScale: 0.9 },
          ],
      capTop: true,
      capBottom: true,
    }),
    options.materials.stone,
  );

  const undersideRings: FacetedRadialRing[] = [];
  for (let index = 0; index <= verticalFacetCount; index += 1) {
    const progress = index / verticalFacetCount;
    if (baseShape === "stone-cylinder") {
      undersideRings.push({
        y: surfaceY - radius * (.38 + .34 * progress),
        radius: radius * (.89 - progress * .025),
        profileScale: .26 + progress * .08,
        twist: index % 2 === 0 ? 0 : Math.PI / radialFacetCount * .08,
      });
      continue;
    }
    const alternatingLedge = index > 0 && index < verticalFacetCount
      ? index % 2 === 0 ? 1.07 : 0.975
      : 1;
    const radiusScale = (0.08 + 0.66 * Math.pow(1 - progress, 0.72)) * alternatingLedge;
    undersideRings.push({
      y: surfaceY - radius * (0.38 + (cragDepth - 0.38) * progress),
      radius: radius * radiusScale,
      profileScale: 0.85 + progress * 0.7,
      twist: (index % 2 === 0 ? 1 : -1) * Math.PI / radialFacetCount * progress * 0.22,
    });
  }

  const underside = addMesh(
    "tapered-underside",
    createFacetedRadialGeometry({
      profile: radialProfile,
      rings: undersideRings,
      capTop: true,
      capBottom: true,
    }),
    options.materials.stoneDark,
  );

  const top = addMesh(
    "walkable-top",
    createFacetedRadialGeometry({
      profile: radialProfile,
      rings: [
        { y: surfaceY, radius: radius * 0.83, profileScale: 0.65 },
        { y: surfaceY - 0.16, radius: radius * 0.87, profileScale: 0.76 },
      ],
      capTop: true,
      capBottom: true,
    }),
    options.materials.top,
  );

  const rim = addMesh(
    "raised-rim",
    createFacetedAnnulusGeometry({
      profile: radialProfile,
      innerRadius: radius * 0.83,
      outerRadius: radius * 0.91,
      yTop: surfaceY + radius * 0.055,
      yBottom: surfaceY - radius * 0.005,
      profileScale: 0.72,
    }),
    options.materials.rim,
  );

  const upperStrata = addMesh(
    "upper-strata",
    createFacetedRadialGeometry({
      profile: radialProfile,
      rings: [
        { y: surfaceY - radius * 0.245, radius: radius * 0.86, profileScale: 1.1 },
        { y: surfaceY - radius * 0.285, radius: radius * 0.83, profileScale: 1.13 },
      ],
    }),
    options.materials.stoneDark,
  );

  const lowerStrata = addMesh(
    "lower-strata",
    createFacetedRadialGeometry({
      profile: radialProfile,
      rings: baseShape === "stone-cylinder"
        ? [
            { y: surfaceY - radius * .58, radius: radius * .89, profileScale: .28 },
            { y: surfaceY - radius * .62, radius: radius * .875, profileScale: .3 },
          ]
        : [
            { y: surfaceY - radius * 0.61, radius: radius * 0.57, profileScale: 1.12 },
            { y: surfaceY - radius * 0.65, radius: radius * 0.53, profileScale: 1.18 },
          ],
    }),
    options.materials.stone,
  );

  if (edgeStoneCount > 0) {
    const stoneGeometry = new THREE.DodecahedronGeometry(radius * 0.045, 0);
    ownedGeometries.add(stoneGeometry);
    const edgeStones = new THREE.InstancedMesh(stoneGeometry, options.materials.stone, edgeStoneCount);
    edgeStones.name = "edge-stones";
    markMesh(edgeStones, shadows);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < edgeStoneCount; index += 1) {
      const angle = (index / edgeStoneCount) * Math.PI * 2 + (random() - 0.5) * 0.18;
      const distance = radius * (0.75 + random() * 0.07);
      position.set(Math.sin(angle) * distance, surfaceY + 0.02 + random() * 0.04, -Math.cos(angle) * distance);
      quaternion.setFromEuler(new THREE.Euler(random() * 0.25, random() * Math.PI, random() * 0.25));
      scale.set(0.65 + random() * 0.55, 0.45 + random() * 0.45, 0.65 + random() * 0.55);
      matrix.compose(position, quaternion, scale);
      edgeStones.setMatrixAt(index, matrix);
    }
    edgeStones.instanceMatrix.needsUpdate = true;
    group.add(edgeStones);
  }

  if (detailCount > 0) {
    const detailGeometry = new THREE.SphereGeometry(radius * 0.025, 6, 4);
    ownedGeometries.add(detailGeometry);
    const details = new THREE.InstancedMesh(detailGeometry, options.materials.detail, detailCount);
    details.name = "surface-details";
    markMesh(details, false);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < detailCount; index += 1) {
      const cluster = Math.floor(index / 4);
      const clusterAngle = (cluster * 2.399963229728653 + random() * 0.2) % (Math.PI * 2);
      const distance = radius * (0.52 + random() * 0.23);
      position.set(
        Math.sin(clusterAngle) * distance + (random() - 0.5) * radius * 0.11,
        surfaceY + radius * (0.025 + random() * 0.018),
        -Math.cos(clusterAngle) * distance + (random() - 0.5) * radius * 0.11,
      );
      quaternion.identity();
      const size = 0.7 + random() * 0.9;
      scale.set(size, 0.65 + random() * 1.1, size);
      matrix.compose(position, quaternion, scale);
      details.setMatrixAt(index, matrix);
    }
    details.instanceMatrix.needsUpdate = true;
    group.add(details);
  }

  const sockets = new Map<string, PlatformConnectionSocket>();
  const socketPadGeometry = options.sockets?.length
    ? new THREE.BoxGeometry(radius * 0.22, 0.1, radius * 0.35)
    : undefined;
  if (socketPadGeometry) ownedGeometries.add(socketPadGeometry);

  for (const socketOptions of options.sockets ?? []) {
    if (sockets.has(socketOptions.id)) {
      throw new Error(`Duplicate platform socket id: ${socketOptions.id}`);
    }
    const direction = new THREE.Vector3(
      Math.sin(socketOptions.angle),
      0,
      -Math.cos(socketOptions.angle),
    ).normalize();
    const anchor = new THREE.Object3D();
    anchor.name = `platform-socket:${socketOptions.id}`;
    anchor.position.copy(direction).multiplyScalar(radius - (socketOptions.inset ?? radius * 0.08));
    anchor.position.y = surfaceY;
    anchor.quaternion.setFromUnitVectors(LOCAL_FORWARD, direction);
    anchor.userData.kind = "platform-socket";
    anchor.userData.socketId = socketOptions.id;
    group.add(anchor);

    if (socketPadGeometry) {
      const pad = new THREE.Mesh(socketPadGeometry, options.materials.rim);
      pad.name = `socket-pad:${socketOptions.id}`;
      pad.position.copy(anchor.position).addScaledVector(direction, radius * 0.08);
      pad.position.y = surfaceY + 0.005;
      pad.quaternion.copy(anchor.quaternion);
      markMesh(pad, shadows);
      group.add(pad);
    }

    sockets.set(socketOptions.id, { id: socketOptions.id, anchor, direction });
  }

  return {
    group,
    radius,
    surfaceY,
    sockets,
    dispose: () => {
      for (const geometry of ownedGeometries) geometry.dispose();
      ownedGeometries.clear();
    },
  };
}
