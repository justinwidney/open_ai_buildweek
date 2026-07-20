import * as THREE from "three";

export type BridgeVector = THREE.Vector3 | readonly [number, number, number];

export interface RopeBridgeMaterials {
  /** Wooden or stone deck planks. Owned by the caller. */
  deck: THREE.Material;
  /** Side ropes, support cables, and posts. Owned by the caller. */
  rope: THREE.Material;
  /** Optional material for every few highlighted planks. */
  accent?: THREE.Material;
}

export interface RopeBridgeOptions {
  id: string;
  /** Local-space walking-surface endpoints. */
  start: BridgeVector;
  end: BridgeVector;
  materials: RopeBridgeMaterials;
  width?: number;
  sag?: number;
  segmentCount?: number;
  plankThickness?: number;
  plankFill?: number;
  railHeight?: number;
  ropeRadius?: number;
  postEvery?: number;
  accentEvery?: number;
  shadows?: boolean;
}

export interface BridgeEndpointSocket {
  id: "start" | "end";
  /** Local-space transform whose +Z axis follows start-to-end travel. */
  anchor: THREE.Object3D;
}

export interface RopeBridgeBuild {
  group: THREE.Group;
  /** Centerline at walking height, expressed in bridge-group local space. */
  travelCurve: THREE.CubicBezierCurve3;
  startSocket: BridgeEndpointSocket;
  endSocket: BridgeEndpointSocket;
  /** Samples local-space position and forward direction without allocating. */
  sampleTravel: (progress: number, position: THREE.Vector3, forward: THREE.Vector3) => void;
  /** Disposes only geometries created by this factory. Shared input materials are untouched. */
  dispose: () => void;
}

