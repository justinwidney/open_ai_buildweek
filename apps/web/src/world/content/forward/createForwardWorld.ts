import * as THREE from "three";
import { sampleWorldSpin } from "../../animation/world-spin";
import { disposeObjectTree, type QualityTier } from "../../core";
import { createLayeredPlatform, createRopeBridge } from "../../geometry";
import { createFantasyMaterialKit, FANTASY_PALETTE } from "../../materials";
import { createBasePlatformMaterialSet } from "../../assets/basePlatformMaterials";
import type { Vec3, WorldDefinition, WorldPlatform } from "../../world.types";
import { createFlowerPatch, createLantern, createMilestoneSpinner, createStorybookTree } from "./decorations";
import { createFoundationInscription, createRouteNumber, createSkillSign } from "./signage";

export interface ForwardWorldSlice {
  readonly group: THREE.Group;
  readonly index: number;
  readonly platforms: ReadonlyMap<string, THREE.Object3D>;
  readonly travelCurves: ReadonlyMap<string, THREE.Curve<THREE.Vector3>>;
  update(elapsedSeconds: number, motionIntensity?: number): void;
  setOpacity(opacity: number): void;
  /** Removes islands and connections that are now behind the active stop. */
  retireBehind(platformId: string): readonly string[];
  dispose(): void;
}

export type ForwardWorldRockProfile = "soft" | "storybook" | "shattered";

export interface ForwardWorldPresentation {
  readonly texturesEnabled?: boolean;
  readonly detailsEnabled?: boolean;
}

const ROCK_PROFILES: Record<ForwardWorldRockProfile, {
  jaggedness: number;
  cragDepth: number;
  facetScale: number;
}> = {
  soft: { jaggedness: .012, cragDepth: .66, facetScale: 1.08 },
  storybook: { jaggedness: .025, cragDepth: .72, facetScale: 1 },
  shattered: { jaggedness: .045, cragDepth: .78, facetScale: .9 },
};

function vector(tuple: Vec3) {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function connectionPoints(from: WorldPlatform, to: WorldPlatform) {
  const startCenter = vector(from.position);
  const endCenter = vector(to.position);
  const direction = endCenter.clone().sub(startCenter);
  direction.y = 0;
  direction.normalize();
  const start = startCenter.clone().addScaledVector(direction, from.radius * .79);
  const end = endCenter.clone().addScaledVector(direction, -to.radius * .79);
  start.y = from.position[1] + .13;
  end.y = to.position[1] + .13;
  return { start, end, direction };
}

function makeTravelCurve(start: THREE.Vector3, end: THREE.Vector3) {
  const delta = end.clone().sub(start);
  const first = start.clone().addScaledVector(delta, 1 / 3);
  const second = start.clone().addScaledVector(delta, 2 / 3);
  first.y -= Math.min(.42, start.distanceTo(end) * .025);
  second.y -= Math.min(.42, start.distanceTo(end) * .025);
  return new THREE.CubicBezierCurve3(start, first, second, end);
}

function createSteppingPath(
  id: string,
  curve: THREE.Curve<THREE.Vector3>,
  material: THREE.Material,
  shadows: boolean,
) {
  const group = new THREE.Group();
  group.name = `stepping-path:${id}`;
  const length = curve.getLength();
  const count = Math.max(3, Math.floor(length / 1.15));
  const geometry = new THREE.CylinderGeometry(.31, .38, .13, 8);
  const stones = new THREE.InstancedMesh(geometry, material, count);
  stones.castShadow = shadows;
  stones.receiveShadow = shadows;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    const progress = (index + .5) / count;
    curve.getPointAt(progress, position);
    curve.getTangentAt(progress, tangent);
    position.y -= .08;
    quaternion.setFromEuler(new THREE.Euler(0, Math.atan2(tangent.x, tangent.z), 0));
    const width = .78 + Math.sin(index * 1.77) * .12;
    scale.set(width, 1, .82 + Math.cos(index * 2.1) * .08);
    matrix.compose(position, quaternion, scale);
    stones.setMatrixAt(index, matrix);
  }
  stones.instanceMatrix.needsUpdate = true;
  group.add(stones);
  return group;
}

function attachPlatformHitTarget(group: THREE.Object3D, platform: WorldPlatform) {
  group.userData.platform = platform;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
      object.userData.platform = platform;
    }
  });
}

