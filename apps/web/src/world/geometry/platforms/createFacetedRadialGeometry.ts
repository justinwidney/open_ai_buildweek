import * as THREE from "three";

export interface JaggedRadialProfileOptions {
  facetCount: number;
  /** Maximum fractional radius variation. A value of .1 varies the edge by roughly 10%. */
  jaggedness: number;
  seed: number;
}

export interface FacetedRadialRing {
  y: number;
  radius: number;
  /** Scales the shared profile so ledges and the crag do not form a straight extrusion. */
  profileScale?: number;
  /** Rotates this ring relative to adjacent rings, in radians. */
  twist?: number;
}

export interface FacetedRadialGeometryOptions {
  rings: readonly FacetedRadialRing[];
  /** Fractional radius offsets, normally returned by createJaggedRadialProfile. */
  profile: readonly number[];
  capTop?: boolean;
  capBottom?: boolean;
}

export interface FacetedAnnulusGeometryOptions {
  yTop: number;
  yBottom: number;
  outerRadius: number;
  innerRadius: number;
  profile: readonly number[];
  profileScale?: number;
}

function assertFacetCount(facetCount: number): void {
  if (!Number.isFinite(facetCount) || facetCount < 3 || Math.floor(facetCount) !== facetCount) {
    throw new RangeError("Facet count must be an integer of at least three.");
  }
}

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

/**
 * Creates a repeatable, closed radial profile. The mixed low-frequency waves
 * keep the outline readable while a small per-facet term breaks regularity.
 */
export function createJaggedRadialProfile(options: JaggedRadialProfileOptions): number[] {
  assertFacetCount(options.facetCount);
  if (!Number.isFinite(options.jaggedness) || options.jaggedness < 0 || options.jaggedness > 0.45) {
    throw new RangeError("Jaggedness must be between zero and 0.45.");
  }

  const random = createRandom(options.seed);
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  const phaseC = random() * Math.PI * 2;
  const profile: number[] = [];

  for (let index = 0; index < options.facetCount; index += 1) {
    const angle = index / options.facetCount * Math.PI * 2;
    const noise =
      Math.sin(angle * 2 + phaseA) * 0.48
      + Math.sin(angle * 3 + phaseB) * 0.27
      + Math.sin(angle * 5 + phaseC) * 0.15
      + (random() * 2 - 1) * 0.1;
    profile.push(noise * options.jaggedness);
  }

  return profile;
}

function radialPoint(
  ring: FacetedRadialRing,
  profile: readonly number[],
  index: number,
): THREE.Vector3 {
  const facetCount = profile.length;
  const wrappedIndex = (index + facetCount) % facetCount;
  const angle = wrappedIndex / facetCount * Math.PI * 2 + (ring.twist ?? 0);
  const radius = ring.radius * (1 + (profile[wrappedIndex] ?? 0) * (ring.profileScale ?? 1));
  return new THREE.Vector3(Math.sin(angle) * radius, ring.y, -Math.cos(angle) * radius);
}

function pushTriangle(
  positions: number[],
  uvs: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  uvA: readonly [number, number],
  uvB: readonly [number, number],
  uvC: readonly [number, number],
): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  uvs.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
}

