import * as THREE from "three";
import cloud008Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_008.svg?url";
import cloud009Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_009.svg?url";
import cloud010Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_010.svg?url";
import cloud011Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_011.svg?url";
import cloud012Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_012.svg?url";
import cloud013Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_013.svg?url";
import cloud014Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_014.svg?url";
import cloud025Url from "../../../../tools/svg/sprites_svg/horizon-clouds/sprite_025.svg?url";
import island030Url from "../../../../tools/svg/sprites_svg/floating-islands/sprite_030.svg?url";
import island033Url from "../../../../tools/svg/sprites_svg/floating-islands/sprite_033.svg?url";
import castleFinalIslandUrl from "../../../../tools/svg/sprites_svg/distant-landmarks/castle_final_island.svg?url";
import waterSurfaceFlowUrl from "../../../../tools/svg/sprites_svg/water/water_surface_flow.svg?url";
import waterfallRibbonUrl from "../../../../tools/svg/sprites_svg/water/waterfall_ribbon.svg?url";
import continuousRoadReferenceUrl from "../../../../tools/svg/generated/reference_06_03_continuous_road.svg?url";
import animatedCloudBankUrl from "../../../../tools/svg/generated/level-two-slices/animated/cloud-bank.png?url";
import animatedWaterfallUrl from "../../../../tools/svg/generated/level-two-slices/animated/waterfall.png?url";
import cleanBackgroundUrl from "../../../../tools/svg/generated/level-two-slices/clean-background.svg?url";
import farCastleMaskUrl from "../../../../tools/svg/generated/level-two-slices/masks/far-castle-mask.svg?url";
import middleRouteMaskUrl from "../../../../tools/svg/generated/level-two-slices/masks/middle-route-mask.svg?url";
import nearRouteMaskUrl from "../../../../tools/svg/generated/level-two-slices/masks/near-route-mask.svg?url";
import foregroundLedgesMaskUrl from "../../../../tools/svg/generated/level-two-slices/masks/foreground-ledges-mask.svg?url";
import layerManifestJson from "../../../../tools/svg/generated/level-two-slices/layer-manifest.json";
import { addLabLighting, createThreeLab } from "./threeLab";

export type LevelTwoDirection = -1 | 0 | 1;
type RegisteredPlaneKind = "animated-cloud" | "animated-waterfall" | "side-island" | "water-flow";

interface RegisteredPlaneConfig {
  readonly id: string;
  readonly enabled: boolean;
  readonly assetId: string;
  readonly kind: RegisteredPlaneKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly renderOrder: number;
  readonly phase: number;
  readonly parallax: number;
}

interface RegisteredFlagConfig {
  readonly id: string;
  readonly enabled: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly phase: number;
}

interface RegisteredDepthPlateConfig {
  readonly id: string;
  readonly enabled: boolean;
  readonly assetId: string;
  readonly maskAssetId?: string;
  readonly cropTop: number;
  readonly cropBottom: number;
  readonly depth: number;
  readonly renderOrder: number;
  readonly parallax: number;
}

const LAYER_MANIFEST = layerManifestJson as {
  readonly base: { readonly enabled: boolean; readonly assetId: string; readonly cropTop: number; readonly cropBottom: number; readonly depth: number };
  readonly depthPlates: readonly RegisteredDepthPlateConfig[];
  readonly planes: readonly RegisteredPlaneConfig[];
  readonly flags: readonly RegisteredFlagConfig[];
  readonly travel: { readonly cameraPushStops: readonly number[] };
};

export interface VisibilityDiagnostic {
  readonly id: string;
  readonly index: number;
  readonly cameraZ: number;
  readonly distance: number;
  readonly inFrustum: boolean;
  readonly visible: boolean;
  readonly state: "active" | "ahead" | "culled" | "behind" | "retired";
}

export interface LevelTwoDiagnostics {
  readonly fps: number;
  readonly frameMs: number;
  readonly calls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly geometries: number;
  readonly stops: readonly VisibilityDiagnostic[];
}

export interface LevelTwoRuntimeCallbacks {
  readonly onChapter: (chapter: number) => void;
  readonly onDiagnostics: (diagnostics: LevelTwoDiagnostics) => void;
  readonly onLock: (locked: boolean) => void;
  readonly onStatus: (status: string) => void;
  readonly onStep: (step: number) => void;
  readonly onUniverse: (universe: 0 | 1) => void;
}

export interface LevelTwoThreeRuntime {
  readonly step: number;
  readonly universe: 0 | 1;
  enterCastle(): boolean;
  reset(): void;
  rotateUniverse(): boolean;
  setDebugMarkers(visible: boolean): void;
  setReducedMotion(reduced: boolean): void;
  travel(direction: LevelTwoDirection): boolean;
  dispose(): void;
}

interface StopRuntime {
  readonly group: THREE.Group;
  readonly marker: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  readonly representative: THREE.Mesh;
}

interface WorldRuntime {
  readonly root: THREE.Group;
  readonly stops: readonly StopRuntime[];
  readonly routeSegments: readonly THREE.Group[];
  readonly optionGroup: THREE.Group;
  readonly materials: readonly THREE.Material[];
}

interface ActiveTravel {
  readonly direction: LevelTwoDirection;
  readonly durationMs: number;
  readonly startedAtMs: number;
  readonly startX: number;
  readonly startPush: number;
  readonly targetX: number;
  readonly targetPush: number;
}

interface ActiveRotation {
  readonly durationMs: number;
  readonly sourceAngle: number;
  readonly startedAtMs: number;
  readonly targetAngle: number;
  readonly toParallel: boolean;
}