const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function toVector3(value: BridgeVector): THREE.Vector3 {
  return value instanceof THREE.Vector3
    ? value.clone()
    : new THREE.Vector3(value[0], value[1], value[2]);
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite number greater than zero.`);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createSagCurve(start: THREE.Vector3, end: THREE.Vector3, sag: number): THREE.CubicBezierCurve3 {
  const delta = end.clone().sub(start);
  const controlOne = start.clone().addScaledVector(delta, 1 / 3);
  const controlTwo = start.clone().addScaledVector(delta, 2 / 3);
  controlOne.y -= sag;
  controlTwo.y -= sag;
  return new THREE.CubicBezierCurve3(start.clone(), controlOne, controlTwo, end.clone());
}

function sideAt(curve: THREE.Curve<THREE.Vector3>, progress: number, target: THREE.Vector3): THREE.Vector3 {
  const tangent = curve.getTangentAt(clamp01(progress), target);
  target.crossVectors(WORLD_UP, tangent);
  if (target.lengthSq() < 1e-8) target.set(1, 0, 0);
  return target.normalize();
}

function offsetCurve(
  source: THREE.Curve<THREE.Vector3>,
  sideSign: -1 | 1,
  sideOffset: number,
  height: number,
  divisions: number,
): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [];
  const side = new THREE.Vector3();
  for (let index = 0; index <= divisions; index += 1) {
    const progress = index / divisions;
    const point = source.getPointAt(progress);
    sideAt(source, progress, side);
    point.addScaledVector(side, sideOffset * sideSign);
    point.y += height;
    points.push(point);
  }
  return new THREE.CatmullRomCurve3(points, false, "centripetal");
}

function orientForward(anchor: THREE.Object3D, direction: THREE.Vector3): void {
  anchor.quaternion.setFromUnitVectors(LOCAL_FORWARD, direction.clone().normalize());
}

/**
 * Builds a curved, segmented bridge from local-space endpoints. The returned
 * travel curve is the same sagging centerline used to place the deck, making it
 * suitable for character movement and camera choreography.
 */
export function createRopeBridge(options: RopeBridgeOptions): RopeBridgeBuild {
  const start = toVector3(options.start);
  const end = toVector3(options.end);
  const distance = start.distanceTo(end);
  assertFinitePositive(distance, "Bridge length");

  const width = options.width ?? Math.max(0.8, Math.min(1.8, distance * 0.08));
  const sag = options.sag ?? Math.min(distance * 0.09, 2.4);
  const segmentCount = Math.max(3, Math.floor(options.segmentCount ?? distance * 1.65));
  const plankThickness = options.plankThickness ?? Math.max(0.08, width * 0.1);
  const plankFill = Math.min(0.96, Math.max(0.45, options.plankFill ?? 0.78));
  const railHeight = options.railHeight ?? width * 0.7;
  const ropeRadius = options.ropeRadius ?? Math.max(0.025, width * 0.035);
  const postEvery = Math.max(1, Math.floor(options.postEvery ?? 2));
  const accentEvery = Math.max(0, Math.floor(options.accentEvery ?? 7));
  const shadows = options.shadows ?? true;

  assertFinitePositive(width, "Bridge width");
  assertFinitePositive(plankThickness, "Plank thickness");
  assertFinitePositive(railHeight, "Rail height");
  assertFinitePositive(ropeRadius, "Rope radius");
  if (!Number.isFinite(sag) || sag < 0) throw new RangeError("Bridge sag must be finite and non-negative.");

  const group = new THREE.Group();
  group.name = `bridge:${options.id}`;
  group.userData.kind = "rope-bridge";
  group.userData.bridgeId = options.id;
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const travelCurve = createSagCurve(start, end, sag);
  const points = travelCurve.getSpacedPoints(segmentCount);

  const deckGeometry = new THREE.BoxGeometry(1, 1, 1);
  ownedGeometries.add(deckGeometry);
  const segmentTotal = points.length - 1;
  const accentCount = accentEvery > 0 && options.materials.accent
    ? Math.floor((segmentTotal - 1) / accentEvery)
    : 0;
  const deckCount = segmentTotal - accentCount;
  const deck = new THREE.InstancedMesh(deckGeometry, options.materials.deck, deckCount);
  deck.name = "bridge-deck";
  deck.castShadow = shadows;
  deck.receiveShadow = shadows;
  const accentDeck = accentCount > 0 && options.materials.accent
    ? new THREE.InstancedMesh(deckGeometry, options.materials.accent, accentCount)
    : undefined;
  if (accentDeck) {
    accentDeck.name = "bridge-deck-accents";
    accentDeck.castShadow = shadows;
    accentDeck.receiveShadow = shadows;
  }

  const matrix = new THREE.Matrix4();
  const midpoint = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  let deckIndex = 0;
  let accentIndex = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) continue;
    midpoint.copy(from).add(to).multiplyScalar(0.5);
    midpoint.y -= plankThickness * 0.5;
    direction.copy(to).sub(from);
    const segmentLength = direction.length();
    direction.normalize();
    quaternion.setFromUnitVectors(LOCAL_FORWARD, direction);
    const widthVariation = 0.94 + Math.sin(index * 2.17) * 0.035;
    scale.set(width * widthVariation, plankThickness, segmentLength * plankFill);
    matrix.compose(midpoint, quaternion, scale);
    const isAccent = Boolean(accentDeck && accentEvery > 0 && index > 0 && index % accentEvery === 0);
    if (isAccent && accentDeck) {
      accentDeck.setMatrixAt(accentIndex, matrix);
      accentIndex += 1;
    } else {
      deck.setMatrixAt(deckIndex, matrix);
      deckIndex += 1;
    }
  }
  deck.instanceMatrix.needsUpdate = true;
  group.add(deck);
  if (accentDeck) {
    accentDeck.instanceMatrix.needsUpdate = true;
    group.add(accentDeck);
  }

  const ropeDivisions = Math.max(12, segmentCount * 2);
  const sideOffset = width * 0.55;
  const lowerRopeHeight = plankThickness * 0.15;
  const ropeCurves = [
    offsetCurve(travelCurve, -1, sideOffset, lowerRopeHeight, ropeDivisions),
    offsetCurve(travelCurve, 1, sideOffset, lowerRopeHeight, ropeDivisions),
    offsetCurve(travelCurve, -1, sideOffset, railHeight, ropeDivisions),
    offsetCurve(travelCurve, 1, sideOffset, railHeight, ropeDivisions),
  ];
  for (const [index, ropeCurve] of ropeCurves.entries()) {
    const geometry = new THREE.TubeGeometry(ropeCurve, ropeDivisions, ropeRadius, 6, false);
    ownedGeometries.add(geometry);
    const rope = new THREE.Mesh(geometry, options.materials.rope);
    rope.name = index < 2 ? "deck-support-rope" : "hand-rope";
    rope.castShadow = shadows;
    rope.receiveShadow = shadows;
    group.add(rope);
  }

  const postSamples: number[] = [];
  for (let index = 0; index <= segmentCount; index += postEvery) postSamples.push(index / segmentCount);
  if (postSamples[postSamples.length - 1] !== 1) postSamples.push(1);
  const postGeometry = new THREE.CylinderGeometry(1, 0.88, 1, 7, 1);
  ownedGeometries.add(postGeometry);
  const posts = new THREE.InstancedMesh(postGeometry, options.materials.rope, postSamples.length * 2);
  posts.name = "bridge-posts";
  posts.castShadow = shadows;
  posts.receiveShadow = shadows;
  const side = new THREE.Vector3();
  let postIndex = 0;
  for (const progress of postSamples) {
    const point = travelCurve.getPointAt(progress);
    sideAt(travelCurve, progress, side);
    for (const sideSign of [-1, 1] as const) {
      positionPostMatrix(matrix, point, side, sideSign, sideOffset, railHeight, ropeRadius);
      posts.setMatrixAt(postIndex, matrix);
      postIndex += 1;
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  const startAnchor = new THREE.Object3D();
  startAnchor.name = "bridge-socket:start";
  startAnchor.position.copy(start);
  orientForward(startAnchor, travelCurve.getTangentAt(0));
  startAnchor.userData.kind = "bridge-socket";
  startAnchor.userData.socketId = "start";
  group.add(startAnchor);

  const endAnchor = new THREE.Object3D();
  endAnchor.name = "bridge-socket:end";
  endAnchor.position.copy(end);
  orientForward(endAnchor, travelCurve.getTangentAt(1));
  endAnchor.userData.kind = "bridge-socket";
  endAnchor.userData.socketId = "end";
  group.add(endAnchor);

  return {
    group,
    travelCurve,
    startSocket: { id: "start", anchor: startAnchor },
    endSocket: { id: "end", anchor: endAnchor },
    sampleTravel: (progress, position, forward) => {
      const normalizedProgress = clamp01(progress);
      travelCurve.getPointAt(normalizedProgress, position);
      travelCurve.getTangentAt(normalizedProgress, forward).normalize();
    },
    dispose: () => {
      for (const geometry of ownedGeometries) geometry.dispose();
      ownedGeometries.clear();
    },
  };
}

function positionPostMatrix(
  matrix: THREE.Matrix4,
  point: THREE.Vector3,
  side: THREE.Vector3,
  sideSign: -1 | 1,
  sideOffset: number,
  railHeight: number,
  radius: number,
): void {
  const position = point.clone().addScaledVector(side, sideOffset * sideSign);
  position.y += railHeight * 0.5;
  matrix.compose(
    position,
    new THREE.Quaternion(),
    new THREE.Vector3(radius * 1.45, railHeight, radius * 1.45),
  );
}
