import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SphereGeometry,
  type Material
} from "three";
import { FANTASY_PALETTE } from "../materials";
import { qualityProfile, type QualityTier } from "../postprocessing";
import { createMistMaterial, createSkyGradientMaterial, type AnimatedMistMaterial } from "../shaders";

export interface FantasyBackgroundOptions {
  readonly tier?: QualityTier;
  readonly seed?: number;
  readonly radius?: number;
  /** Disable the opaque sky dome when a DOM art backwall sits behind the canvas. */
  readonly skyDome?: boolean;
}

export interface FantasyBackground {
  readonly group: Group;
  readonly tier: QualityTier;
  update(elapsedSeconds: number, motionIntensity?: number): void;
  setOpacity(opacity: number): void;
  dispose(): void;
}

interface BalloonMotion {
  readonly object: Group;
  readonly baseX: number;
  readonly baseY: number;
  readonly baseRotation: number;
  readonly phase: number;
  readonly speed: number;
  readonly amplitude: number;
}

export function createFantasyBackground(options: FantasyBackgroundOptions = {}): FantasyBackground {
  const tier = options.tier ?? "high";
  const profile = qualityProfile(tier);
  const group = new Group();
  group.name = "fantasy-background";
  group.renderOrder = -100;
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const opacityByMaterial = new Map<Material, number>();
  const mistLayers: AnimatedMistMaterial[] = [];
  const balloons: BalloonMotion[] = [];
  let motePositions: BufferAttribute | undefined;
  let moteBasePositions: Float32Array | undefined;
  let motePhases: Float32Array | undefined;
  const random = seededRandom(options.seed ?? 90817);

  if (tier !== "off") {
    if (options.skyDome !== false) {
      const skyGeometry = ownGeometry(new SphereGeometry(options.radius ?? 72, tier === "high" ? 40 : 24, tier === "low" ? 12 : 20));
      const skyMaterial = ownMaterial(createSkyGradientMaterial({ tier }));
      const sky = new Mesh(skyGeometry, skyMaterial);
      sky.name = "atmospheric-sky-dome";
      sky.frustumCulled = false;
      group.add(sky);
    }

    addPanoramicHorizon();
    addDistantForms();
    addMistLayers();
    addBalloons();
    addMotes();
  }

  let disposed = false;
  return {
    group,
    tier,
    update: (elapsedSeconds, motionIntensity = 1) => {
      if (disposed || tier === "off") return;
      const intensity = Math.max(0, motionIntensity);
      for (const layer of mistLayers) layer.update(elapsedSeconds * intensity);
      for (const balloon of balloons) {
        const wave = Math.sin(elapsedSeconds * balloon.speed + balloon.phase);
        const crossWave = Math.cos(elapsedSeconds * balloon.speed * 0.43 + balloon.phase);
        balloon.object.position.x = balloon.baseX + crossWave * balloon.amplitude * 0.18 * intensity;
        balloon.object.position.y = balloon.baseY + wave * balloon.amplitude * intensity;
        balloon.object.rotation.z = balloon.baseRotation + wave * 0.035 * intensity;
      }
      if (motePositions && moteBasePositions && motePhases) {
        for (let index = 0; index < motePhases.length; index += 1) {
          const offset = index * 3;
          const phase = motePhases[index]!;
          motePositions.setX(index, moteBasePositions[offset]! + Math.sin(elapsedSeconds * 0.12 + phase) * 0.28 * intensity);
          motePositions.setY(index, moteBasePositions[offset + 1]! + Math.sin(elapsedSeconds * 0.2 + phase) * 0.18 * intensity);
        }
        motePositions.needsUpdate = true;
      }
    },
    setOpacity: (opacity) => {
      const clamped = Math.max(0, Math.min(1, opacity));
      group.visible = clamped > 0;
      for (const material of materials) {
        if (material.name === "fantasy-sky-gradient") {
          const skyMaterial = material as ReturnType<typeof createSkyGradientMaterial>;
          skyMaterial.uniforms.uOpacity!.value = clamped;
          skyMaterial.transparent = clamped < 1;
          continue;
        }
        if (material.name === "fantasy-atmospheric-mist") continue;
        if ("opacity" in material) material.opacity = (opacityByMaterial.get(material) ?? 1) * clamped;
      }
      for (const layer of mistLayers) {
        const baseOpacity = opacityByMaterial.get(layer.material) ?? 1;
        layer.setOpacity(baseOpacity * clamped);
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      geometries.clear();
      materials.clear();
      opacityByMaterial.clear();
    }
  };

  function ownGeometry<T extends BufferGeometry>(geometry: T): T {
    geometries.add(geometry);
    return geometry;
  }

  function ownMaterial<T extends Material>(material: T): T {
    materials.add(material);
    const opacity = "opacity" in material ? material.opacity : 1;
    opacityByMaterial.set(material, opacity);
    return material;
  }

  function addDistantForms(): void {
    const silhouetteMaterial = ownMaterial(new MeshBasicMaterial({
      name: "fantasy-distant-silhouettes",
      color: FANTASY_PALETTE.stoneShadow,
      transparent: true,
      opacity: tier === "low" ? 0.09 : 0.13,
      depthWrite: false,
      fog: true
    }));
    const spireGeometry = ownGeometry(new ConeGeometry(1, 3, 5));
    const islandGeometry = ownGeometry(new IcosahedronGeometry(1, 1));
    const count = profile.atmosphereLayers * 4;
    const islandTransforms: Object3D[] = [];
    const spireTransforms: Object3D[] = [];
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (12 + random() * 24);
      const y = -4 + random() * 7;
      const z = -22 - random() * 34;
      const island = new Object3D();
      island.position.set(x, y, z);
      island.scale.set(1.8 + random() * 3.4, 0.55 + random() * 0.55, 1.1 + random() * 1.8);
      island.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.16);
      island.updateMatrix();
      islandTransforms.push(island);
      if (tier !== "low" && random() > 0.35) {
        const spire = new Object3D();
        spire.position.set(x, y + 1.1, z);
        spire.scale.set(0.42 + random() * 0.5, 0.7 + random() * 1.3, 0.42 + random() * 0.5);
        spire.rotation.y = random() * Math.PI;
        spire.updateMatrix();
        spireTransforms.push(spire);
      }
    }
    const islands = new InstancedMesh(islandGeometry, silhouetteMaterial, islandTransforms.length);
    islands.name = "distant-floating-islands";
    islandTransforms.forEach((transform, index) => islands.setMatrixAt(index, transform.matrix));
    islands.instanceMatrix.needsUpdate = true;
    group.add(islands);
    if (spireTransforms.length > 0) {
      const spires = new InstancedMesh(spireGeometry, silhouetteMaterial, spireTransforms.length);
      spires.name = "distant-floating-spires";
      spireTransforms.forEach((transform, index) => spires.setMatrixAt(index, transform.matrix));
      spires.instanceMatrix.needsUpdate = true;
      group.add(spires);
    }
  }

  function addPanoramicHorizon(): void {
    const mountainGeometry = ownGeometry(new ConeGeometry(1, 1, 5));
    const foothillGeometry = ownGeometry(new IcosahedronGeometry(1, 1));
    const mountainMaterials = [
      ownMaterial(new MeshBasicMaterial({
        name: "fantasy-far-mountains",
        color: 0x758ca8,
        transparent: true,
        opacity: tier === "low" ? 0.1 : 0.15,
        depthWrite: false,
        fog: true
      })),
      ownMaterial(new MeshBasicMaterial({
        name: "fantasy-near-mountains",
        color: 0x607b8a,
        transparent: true,
        opacity: tier === "low" ? 0.11 : 0.17,
        depthWrite: false,
        fog: true
      }))
    ];

    for (let layer = 0; layer < 2; layer += 1) {
      const count = tier === "low" ? 11 : 19;
      const mountains = new InstancedMesh(mountainGeometry, mountainMaterials[layer]!, count);
      mountains.name = `panoramic-mountain-range:${layer}`;
      const transform = new Object3D();
      for (let index = 0; index < count; index += 1) {
        const normalized = index / (count - 1);
        const x = -41 + normalized * 82 + (random() - .5) * 2.8;
        const height = 2.2 + random() * 5.4 + Math.abs(x) * .035;
        transform.position.set(x, -1.4 + height * .36 + layer * .35, -49 + layer * 8 + random() * 3);
        transform.scale.set(2.4 + random() * 3.4, height, 2 + random() * 2.6);
        transform.rotation.set(0, random() * Math.PI, (random() - .5) * .08);
        transform.updateMatrix();
        mountains.setMatrixAt(index, transform.matrix);
      }
      mountains.instanceMatrix.needsUpdate = true;
      group.add(mountains);
    }

    const foothillCount = tier === "low" ? 10 : 18;
    const foothills = new InstancedMesh(foothillGeometry, mountainMaterials[1]!, foothillCount);
    foothills.name = "panoramic-foothills";
    const foothill = new Object3D();
    for (let index = 0; index < foothillCount; index += 1) {
      const x = -36 + index / Math.max(1, foothillCount - 1) * 72;
      foothill.position.set(x, -.5 + random() * 1.5, -34 - random() * 8);
      foothill.scale.set(2.7 + random() * 3.8, .55 + random() * 1.2, 1.8 + random() * 2.2);
      foothill.rotation.set(random() * .18, random() * Math.PI, random() * .12);
      foothill.updateMatrix();
      foothills.setMatrixAt(index, foothill.matrix);
    }
    foothills.instanceMatrix.needsUpdate = true;
    group.add(foothills);

    const sunMaterial = ownMaterial(new MeshBasicMaterial({
      name: "fantasy-sun-disc",
      color: 0xffe4a1,
      transparent: true,
      opacity: .88,
      depthWrite: false,
      fog: false
    }));
    const sun = new Mesh(ownGeometry(new SphereGeometry(.72, 20, 14)), sunMaterial);
    sun.name = "horizon-sun";
    sun.position.set(0, 8.5, -56);
    group.add(sun);

    if (tier !== "low") {
      const cloudMaterial = ownMaterial(new MeshBasicMaterial({
        name: "fantasy-cloud-clusters",
        color: 0xfff2dc,
        transparent: true,
        opacity: .17,
        depthWrite: false,
        fog: true
      }));
      const cloudGeometry = ownGeometry(new IcosahedronGeometry(1, 1));
      const cloudCount = tier === "high" ? 22 : 14;
      const clouds = new InstancedMesh(cloudGeometry, cloudMaterial, cloudCount);
      clouds.name = "panoramic-cloud-clusters";
      const cloud = new Object3D();
      for (let index = 0; index < cloudCount; index += 1) {
        const side = index % 2 === 0 ? -1 : 1;
        cloud.position.set(side * (4 + random() * 32), 6 + random() * 10, -39 - random() * 16);
        const size = 1.1 + random() * 2.8;
        cloud.scale.set(size * (1.6 + random()), size * .48, size);
        cloud.rotation.set(random() * .15, random() * Math.PI, random() * .12);
        cloud.updateMatrix();
        clouds.setMatrixAt(index, cloud.matrix);
      }
      clouds.instanceMatrix.needsUpdate = true;
      group.add(clouds);
    }
  }

  function addMistLayers(): void {
    if (profile.atmosphereLayers === 0) return;
    const planeGeometry = ownGeometry(new PlaneGeometry(54, 15, 1, 1));
    for (let index = 0; index < profile.atmosphereLayers; index += 1) {
      const baseOpacity = 0.075 + index * 0.025;
      const layer = createMistMaterial({
        tier,
        color: index % 2 === 0 ? FANTASY_PALETTE.mist : FANTASY_PALETTE.lavender,
        opacity: baseOpacity
      });
      ownMaterial(layer.material);
      opacityByMaterial.set(layer.material, baseOpacity);
      mistLayers.push(layer);
      const mist = new Mesh(planeGeometry, layer.material);
      mist.name = "atmospheric-mist-layer";
      mist.position.set((index - 1) * 5, -1 + index * 3.4, -16 - index * 12);
      mist.scale.setScalar(1 + index * 0.38);
      mist.renderOrder = -20 + index;
      group.add(mist);
    }
  }

  function addBalloons(): void {
    if (profile.balloonCount === 0) return;
    const balloonGeometry = ownGeometry(new SphereGeometry(0.52, tier === "high" ? 16 : 10, tier === "high" ? 12 : 8));
    const basketGeometry = ownGeometry(new BoxGeometry(0.24, 0.18, 0.22));
    const balloonColors = [FANTASY_PALETTE.mint, FANTASY_PALETTE.peach, FANTASY_PALETTE.lavender];
    const balloonMaterials = balloonColors.map((color, index) => ownMaterial(new MeshStandardMaterial({
      name: `fantasy-balloon-${index}`,
      color,
      roughness: 0.72,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })));
    const basketMaterial = ownMaterial(new MeshBasicMaterial({
      name: "fantasy-balloon-baskets",
      color: FANTASY_PALETTE.ink,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    }));
    for (let index = 0; index < profile.balloonCount; index += 1) {
      const balloon = new Group();
      balloon.name = "floating-balloon";
      const envelope = new Mesh(balloonGeometry, balloonMaterials[index % balloonMaterials.length]!);
      envelope.scale.set(0.78 + random() * 0.65, 1.2 + random() * 0.55, 0.78 + random() * 0.65);
      envelope.rotation.y = random() * Math.PI;
      balloon.add(envelope);
      const basket = new Mesh(basketGeometry, basketMaterial);
      basket.position.y = -1.02;
      balloon.add(basket);
      const side = index % 2 === 0 ? -1 : 1;
      const baseX = side * (7 + random() * 24);
      const baseY = 4 + random() * 14;
      const baseRotation = (random() - 0.5) * 0.12;
      balloon.position.set(baseX, baseY, -7 - random() * 38);
      balloon.rotation.z = baseRotation;
      const distanceScale = 0.48 + ((balloon.position.z + 45) / 38) * 0.4;
      balloon.scale.setScalar(Math.max(0.35, distanceScale));
      group.add(balloon);
      balloons.push({
        object: balloon,
        baseX,
        baseY,
        baseRotation,
        phase: random() * Math.PI * 2,
        speed: 0.18 + random() * 0.18,
        amplitude: 0.22 + random() * 0.38
      });
    }
  }

  function addMotes(): void {
    if (profile.particleCount === 0) return;
    const geometry = ownGeometry(new BufferGeometry());
    moteBasePositions = new Float32Array(profile.particleCount * 3);
    motePhases = new Float32Array(profile.particleCount);
    const colors = new Float32Array(profile.particleCount * 3);
    const palette = [FANTASY_PALETTE.parchmentLight, FANTASY_PALETTE.mint, FANTASY_PALETTE.lavender];
    for (let index = 0; index < profile.particleCount; index += 1) {
      const offset = index * 3;
      moteBasePositions[offset] = (random() - 0.5) * 44;
      moteBasePositions[offset + 1] = -2 + random() * 19;
      moteBasePositions[offset + 2] = -5 - random() * 42;
      motePhases[index] = random() * Math.PI * 2;
      const color = palette[index % palette.length]!;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }
    motePositions = new BufferAttribute(moteBasePositions.slice(), 3);
    geometry.setAttribute("position", motePositions);
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    const material = ownMaterial(new PointsMaterial({
      name: "fantasy-atmospheric-motes",
      size: tier === "high" ? 0.09 : 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      sizeAttenuation: true,
      fog: true
    }));
    const points = new Points(geometry, material);
    points.name = "atmospheric-motes";
    group.add(points);
  }
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