function finishGeometry(positions: number[], uvs: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Builds a flat-shaded radial shell from top-to-bottom rings. */
export function createFacetedRadialGeometry(
  options: FacetedRadialGeometryOptions,
): THREE.BufferGeometry {
  assertFacetCount(options.profile.length);
  if (options.rings.length < 2) {
    throw new RangeError("Faceted radial geometry requires at least two rings.");
  }
  for (const ring of options.rings) {
    if (!Number.isFinite(ring.radius) || ring.radius <= 0 || !Number.isFinite(ring.y)) {
      throw new RangeError("Radial ring radius and height must be finite and radius must be positive.");
    }
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const facetCount = options.profile.length;

  for (let ringIndex = 0; ringIndex < options.rings.length - 1; ringIndex += 1) {
    const upper = options.rings[ringIndex];
    const lower = options.rings[ringIndex + 1];
    if (!upper || !lower) continue;
    const upperV = 1 - ringIndex / (options.rings.length - 1);
    const lowerV = 1 - (ringIndex + 1) / (options.rings.length - 1);
    for (let index = 0; index < facetCount; index += 1) {
      const next = (index + 1) % facetCount;
      const upperCurrent = radialPoint(upper, options.profile, index);
      const upperNext = radialPoint(upper, options.profile, next);
      const lowerCurrent = radialPoint(lower, options.profile, index);
      const lowerNext = radialPoint(lower, options.profile, next);
      const u = index / facetCount;
      const nextU = (index + 1) / facetCount;
      pushTriangle(positions, uvs, upperCurrent, upperNext, lowerCurrent, [u, upperV], [nextU, upperV], [u, lowerV]);
      pushTriangle(positions, uvs, upperNext, lowerNext, lowerCurrent, [nextU, upperV], [nextU, lowerV], [u, lowerV]);
    }
  }

  const topRing = options.rings[0];
  if (options.capTop && topRing) {
    const center = new THREE.Vector3(0, topRing.y, 0);
    for (let index = 0; index < facetCount; index += 1) {
      const current = radialPoint(topRing, options.profile, index);
      const next = radialPoint(topRing, options.profile, (index + 1) % facetCount);
      pushTriangle(
        positions,
        uvs,
        center,
        next,
        current,
        [0.5, 0.5],
        [0.5 + next.x / (topRing.radius * 2), 0.5 + next.z / (topRing.radius * 2)],
        [0.5 + current.x / (topRing.radius * 2), 0.5 + current.z / (topRing.radius * 2)],
      );
    }
  }

  const bottomRing = options.rings[options.rings.length - 1];
  if (options.capBottom && bottomRing) {
    const center = new THREE.Vector3(0, bottomRing.y, 0);
    for (let index = 0; index < facetCount; index += 1) {
      const current = radialPoint(bottomRing, options.profile, index);
      const next = radialPoint(bottomRing, options.profile, (index + 1) % facetCount);
      pushTriangle(
        positions,
        uvs,
        center,
        current,
        next,
        [0.5, 0.5],
        [0.5 + current.x / (bottomRing.radius * 2), 0.5 + current.z / (bottomRing.radius * 2)],
        [0.5 + next.x / (bottomRing.radius * 2), 0.5 + next.z / (bottomRing.radius * 2)],
      );
    }
  }

  return finishGeometry(positions, uvs);
}

/** Creates a low-poly raised ring without relying on a smooth torus primitive. */
export function createFacetedAnnulusGeometry(
  options: FacetedAnnulusGeometryOptions,
): THREE.BufferGeometry {
  assertFacetCount(options.profile.length);
  if (options.innerRadius <= 0 || options.outerRadius <= options.innerRadius) {
    throw new RangeError("Annulus radii must be positive and outerRadius must exceed innerRadius.");
  }
  if (options.yTop <= options.yBottom) {
    throw new RangeError("Annulus yTop must exceed yBottom.");
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const facetCount = options.profile.length;
  const profileScale = options.profileScale ?? 1;
  const point = (radius: number, y: number, index: number): THREE.Vector3 => radialPoint(
    { radius, y, profileScale },
    options.profile,
    index,
  );

  for (let index = 0; index < facetCount; index += 1) {
    const next = (index + 1) % facetCount;
    const u = index / facetCount;
    const nextU = (index + 1) / facetCount;
    const outerTop = point(options.outerRadius, options.yTop, index);
    const outerTopNext = point(options.outerRadius, options.yTop, next);
    const outerBottom = point(options.outerRadius, options.yBottom, index);
    const outerBottomNext = point(options.outerRadius, options.yBottom, next);
    const innerTop = point(options.innerRadius, options.yTop, index);
    const innerTopNext = point(options.innerRadius, options.yTop, next);
    const innerBottom = point(options.innerRadius, options.yBottom, index);
    const innerBottomNext = point(options.innerRadius, options.yBottom, next);

    // Outer wall, inner wall, top ledge, then hidden lower closure.
    pushTriangle(positions, uvs, outerTop, outerTopNext, outerBottom, [u, 1], [nextU, 1], [u, 0]);
    pushTriangle(positions, uvs, outerTopNext, outerBottomNext, outerBottom, [nextU, 1], [nextU, 0], [u, 0]);
    pushTriangle(positions, uvs, innerTop, innerBottom, innerTopNext, [u, 1], [u, 0], [nextU, 1]);
    pushTriangle(positions, uvs, innerTopNext, innerBottom, innerBottomNext, [nextU, 1], [u, 0], [nextU, 0]);
    pushTriangle(positions, uvs, innerTop, innerTopNext, outerTop, [u, 0], [nextU, 0], [u, 1]);
    pushTriangle(positions, uvs, innerTopNext, outerTopNext, outerTop, [nextU, 0], [nextU, 1], [u, 1]);
    pushTriangle(positions, uvs, innerBottom, outerBottom, innerBottomNext, [u, 0], [u, 1], [nextU, 0]);
    pushTriangle(positions, uvs, innerBottomNext, outerBottom, outerBottomNext, [nextU, 0], [u, 1], [nextU, 1]);
  }

  return finishGeometry(positions, uvs);
}