const ROUTE_STOPS = 5;
const STEP_DISTANCE = 14;
const LATERAL_STEP = 3.6;
const MAX_ROUTE_X = 7.2;
const DEFAULT_ROUTE_X = [0, -1.15, .85, -1.05, .65, 0] as const;
const REFERENCE_SOURCE_WIDTH = 1200;
const REFERENCE_SOURCE_HEIGHT = 694;
const REFERENCE_ASPECT = 1200 / 694;
const REFERENCE_CENTER = new THREE.Vector3(0, 0, -8);
const SPRITE_URLS = new Map<string, string>([
  ["sprite_008", cloud008Url],
  ["sprite_009", cloud009Url],
  ["sprite_010", cloud010Url],
  ["sprite_011", cloud011Url],
  ["sprite_012", cloud012Url],
  ["sprite_013", cloud013Url],
  ["sprite_014", cloud014Url],
  ["sprite_025", cloud025Url],
  ["sprite_030", island030Url],
  ["sprite_033", island033Url],
  ["castle_final_island", castleFinalIslandUrl],
  ["water_surface_flow", waterSurfaceFlowUrl],
  ["waterfall_ribbon", waterfallRibbonUrl],
  ["reference_06_03_continuous_road", continuousRoadReferenceUrl],
  ["animated_cloud_bank", animatedCloudBankUrl],
  ["animated_waterfall", animatedWaterfallUrl],
  ["reference_06_03_clean_background", cleanBackgroundUrl],
  ["mask_far_castle", farCastleMaskUrl],
  ["mask_middle_route", middleRouteMaskUrl],
  ["mask_near_route", nearRouteMaskUrl],
  ["mask_foreground_ledges", foregroundLedgesMaskUrl],
]);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function easeInOutCubic(value: number) {
  return value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}

function smoothstep(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function uniqueMaterials(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => materials.add(material));
  });
  return [...materials];
}

function prepareMaterials(materials: readonly THREE.Material[]) {
  materials.forEach((material) => {
    material.userData.levelTwoBaseOpacity = material.opacity;
    material.userData.levelTwoBaseDepthWrite = material.depthWrite;
    material.transparent = true;
  });
}

function setMaterialOpacity(materials: readonly THREE.Material[], alpha: number) {
  materials.forEach((material) => {
    const baseOpacity = Number(material.userData.levelTwoBaseOpacity ?? 1);
    const baseDepthWrite = Boolean(material.userData.levelTwoBaseDepthWrite ?? material.depthWrite);
    material.opacity = baseOpacity * alpha;
    material.depthWrite = baseDepthWrite && alpha > .985;
    material.visible = alpha > .003;
  });
}

function cloneWorldWithIndependentMaterials(source: THREE.Group) {
  const clone = source.clone(true);
  const materialClones = new Map<THREE.Material, THREE.Material>();
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const cloneMaterial = (material: THREE.Material) => {
      const existing = materialClones.get(material);
      if (existing) return existing;
      const created = material.clone();
      materialClones.set(material, created);
      return created;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });
  return clone;
}

function routeWidthAt(index: number) {
  return Math.max(3.9, 6.8 - index * .48);
}

function roadWidthAt(index: number) {
  return Math.max(1.7, 2.85 - index * .18);
}