/** Builds the single camera-facing world used at rest and during the flip reveal. */
export function createForwardWorldSlice(
  definition: WorldDefinition,
  index: number,
  quality: QualityTier,
  rockProfile: ForwardWorldRockProfile = "storybook",
  presentation: ForwardWorldPresentation = {},
): ForwardWorldSlice {
  const group = new THREE.Group();
  group.name = `forward-world:${index}`;
  group.userData.worldIndex = index;
  const texturesEnabled = presentation.texturesEnabled ?? true;
  const detailsEnabled = presentation.detailsEnabled ?? true;
  const materialKit = createFantasyMaterialKit({
    tier: quality,
    seed: 1947 + index * 101,
    texturesEnabled,
  });
  const basePlatform = createBasePlatformMaterialSet({ texturesEnabled });
  const shadows = quality !== "off" && quality !== "low";
  const rock = ROCK_PROFILES[rockProfile];

  const detail = new THREE.MeshStandardMaterial({
    name: "flower-detail",
    color: index % 2 ? 0xf0c29b : 0xcbbfe7,
    roughness: .7,
    emissive: 0x392341,
    emissiveIntensity: .12,
  });
  const rope = new THREE.MeshStandardMaterial({ color: 0x4a3527, roughness: .98 });
  const foliageLight = materialKit.foliage.clone();
  foliageLight.color.copy(FANTASY_PALETTE.foliageLight);
  const glow = new THREE.MeshBasicMaterial({
    color: 0xffcf72,
    transparent: true,
    opacity: .82,
    toneMapped: false,
  });
  const decorations = {
    stone: materialKit.stone,
    wood: materialKit.bridge,
    foliage: materialKit.foliage,
    foliageLight,
    glow,
    flower: detail,
  };

  const platformObjects = new Map<string, THREE.Object3D>();
  const platformBuilds = new Map<string, ReturnType<typeof createLayeredPlatform>>();
  const connectionObjects = new Map<string, THREE.Object3D>();
  const retiredRoots = new Set<THREE.Object3D>();
  const platformById = new Map(definition.platforms.map((platform) => [platform.id, platform]));
  const routeOrder = new Map<string, number>();
  definition.paths.find((path) => path.id === "front")?.platformIds.forEach((id, routeIndex) => {
    routeOrder.set(id, routeIndex + 1);
  });

  for (const [platformIndex, platform] of definition.platforms.entries()) {
    const sockets = definition.paths.flatMap((path) => {
      const ownIndex = path.platformIds.indexOf(platform.id);
      if (ownIndex < 0) return [];
      const neighbors = [path.platformIds[ownIndex - 1], path.platformIds[ownIndex + 1]].filter(Boolean) as string[];
      return neighbors.map((neighborId) => {
        const neighbor = platformById.get(neighborId)!;
        const dx = neighbor.position[0] - platform.position[0];
        const dz = neighbor.position[2] - platform.position[2];
        return { id: `${platform.id}:${neighborId}`, angle: Math.atan2(dx, -dz) };
      });
    });
    const uniqueSockets = [...new Map(sockets.map((socket) => [socket.id, socket])).values()];
    const build = createLayeredPlatform({
      id: platform.id,
      radius: platform.radius,
      position: platform.position,
      seed: 31 + index * 977 + platformIndex * 127,
      shadows,
      baseShape: "stone-cylinder",
      radialFacetCount: Math.round((quality === "high" ? 56 : 40) * rock.facetScale),
      verticalFacetCount: quality === "high" ? 6 : 4,
      jaggedness: rock.jaggedness,
      cragDepth: rock.cragDepth,
      edgeStoneCount: 0,
      detailCount: 0,
      sockets: uniqueSockets,
      materials: {
        stone: basePlatform.wall,
        stoneDark: basePlatform.wallDark,
        rim: basePlatform.rim,
        top: basePlatform.top,
        detail,
      },
    });
    const platformGroup = build.group;
    attachPlatformHitTarget(platformGroup, platform);
    if (detailsEnabled && platform.kind === "start") {
      platformGroup.add(createFoundationInscription(platform));
      const leftLantern = createLantern(decorations, .72);
      leftLantern.position.set(-platform.radius * .7, build.surfaceY, platform.radius * .22);
      platformGroup.add(leftLantern);
      const rightLantern = createLantern(decorations, .72);
      rightLantern.position.set(platform.radius * .7, build.surfaceY, platform.radius * .22);
      platformGroup.add(rightLantern);
      const tree = createStorybookTree(decorations, .72);
      tree.position.set(-platform.radius * .58, build.surfaceY, -.55);
      platformGroup.add(tree);
    } else if (detailsEnabled && platform.kind === "front") {
      platformGroup.add(createRouteNumber(routeOrder.get(platform.id) ?? platformIndex + 1, platform.radius));
      if ((routeOrder.get(platform.id) ?? 0) >= 3) {
        const milestone = createMilestoneSpinner(decorations, Math.min(1, platform.radius * .46));
        milestone.position.set(0, build.surfaceY, -.08);
        platformGroup.add(milestone);
      }
    } else if (detailsEnabled) {
      platformGroup.add(createSkillSign(platform, materialKit.trim.color));
      const flowers = createFlowerPatch(decorations, platformIndex + index * 13, quality === "low" ? 8 : 16);
      flowers.position.set(platform.radius * .36, build.surfaceY, -.2);
      platformGroup.add(flowers);
    }
    // Purpose-specific decoration meshes sit on the same neutral base platform.
    attachPlatformHitTarget(platformGroup, platform);
    group.add(platformGroup);
    platformObjects.set(platform.id, platformGroup);
    platformBuilds.set(platform.id, build);
  }

  const travelCurves = new Map<string, THREE.Curve<THREE.Vector3>>();
  for (const path of definition.paths) {
    for (let pathIndex = 1; pathIndex < path.platformIds.length; pathIndex += 1) {
      const from = platformById.get(path.platformIds[pathIndex - 1]!);
      const to = platformById.get(path.platformIds[pathIndex]!);
      if (!from || !to) continue;
      const id = `${from.id}:${to.id}`;
      const { start, end } = connectionPoints(from, to);
      const curve = makeTravelCurve(start, end);
      travelCurves.set(id, curve);
      if (path.id === "front") {
        const steppingPath = createSteppingPath(id, curve, materialKit.stone, shadows);
        group.add(steppingPath);
        connectionObjects.set(id, steppingPath);
      } else {
        const bridge = createRopeBridge({
          id,
          start,
          end,
          width: .88,
          sag: Math.min(.9, start.distanceTo(end) * .045),
          segmentCount: Math.max(8, Math.floor(start.distanceTo(end) * 1.45)),
          railHeight: .62,
          postEvery: 3,
          shadows,
          materials: { deck: materialKit.bridge, rope, accent: materialKit.trim },
        });
        group.add(bridge.group);
        connectionObjects.set(id, bridge.group);
      }
    }
  }

  let disposed = false;
  return {
    group,
    index,
    platforms: platformObjects,
    travelCurves,
    update: (elapsedSeconds, motionIntensity = 1) => {
      group.traverse((object) => {
        if (object.name === "flower-patch") {
          object.rotation.y = Math.sin(elapsedSeconds * .22 + object.id) * .025 * motionIntensity;
        } else if (object.name === "decorative-spinner") {
          object.rotation.y = sampleWorldSpin(elapsedSeconds, {
            speedRadiansPerSecond: .42 * motionIntensity,
            phaseRadians: object.id * .013,
            reducedMotion: motionIntensity === 0,
          });
        }
      });
    },
    setOpacity: (opacity) => {
      const clamped = THREE.MathUtils.clamp(opacity, 0, 1);
      const seen = new Set<THREE.Material>();
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.material) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (seen.has(material)) continue;
          seen.add(material);
          if (material.userData.worldBaseOpacity === undefined) {
            material.userData.worldBaseOpacity = material.opacity;
            material.userData.worldBaseDepthWrite = material.depthWrite;
          }
          material.transparent = clamped < .999 || material.transparent;
          material.opacity = Number(material.userData.worldBaseOpacity) * clamped;
          material.depthWrite = clamped > .96 && Boolean(material.userData.worldBaseDepthWrite);
          material.needsUpdate = true;
        }
      });
      group.visible = clamped > .001;
    },
    retireBehind: (platformId) => {
      const target = platformById.get(platformId);
      if (!target) return [];
      const retiredIds: string[] = [];
      for (const [candidateId, object] of platformObjects) {
        const candidate = platformById.get(candidateId);
        if (!candidate || candidate.position[2] <= target.position[2] + .001) continue;
        object.removeFromParent();
        retiredRoots.add(object);
        platformObjects.delete(candidateId);
        retiredIds.push(candidateId);
      }
      if (retiredIds.length === 0) return retiredIds;
      const retiredSet = new Set(retiredIds);
      for (const [connectionId, object] of connectionObjects) {
        const [fromId, toId] = connectionId.split(":");
        if (!retiredSet.has(fromId!) && !retiredSet.has(toId!)) continue;
        object.removeFromParent();
        retiredRoots.add(object);
        connectionObjects.delete(connectionId);
        travelCurves.delete(connectionId);
      }
      group.userData.retiredPlatformIds = [
        ...((group.userData.retiredPlatformIds as string[] | undefined) ?? []),
        ...retiredIds,
      ];
      return retiredIds;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeObjectTree(group);
      for (const retired of retiredRoots) disposeObjectTree(retired);
      retiredRoots.clear();
      platformBuilds.clear();
      platformObjects.clear();
      connectionObjects.clear();
      travelCurves.clear();
    },
  };
}