function ribbonGeometry(
  length: number,
  startY: number,
  endY: number,
  startWidth: number,
  endWidth: number,
  seed: number,
  kind: "road" | "top",
) {
  const samples = 20;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color(kind === "road" ? 0xdcc38c : 0x9bad68);
  for (let sample = 0; sample <= samples; sample += 1) {
    const t = sample / samples;
    const z = -length / 2 + length * t;
    const edgeNoise = Math.sin(t * Math.PI) * (
      Math.sin(t * Math.PI * 3 + seed * 1.71) * (kind === "road" ? .08 : .22)
      + Math.sin(t * Math.PI * 7 + seed * .83) * (kind === "road" ? .035 : .09)
    );
    const centerNoise = Math.sin(t * Math.PI) * (
      Math.sin(t * Math.PI * 2 + seed * 2.13) * (kind === "road" ? .13 : .32)
      + Math.sin(t * Math.PI * 5 + seed) * (kind === "road" ? .04 : .12)
    );
    const width = THREE.MathUtils.lerp(startWidth, endWidth, t) + edgeNoise;
    const y = THREE.MathUtils.lerp(startY, endY, t) + (kind === "road" ? .28 : 0);
    positions.push(centerNoise - width / 2, y, z, centerNoise + width / 2, y, z);
    const shade = Math.sin(seed * 2.4 + t * 9.7) * (kind === "road" ? .035 : .055);
    const color = baseColor.clone().offsetHSL(0, 0, shade);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    if (sample < samples) {
      const offset = sample * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function cliffGeometry(
  length: number,
  startY: number,
  endY: number,
  startWidth: number,
  endWidth: number,
  seed: number,
) {
  const samples = 20;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color(0x667f8f);
  for (const side of [-1, 1] as const) {
    const sideOffset = positions.length / 3;
    for (let sample = 0; sample <= samples; sample += 1) {
      const t = sample / samples;
      const z = -length / 2 + length * t;
      const centerNoise = Math.sin(t * Math.PI) * (
        Math.sin(t * Math.PI * 2 + seed * 2.13) * .32
        + Math.sin(t * Math.PI * 5 + seed) * .12
      );
      const edgeNoise = Math.sin(t * Math.PI) * (
        Math.sin(t * Math.PI * 3 + seed * 1.71) * .22
        + Math.sin(t * Math.PI * 7 + seed * .83) * .09
      );
      const width = THREE.MathUtils.lerp(startWidth, endWidth, t) + edgeNoise;
      const topY = THREE.MathUtils.lerp(startY, endY, t) - .02;
      const depth = 2.75 + Math.sin(seed * 1.9 + t * 13) * .38 + Math.sin(t * Math.PI) * .45;
      const topX = centerNoise + side * width / 2;
      const bottomX = centerNoise + side * width * (.30 + .07 * Math.sin(seed + t * 8));
      positions.push(topX, topY, z, bottomX, topY - depth, z);
      const topColor = baseColor.clone().offsetHSL(0, -.02, .09 + Math.sin(t * 7 + seed) * .04);
      const bottomColor = baseColor.clone().offsetHSL(.01, .02, -.13 + Math.sin(t * 5 + seed) * .03);
      colors.push(topColor.r, topColor.g, topColor.b, bottomColor.r, bottomColor.g, bottomColor.b);
      if (sample < samples) {
        const offset = sideOffset + sample * 2;
        indices.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function setRouteSegmentBetween(group: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, index: number) {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const length = Math.hypot(deltaX, deltaZ);
  const centerY = (start.y + end.y) / 2;
  const startY = start.y - centerY;
  const endY = end.y - centerY;
  const top = group.getObjectByName(`level-two-route-top-${index}`) as THREE.Mesh;
  const cliff = group.getObjectByName(`level-two-route-cliff-${index}`) as THREE.Mesh;
  const road = group.getObjectByName(`level-two-route-road-${index}`) as THREE.Mesh;
  top.geometry.dispose();
  cliff.geometry.dispose();
  road.geometry.dispose();
  top.geometry = ribbonGeometry(length, startY, endY, routeWidthAt(index), routeWidthAt(index + 1), index + .7, "top");
  cliff.geometry = cliffGeometry(length, startY, endY, routeWidthAt(index), routeWidthAt(index + 1), index + .7);
  road.geometry = ribbonGeometry(length, startY, endY, roadWidthAt(index), roadWidthAt(index + 1), index + 4.1, "road");
  group.position.set((start.x + end.x) / 2, centerY, (start.z + end.z) / 2);
  group.rotation.y = Math.atan2(deltaX, deltaZ);
}

/**
 * Map a rectangular vertical portion of one shared texture onto a plane. The
 * source remains one GPU texture; only the geometry UVs differ per depth plate.
 */
function croppedPlaneGeometry(top: number, bottom: number) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const sourceBottom = 1 - bottom;
  const sourceTop = 1 - top;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setY(index, THREE.MathUtils.lerp(sourceBottom, sourceTop, uv.getY(index)));
  }
  uv.needsUpdate = true;
  return geometry;
}

function hydrateWorld(root: THREE.Group): WorldRuntime {
  const stops = Array.from({ length: ROUTE_STOPS + 1 }, (_, index): StopRuntime => {
    const group = root.getObjectByName(`level-two-stop-${index}`) as THREE.Group;
    const representative = group.getObjectByName(`level-two-stop-top-${index}`) as THREE.Mesh;
    const marker = group.getObjectByName(`level-two-debug-marker-${index}`) as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
    return { group, representative, marker };
  });
  const routeSegments = Array.from({ length: ROUTE_STOPS }, (_, index) => root.getObjectByName(`level-two-route-segment-${index}`) as THREE.Group);
  const optionGroup = root.getObjectByName("level-two-route-options") as THREE.Group;
  return { root, stops, routeSegments, optionGroup, materials: uniqueMaterials(root) };
}

export function createLevelTwoThreeRuntime(
  canvas: HTMLCanvasElement,
  callbacks: LevelTwoRuntimeCallbacks,
): LevelTwoThreeRuntime {
  const lab = createThreeLab(canvas, { far: 190, fov: 46 });
  lab.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  lab.renderer.shadowMap.enabled = false;
  lab.scene.fog = new THREE.FogExp2(0x9ecbe0, .014);
  addLabLighting(lab.scene);

  const cameraRig = new THREE.Group();
  cameraRig.name = "level-two-camera-rig";
  lab.scene.add(cameraRig);
  cameraRig.add(lab.camera);
  // Equal vertical and forward offsets produce the requested 45-degree
  // isometric-style view while retaining perspective for travel and parallax.
  lab.camera.position.set(0, 18, 10);
  lab.camera.lookAt(REFERENCE_CENTER);
  lab.camera.updateMatrixWorld(true);
  const initialCameraPosition = lab.camera.position.clone();
  const referenceForward = new THREE.Vector3();
  const referenceUp = new THREE.Vector3(0, 1, 0).applyQuaternion(lab.camera.quaternion);
  const referenceRight = new THREE.Vector3(1, 0, 0).applyQuaternion(lab.camera.quaternion);
  lab.camera.getWorldDirection(referenceForward);
  const referenceDistance = lab.camera.position.distanceTo(REFERENCE_CENTER);
  const referenceCoverSize = () => {
    const visibleHeight = 2 * referenceDistance * Math.tan(THREE.MathUtils.degToRad(lab.camera.fov / 2));
    const visibleWidth = visibleHeight * lab.camera.aspect;
    const height = Math.max(visibleHeight, visibleWidth / REFERENCE_ASPECT) * 1.025;
    return { height, width: height * REFERENCE_ASPECT };
  };
  let { width: referenceCoverWidth, height: referenceCoverHeight } = referenceCoverSize();
  let referenceLayoutAspect = lab.camera.aspect;

  const splitWorldRoot = new THREE.Group();
  splitWorldRoot.name = "level-two-split-world-root";
  lab.scene.add(splitWorldRoot);

  const markerGeometry = new THREE.TorusGeometry(3.52, .075, 6, 36);
  const sceneryPlaneGeometry = new THREE.PlaneGeometry(1, 1);
  const stopProbeGeometry = new THREE.BoxGeometry(.35, .35, .35);
  const topMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: .94, vertexColors: true });
  const cliffMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: .99, side: THREE.DoubleSide, vertexColors: true });
  const roadMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: .96, vertexColors: true });
  const stopProbeMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, opacity: 0, transparent: true });
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x4faeca, opacity: .65, roughness: .42, transparent: true });
  const textureLoader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  const cropFeatherTextures: THREE.CanvasTexture[] = [];

  const textureFor = (id: string) => {
    const existing = textures.get(id);
    if (existing) return existing;
    const url = SPRITE_URLS.get(id);
    if (!url) return undefined;
    const texture = textureLoader.load(url, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.needsUpdate = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    textures.set(id, texture);
    return texture;
  };

  const makeCropFeatherTexture = (top: number, bottom: number) => {
    if (top <= 0 && bottom >= 1) return undefined;
    const canvasTexture = document.createElement("canvas");
    canvasTexture.width = 1;
    canvasTexture.height = 256;
    const context = canvasTexture.getContext("2d");
    if (!context) return undefined;
    const pixels = context.createImageData(1, canvasTexture.height);
    const sourceBottom = 1 - bottom;
    const sourceTop = 1 - top;
    const feather = Math.min(.035, (sourceTop - sourceBottom) * .18);
    for (let row = 0; row < canvasTexture.height; row += 1) {
      // Canvas rows run top-to-bottom while the plane UVs use bottom-to-top.
      const sourceV = 1 - row / (canvasTexture.height - 1);
      const lower = smoothstep((sourceV - sourceBottom) / feather);
      const upper = smoothstep((sourceTop - sourceV) / feather);
      const value = Math.round(255 * lower * upper);
      const offset = row * 4;
      pixels.data[offset] = value;
      pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value;
      pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvasTexture);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    cropFeatherTextures.push(texture);
    return texture;
  };

  const makeSceneryPlane = (id: string, kind: "castle" | "cloud" | "island" | "waterfall", x: number, y: number, z: number, width: number, phase: number) => {
    const map = textureFor(id);
    const material = new THREE.MeshBasicMaterial({
      alphaTest: .025,
      color: 0xffffff,
      depthWrite: false,
      map,
      opacity: kind === "cloud" ? .78 : kind === "waterfall" ? .84 : .94,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const plane = new THREE.Mesh(sceneryPlaneGeometry, material);
    plane.name = `level-two-${kind}-${id}-${phase}`;
    plane.position.set(x, y, z);
    const height = kind === "cloud"
      ? width * .5
      : kind === "waterfall"
        ? width * (360 / 140)
        : kind === "castle"
          ? width * (523 / 600)
          : width * .86;
    plane.scale.set(width, height, 1);
    // Face the initial camera once, then remain fixed in world space. Unlike a
    // THREE.Sprite billboard, this plane never counter-rotates with the camera.
    plane.lookAt(lab.camera.position);
    plane.userData.levelTwoKind = kind;
    plane.userData.levelTwoBaseX = x;
    plane.userData.levelTwoDrift = kind === "cloud" ? 1.2 + (phase % 3) * .45 : .18;
    plane.userData.levelTwoPhase = phase;
    plane.frustumCulled = true;
    return plane;
  };

  const setReferenceBaseTransform = (object: THREE.Object3D, basePosition: THREE.Vector3) => {
    object.position.copy(basePosition);
    object.quaternion.copy(lab.camera.quaternion);
    object.userData.levelTwoBaseX = basePosition.x;
    object.userData.levelTwoBaseY = basePosition.y;
    object.userData.levelTwoBaseZ = basePosition.z;
    object.userData.levelTwoBaseScaleX = object.scale.x;
    object.userData.levelTwoBaseScaleY = object.scale.y;
  };

  const layoutReferenceObject = (object: THREE.Object3D) => {
    const type = String(object.userData.levelTwoReferenceLayout ?? "");
    if (!type) return;
    const depthOffset = Number(object.userData.levelTwoDepthOffset ?? 0);
    const distanceScale = (referenceDistance + depthOffset) / referenceDistance;
    if (type === "plate") {
      const top = Number(object.userData.levelTwoCropTop ?? 0);
      const bottom = Number(object.userData.levelTwoCropBottom ?? 1);
      const sliceCenter = (.5 - (top + bottom) / 2) * referenceCoverHeight;
      object.scale.set(
        referenceCoverWidth * distanceScale,
        referenceCoverHeight * (bottom - top) * distanceScale,
        1,
      );
      const basePosition = REFERENCE_CENTER.clone()
        .addScaledVector(referenceForward, depthOffset)
        .addScaledVector(referenceUp, sliceCenter * distanceScale);
      setReferenceBaseTransform(object, basePosition);
      return;
    }

    const sourceX = Number(object.userData.levelTwoRegisteredX ?? REFERENCE_SOURCE_WIDTH / 2);
    const sourceY = Number(object.userData.levelTwoRegisteredY ?? REFERENCE_SOURCE_HEIGHT / 2);
    const sourceWidth = Number(object.userData.levelTwoRegisteredWidth ?? 1);
    const sourceHeight = Number(object.userData.levelTwoRegisteredHeight ?? 1);
    const localX = (sourceX / REFERENCE_SOURCE_WIDTH - .5) * referenceCoverWidth;
    const localY = (.5 - sourceY / REFERENCE_SOURCE_HEIGHT) * referenceCoverHeight;
    object.scale.set(
      referenceCoverWidth * (sourceWidth / REFERENCE_SOURCE_WIDTH) * distanceScale,
      referenceCoverHeight * (sourceHeight / REFERENCE_SOURCE_HEIGHT) * distanceScale,
      1,
    );
    const basePosition = REFERENCE_CENTER.clone()
      .addScaledVector(referenceForward, depthOffset)
      .addScaledVector(referenceRight, localX * distanceScale)
      .addScaledVector(referenceUp, localY * distanceScale);
    setReferenceBaseTransform(object, basePosition);
  };

  const makeReferencePlate = (
    name: string,
    assetId: string,
    maskAssetId: string | undefined,
    top: number,
    bottom: number,
    depthOffset: number,
    renderOrder: number,
    parallax: number,
  ) => {
    const material = new THREE.MeshBasicMaterial({
      alphaMap: maskAssetId ? textureFor(maskAssetId) : makeCropFeatherTexture(top, bottom),
      color: 0xffffff,
      depthTest: false,
      depthWrite: false,
      fog: false,
      map: textureFor(assetId),
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
    });
    const plane = new THREE.Mesh(croppedPlaneGeometry(top, bottom), material);
    plane.name = name;
    plane.renderOrder = renderOrder;
    plane.frustumCulled = false;
    plane.userData.levelTwoReferenceLayer = true;
    plane.userData.levelTwoReferenceLayout = "plate";
    plane.userData.levelTwoCropTop = top;
    plane.userData.levelTwoCropBottom = bottom;
    plane.userData.levelTwoDepthOffset = depthOffset;
    plane.userData.levelTwoParallax = parallax;
    layoutReferenceObject(plane);
    return plane;
  };

  const makeRegisteredPlane = (
    id: string,
    name: string,
    kind: RegisteredPlaneKind,
    x: number,
    y: number,
    width: number,
    height: number,
    depthOffset: number,
    renderOrder: number,
    phase: number,
    parallax: number,
  ) => {
    const material = new THREE.MeshBasicMaterial({
      alphaTest: .015,
      color: 0xffffff,
      depthTest: false,
      depthWrite: false,
      fog: false,
      map: textureFor(id),
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
    });
    const plane = new THREE.Mesh(sceneryPlaneGeometry, material);
    plane.name = name;
    plane.renderOrder = renderOrder;
    plane.frustumCulled = false;
    plane.userData.levelTwoReferenceLayer = true;
    plane.userData.levelTwoReferenceLayout = "registered";
    plane.userData.levelTwoRegisteredX = x;
    plane.userData.levelTwoRegisteredY = y;
    plane.userData.levelTwoRegisteredWidth = width;
    plane.userData.levelTwoRegisteredHeight = height;
    plane.userData.levelTwoDepthOffset = depthOffset;
    plane.userData.levelTwoParallax = parallax;
    plane.userData.levelTwoKind = kind;
    plane.userData.levelTwoPhase = phase;
    layoutReferenceObject(plane);
    return plane;
  };

  const makeRegisteredFlag = (name: string, x: number, y: number, width: number, height: number, phase: number) => {
    const group = new THREE.Group();
    group.name = name;
    group.userData.levelTwoReferenceLayer = true;
    group.userData.levelTwoReferenceLayout = "registered";
    group.userData.levelTwoRegisteredX = x;
    group.userData.levelTwoRegisteredY = y;
    group.userData.levelTwoRegisteredWidth = width;
    group.userData.levelTwoRegisteredHeight = height;
    group.userData.levelTwoDepthOffset = -.45;
    group.userData.levelTwoParallax = .2;
    group.userData.levelTwoKind = "animated-flag";
    group.userData.levelTwoPhase = phase;

    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x746b60, depthTest: false, depthWrite: false, toneMapped: false });
    const flagMaterial = new THREE.MeshBasicMaterial({ color: 0x174b86, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const pole = new THREE.Mesh(new THREE.PlaneGeometry(.08, 1), poleMaterial);
    pole.position.set(-.42, -.03, 0);
    pole.renderOrder = 29;
    const flagShape = new THREE.Shape();
    flagShape.moveTo(-.38, .42);
    flagShape.lineTo(.52, .24);
    flagShape.lineTo(-.38, .04);
    flagShape.closePath();
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), flagMaterial);
    flag.name = `${name}-pennant`;
    flag.renderOrder = 30;
    flag.userData.levelTwoFlagBlade = true;
    flag.userData.levelTwoPhase = phase;
    group.add(pole, flag);
    layoutReferenceObject(group);
    return group;
  };

  const makeReferenceComposition = () => {
    const group = new THREE.Group();
    group.name = "level-two-reference-06-03-layers";

    // The complete plate guarantees that load-in matches the approved image.
    // Registered UV crops repeat far, middle, and near bands at independent
    // depths. They initially align pixel-for-pixel, then separate gently under
    // camera travel and pointer parallax. Semantic cutouts can replace any band
    // later without changing the scene or animation APIs.
    if (LAYER_MANIFEST.base.enabled) {
      group.add(makeReferencePlate(
        "level-two-reference-base",
        LAYER_MANIFEST.base.assetId,
        undefined,
        LAYER_MANIFEST.base.cropTop,
        LAYER_MANIFEST.base.cropBottom,
        LAYER_MANIFEST.base.depth,
        20,
        .025,
      ));
    }
    LAYER_MANIFEST.depthPlates.filter((plate) => plate.enabled).forEach((plate) => {
      group.add(makeReferencePlate(
        `level-two-reference-${plate.id}`,
        plate.assetId,
        plate.maskAssetId,
        plate.cropTop,
        plate.cropBottom,
        plate.depth,
        plate.renderOrder,
        plate.parallax,
      ));
    });
    LAYER_MANIFEST.planes.filter((layer) => layer.enabled).forEach((layer) => {
      group.add(makeRegisteredPlane(
        layer.assetId,
        `level-two-layer-${layer.id}`,
        layer.kind,
        layer.x,
        layer.y,
        layer.width,
        layer.height,
        layer.depth,
        layer.renderOrder,
        layer.phase,
        layer.parallax,
      ));
    });
    LAYER_MANIFEST.flags.filter((flag) => flag.enabled).forEach((flag) => {
      group.add(makeRegisteredFlag(
        `level-two-layer-${flag.id}`,
        flag.x,
        flag.y,
        flag.width,
        flag.height,
        flag.phase,
      ));
    });
    return group;
  };

  const buildCanonicalWorld = () => {
    const root = new THREE.Group();
    root.name = "level-two-primary-world";
    root.add(makeReferenceComposition());

    const water = new THREE.Mesh(new THREE.PlaneGeometry(130, 150, 1, 1), waterMaterial);
    water.name = "level-two-water";
    water.position.set(0, -4.5, -55);
    water.rotation.x = -Math.PI / 2;
    root.add(water);

    const waterFlowTexture = textureFor("water_surface_flow");
    if (waterFlowTexture) {
      waterFlowTexture.wrapS = THREE.RepeatWrapping;
      waterFlowTexture.wrapT = THREE.RepeatWrapping;
      waterFlowTexture.repeat.set(1.2, 1);
    }
    const waterFlow = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 150),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        depthWrite: false,
        map: waterFlowTexture,
        opacity: .72,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    waterFlow.name = "level-two-water-flow";
    waterFlow.position.set(0, -4.42, -55);
    waterFlow.rotation.x = -Math.PI / 2;
    root.add(waterFlow);

    for (let index = 0; index < ROUTE_STOPS + 1; index += 1) {
      const group = new THREE.Group();
      group.name = `level-two-stop-${index}`;
      group.position.set(DEFAULT_ROUTE_X[index] ?? 0, index * .12, -index * STEP_DISTANCE);
      const top = new THREE.Mesh(stopProbeGeometry, stopProbeMaterial);
      top.name = `level-two-stop-top-${index}`;
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x87d38b, depthTest: false, transparent: true, opacity: .94 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.name = `level-two-debug-marker-${index}`;
      marker.position.y = .42;
      marker.rotation.x = Math.PI / 2;
      marker.renderOrder = 100;
      marker.visible = false;
      group.add(top, marker);
      if (index > 0 && index % 2 === 0) {
        const waterfall = makeSceneryPlane("waterfall_ribbon", "waterfall", routeWidthAt(index) * .42, -2.7, .1, 1.48, 40 + index);
        waterfall.rotation.set(0, 0, 0);
        group.add(waterfall);
      }
      if (index === ROUTE_STOPS) {
        const castle = makeSceneryPlane("castle_final_island", "castle", 0, 3.8, .4, 10.2, 90);
        castle.name = "level-two-castle";
        castle.rotation.set(0, 0, 0);
        group.add(castle);
      }
      root.add(group);
    }

    for (let index = 0; index < ROUTE_STOPS; index += 1) {
      const routeSegment = new THREE.Group();
      routeSegment.name = `level-two-route-segment-${index}`;
      const top = new THREE.Mesh(new THREE.BufferGeometry(), topMaterial);
      top.name = `level-two-route-top-${index}`;
      const cliff = new THREE.Mesh(new THREE.BufferGeometry(), cliffMaterial);
      cliff.name = `level-two-route-cliff-${index}`;
      const road = new THREE.Mesh(new THREE.BufferGeometry(), roadMaterial);
      road.name = `level-two-route-road-${index}`;
      road.renderOrder = 4;
      routeSegment.add(top, cliff, road);
      setRouteSegmentBetween(
        routeSegment,
        new THREE.Vector3(DEFAULT_ROUTE_X[index] ?? 0, index * .12, -index * STEP_DISTANCE),
        new THREE.Vector3(DEFAULT_ROUTE_X[index + 1] ?? 0, (index + 1) * .12, -(index + 1) * STEP_DISTANCE),
        index,
      );
      root.add(routeSegment);
    }

    const optionGroup = new THREE.Group();
    optionGroup.name = "level-two-route-options";
    optionGroup.visible = false;
    root.add(optionGroup);

    const cloudIds = ["sprite_008", "sprite_009", "sprite_010", "sprite_011", "sprite_012", "sprite_013", "sprite_014", "sprite_025"];
    cloudIds.forEach((id, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      root.add(makeSceneryPlane(id, "cloud", side * (7 + (index % 3) * 3.4), 6.5 + (index % 4) * 2, -13 - index * 9, 7 + (index % 3) * 2, index * .83));
    });
    ["sprite_030", "sprite_033", "sprite_030", "sprite_033"].forEach((id, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      root.add(makeSceneryPlane(id, "island", side * (8.5 + (index % 2) * 2), 1.5 + index * .65, -23 - index * 18, 7.8 + index * .8, index * 1.7));
    });
    return root;
  };

  const primaryRoot = buildCanonicalWorld();
  const mirrorRoot = cloneWorldWithIndependentMaterials(primaryRoot);
  mirrorRoot.name = "level-two-parallel-world";
  // The parallel copy is pre-mirrored. The camera orbit rotates the primary
  // out, then resolves this incoming copy upright at the end of the turn.
  mirrorRoot.rotation.z = Math.PI;
  mirrorRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const colored = material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      if (colored.color) colored.color.offsetHSL(.38, .08, -.08);
    });
  });
  splitWorldRoot.add(primaryRoot, mirrorRoot);
  const primary = hydrateWorld(primaryRoot);
  const mirror = hydrateWorld(mirrorRoot);
  const worlds = [primary, mirror] as const;
  worlds.forEach((world) => prepareMaterials(world.materials));
  setMaterialOpacity(primary.materials, 1);
  setMaterialOpacity(mirror.materials, 0);

  const routePositions = Array.from(
    { length: ROUTE_STOPS + 1 },
    (_, index) => new THREE.Vector3(DEFAULT_ROUTE_X[index] ?? 0, index * .12, -index * STEP_DISTANCE),
  );
  const frustum = new THREE.Frustum();
  const projectionView = new THREE.Matrix4();
  const worldPosition = new THREE.Vector3();
  const cameraSpace = new THREE.Vector3();
  let step = 0;
  let chapter = 1;
  let universe: 0 | 1 = 0;
  let reducedMotion = false;
  let debugMarkers = false;
  let disposed = false;
  let animationFrame = 0;
  let activeTravel: ActiveTravel | undefined;
  let activeRotation: ActiveRotation | undefined;
  let previousFrameMs = performance.now();
  let smoothFrameMs = 16.7;
  let lastDiagnosticsMs = 0;
  let cameraPush = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  const onPointerMove = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointerTargetX = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
    pointerTargetY = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
  };
  const onPointerLeave = () => {
    pointerTargetX = 0;
    pointerTargetY = 0;
  };
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });

  const layoutReferenceLayers = (force = false) => {
    if (!force && Math.abs(referenceLayoutAspect - lab.camera.aspect) < .0001) return;
    referenceLayoutAspect = lab.camera.aspect;
    const cover = referenceCoverSize();
    referenceCoverWidth = cover.width;
    referenceCoverHeight = cover.height;
    worlds.forEach((world) => {
      world.root.traverse((object) => layoutReferenceObject(object));
    });
  };

  const syncRouteGeometry = () => {
    worlds.forEach((world) => {
      world.stops.forEach((stop, index) => stop.group.position.copy(routePositions[index]!));
      world.routeSegments.forEach((segment, index) => setRouteSegmentBetween(segment, routePositions[index]!, routePositions[index + 1]!, index));
    });
  };

  const updateOptions = () => {
    worlds.forEach((world) => { world.optionGroup.visible = false; });
  };

  const retirePassedStops = () => {
    worlds.forEach((world) => {
      world.stops.forEach((stop, index) => {
        stop.group.visible = index >= step;
      });
      world.routeSegments.forEach((segment, index) => {
        segment.visible = index >= step;
      });
    });
  };

  const resetWorldPositions = () => {
    routePositions.forEach((position, index) => position.set(DEFAULT_ROUTE_X[index] ?? 0, index * .12, -index * STEP_DISTANCE));
    worlds.forEach((world) => {
      world.root.position.set(0, 0, 0);
      world.stops.forEach((stop) => { stop.group.visible = true; });
      world.routeSegments.forEach((segment) => { segment.visible = true; });
    });
    cameraPush = 0;
    lab.camera.position.copy(initialCameraPosition);
    syncRouteGeometry();
    updateOptions();
  };

  const setTravelTransform = (primaryX: number, push: number) => {
    primary.root.position.x = primaryX;
    primary.root.position.z = 0;
    // The mirror root is rotated 180 degrees, so its travel offset must be
    // mirrored as well for its route to align with the primary after the turn.
    mirror.root.position.x = -primaryX;
    mirror.root.position.z = 0;
    cameraPush = push;
    lab.camera.position.copy(initialCameraPosition).addScaledVector(referenceForward, push);
  };

  const updateSceneAnimation = (nowMs: number) => {
    const waterFlowTexture = textures.get("water_surface_flow");
    if (waterFlowTexture) {
      waterFlowTexture.offset.x = (nowMs * .000012) % 1;
      waterFlowTexture.offset.y = (nowMs * .000006) % 1;
    }
    worlds.forEach((world) => {
      world.root.traverse((object) => {
        const kind = String(object.userData.levelTwoKind ?? "");
        const phase = Number(object.userData.levelTwoPhase ?? 0);
        if (kind === "cloud") {
          const baseX = Number(object.userData.levelTwoBaseX ?? object.position.x);
          const drift = Number(object.userData.levelTwoDrift ?? 1);
          object.position.x = baseX + Math.sin(nowMs * .00018 + phase) * drift;
          return;
        }
        if (kind === "animated-cloud") {
          object.userData.levelTwoAnimationX = Math.sin(nowMs * .000055 + phase) * .42;
          object.userData.levelTwoAnimationY = Math.sin(nowMs * .00009 + phase * 1.7) * .045;
          return;
        }
        if (kind === "animated-waterfall") {
          const pulse = Math.sin(nowMs * .0042 + phase);
          object.userData.levelTwoAnimationY = pulse * .022;
          object.scale.y = Number(object.userData.levelTwoBaseScaleY ?? object.scale.y) * (1 + pulse * .018);
          return;
        }
        if (object.userData.levelTwoFlagBlade) {
          const wave = Math.sin(nowMs * .007 + phase);
          object.scale.x = 1 + wave * .13;
          object.scale.y = 1 - Math.abs(wave) * .035;
          object.rotation.z = wave * .045;
        }
      });
    });
  };

  const updateReferenceParallax = (deltaMs: number) => {
    const damping = 1 - Math.exp(-deltaMs / 120);
    pointerX += (pointerTargetX - pointerX) * damping;
    pointerY += (pointerTargetY - pointerY) * damping;
    worlds.forEach((world) => {
      world.root.traverse((object) => {
        if (!object.userData.levelTwoReferenceLayer) return;
        const factor = Number(object.userData.levelTwoParallax ?? 0);
        const baseX = Number(object.userData.levelTwoBaseX ?? object.position.x);
        const baseY = Number(object.userData.levelTwoBaseY ?? object.position.y);
        const baseZ = Number(object.userData.levelTwoBaseZ ?? object.position.z);
        const horizontal = -pointerX * .62 * factor;
        const vertical = pointerY * .34 * factor;
        const animationX = Number(object.userData.levelTwoAnimationX ?? 0);
        const animationY = Number(object.userData.levelTwoAnimationY ?? 0);
        object.position.set(
          baseX + referenceRight.x * (horizontal + animationX) + referenceUp.x * (vertical + animationY),
          baseY + referenceRight.y * (horizontal + animationX) + referenceUp.y * (vertical + animationY),
          baseZ + referenceRight.z * (horizontal + animationX) + referenceUp.z * (vertical + animationY),
        );
      });
    });
  };

  const updateDiagnostics = (nowMs: number) => {
    if (nowMs - lastDiagnosticsMs < 250) return;
    lastDiagnosticsMs = nowMs;
    lab.camera.updateMatrixWorld();
    const activeWorld = worlds[universe];
    activeWorld.root.updateMatrixWorld(true);
    projectionView.multiplyMatrices(lab.camera.projectionMatrix, lab.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionView);
    const stops = activeWorld.stops.map((stop, index): VisibilityDiagnostic => {
      stop.representative.getWorldPosition(worldPosition);
      cameraSpace.copy(worldPosition).applyMatrix4(lab.camera.matrixWorldInverse);
      const inFrustum = frustum.intersectsObject(stop.representative);
      const behind = cameraSpace.z >= 0;
      const visible = stop.group.visible;
      const state: VisibilityDiagnostic["state"] = index === step
        ? "active"
        : !visible
          ? "retired"
          : behind
            ? "behind"
            : inFrustum
              ? "ahead"
              : "culled";
      stop.marker.visible = debugMarkers;
      stop.marker.material.color.set(state === "active" ? 0xffdb72 : state === "ahead" ? 0x7be294 : state === "retired" ? 0x777777 : 0xe68178);
      return {
        id: index === ROUTE_STOPS ? "castle" : `stop-${index + 1}`,
        index,
        cameraZ: cameraSpace.z,
        distance: worldPosition.distanceTo(lab.camera.getWorldPosition(new THREE.Vector3())),
        inFrustum,
        visible,
        state,
      };
    });
    callbacks.onDiagnostics({
      fps: 1000 / Math.max(.001, smoothFrameMs),
      frameMs: smoothFrameMs,
      calls: lab.renderer.info.render.calls,
      triangles: lab.renderer.info.render.triangles,
      textures: lab.renderer.info.memory.textures,
      geometries: lab.renderer.info.memory.geometries,
      stops,
    });
  };

  const finishTravel = () => {
    activeTravel = undefined;
    step += 1;
    retirePassedStops();
    updateOptions();
    callbacks.onStep(step);
    callbacks.onLock(false);
    callbacks.onStatus(step >= ROUTE_STOPS ? "Castle approach unlocked - previous stops retired" : `Arrived at stop ${step + 1} - previous stop retired`);
  };

  const updateTravel = (nowMs: number) => {
    const travel = activeTravel;
    if (!travel) return;
    const raw = clamp((nowMs - travel.startedAtMs) / travel.durationMs, 0, 1);
    const eased = reducedMotion ? raw : easeInOutCubic(raw);
    setTravelTransform(
      THREE.MathUtils.lerp(travel.startX, travel.targetX, eased),
      THREE.MathUtils.lerp(travel.startPush, travel.targetPush, eased),
    );
    if (raw >= 1) finishTravel();
  };

  const finishRotation = () => {
    const rotation = activeRotation!;
    universe = rotation.toParallel ? 1 : 0;
    activeRotation = undefined;
    cameraRig.rotation.z = universe * Math.PI;
    setMaterialOpacity(primary.materials, universe === 0 ? 1 : 0);
    setMaterialOpacity(mirror.materials, universe === 1 ? 1 : 0);
    callbacks.onUniverse(universe);
    callbacks.onLock(false);
    callbacks.onStatus(universe === 1 ? "Parallel world - mirrored scene upright" : "Primary world - scene upright");
  };

  const updateRotation = (nowMs: number) => {
    const rotation = activeRotation;
    if (!rotation) return;
    const raw = clamp((nowMs - rotation.startedAtMs) / rotation.durationMs, 0, 1);
    const eased = .5 - Math.cos(raw * Math.PI) * .5;
    const angle = reducedMotion ? rotation.targetAngle : THREE.MathUtils.lerp(rotation.sourceAngle, rotation.targetAngle, eased);
    cameraRig.rotation.z = angle;
    const split = smoothstep((eased * 180 - 62) / 56);
    setMaterialOpacity(primary.materials, rotation.toParallel ? 1 - split : split);
    setMaterialOpacity(mirror.materials, rotation.toParallel ? split : 1 - split);
    if (raw >= 1) finishRotation();
  };

  const render = (nowMs: number) => {
    if (disposed) return;
    const delta = Math.min(100, Math.max(.1, nowMs - previousFrameMs));
    previousFrameMs = nowMs;
    smoothFrameMs += (delta - smoothFrameMs) * .08;
    layoutReferenceLayers();
    updateTravel(nowMs);
    updateRotation(nowMs);
    updateSceneAnimation(nowMs);
    updateReferenceParallax(delta);
    lab.renderer.render(lab.scene, lab.camera);
    updateDiagnostics(nowMs);
    animationFrame = window.requestAnimationFrame(render);
  };

  syncRouteGeometry();
  updateOptions();
  animationFrame = window.requestAnimationFrame(render);

  return {
    get step() { return step; },
    get universe() { return universe; },
    travel: (direction) => {
      if (activeTravel || activeRotation || step >= ROUTE_STOPS) return false;
      const start = routePositions[step]!;
      const target = routePositions[step + 1]!;
      target.x = direction === 0
        ? target.x
        : clamp(start.x + direction * LATERAL_STEP, -MAX_ROUTE_X, MAX_ROUTE_X);
      const futureCount = routePositions.length - step - 2;
      for (let index = step + 2; index < routePositions.length; index += 1) {
        const progress = futureCount <= 0 ? 1 : (index - step - 1) / futureCount;
        const settle = smoothstep(progress);
        const bend = Math.sin(progress * Math.PI) * Math.sin((index + step) * 1.7) * .75;
        routePositions[index]!.x = THREE.MathUtils.lerp(target.x, 0, settle) + bend;
      }
      syncRouteGeometry();
      activeTravel = {
        direction,
        durationMs: reducedMotion ? 260 : 1280,
        startedAtMs: performance.now(),
        startX: primary.root.position.x,
        startPush: cameraPush,
        targetX: -target.x,
        targetPush: Math.min(
          referenceDistance - 8,
          LAYER_MANIFEST.travel.cameraPushStops[step + 1]
            ?? LAYER_MANIFEST.travel.cameraPushStops[LAYER_MANIFEST.travel.cameraPushStops.length - 1]
            ?? 0,
        ),
      };
      updateOptions();
      callbacks.onLock(true);
      callbacks.onStatus(`Traveling ${direction < 0 ? "left" : direction > 0 ? "right" : "straight"} into the layered scene - one WebGL render loop`);
      return true;
    },
    rotateUniverse: () => {
      if (activeTravel || activeRotation) return false;
      const toParallel = universe === 0;
      activeRotation = {
        durationMs: reducedMotion ? 280 : 2200,
        sourceAngle: universe * Math.PI,
        startedAtMs: performance.now(),
        targetAngle: toParallel ? Math.PI : 0,
        toParallel,
      };
      callbacks.onLock(true);
      callbacks.onStatus("Orbiting camera - primary exits as mirrored world fades in");
      return true;
    },
    enterCastle: () => {
      if (activeTravel || activeRotation || step < ROUTE_STOPS) return false;
      chapter += 1;
      step = 0;
      resetWorldPositions();
      callbacks.onChapter(chapter);
      callbacks.onStep(step);
      callbacks.onStatus(`Chapter ${chapter} generated - retained textures and geometries reused`);
      return true;
    },
    reset: () => {
      activeTravel = undefined;
      activeRotation = undefined;
      step = 0;
      chapter = 1;
      universe = 0;
      cameraRig.rotation.z = 0;
      setMaterialOpacity(primary.materials, 1);
      setMaterialOpacity(mirror.materials, 0);
      resetWorldPositions();
      callbacks.onChapter(chapter);
      callbacks.onStep(step);
      callbacks.onUniverse(universe);
      callbacks.onLock(false);
      callbacks.onStatus("06_03 layered view - 45-degree camera ready");
    },
    setDebugMarkers: (visible) => {
      debugMarkers = visible;
      worlds.forEach((world) => world.stops.forEach((stop) => { stop.marker.visible = visible; }));
    },
    setReducedMotion: (reduced) => { reducedMotion = reduced; },
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      textures.forEach((texture) => texture.dispose());
      cropFeatherTextures.forEach((texture) => texture.dispose());
      lab.dispose();
    },
  };
}
