import * as THREE from "three";
import "./lab.css";
import { createLabBridge, createLabPlatform } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";

const lab = createThreeLab(element<HTMLCanvasElement>("scene"), { fov: 42 });
addLabLighting(lab.scene);

/**
 * The camera moves; neither world is animated into place.
 *
 * scene
 * |- split-world-root
 * |  |- primary-world (0deg)
 * |  `- mirror-world  (exact clone, 180deg around Z)
 * `- camera-orbit-rig (0..+/-180deg around Z)
 *    `- camera
 */
const splitWorldRoot = new THREE.Group();
splitWorldRoot.name = "split-world-root";
lab.scene.add(splitWorldRoot);

const cameraRig = new THREE.Group();
cameraRig.name = "camera-orbit-rig";
lab.scene.add(cameraRig);
cameraRig.add(lab.camera);
lab.camera.position.set(0, 6.4, 18);
lab.camera.lookAt(0, -.2, -8);

const textureLoader = new THREE.TextureLoader();
const floaterSpecs = [
  { src: "/lab-assets/floaters/balloon-large-final.png", aspect: 221 / 362, position: [-8, 8, -22] as const, width: 4.8 },
  { src: "/lab-assets/floaters/airship-large-final.png", aspect: 376 / 355, position: [9, 6, -28] as const, width: 6 },
  { src: "/lab-assets/floaters/island-small-final.png", aspect: 223 / 289, position: [7.2, -.6, -19] as const, width: 3.8 },
] as const;

function createPhysicalArtPlane(src: string, width: number, aspect: number, name: string) {
  const texture = textureLoader.load(src, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.needsUpdate = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    alphaTest: .025,
    depthWrite: false,
    map: texture,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  material.userData.labBaseOpacity = 1;
  material.userData.labBaseDepthWrite = false;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), material);
  plane.name = name;
  plane.renderOrder = 18;
  return plane;
}

function buildCanonicalWorld() {
  const root = new THREE.Group();
  root.name = "primary-world";

  const first = createLabPlatform("mirror-rig:first", { radius: 4.4, seed: 51, details: true, baseArt: true });
  first.group.position.set(0, 0, 0);
  root.add(first.group);

  const bridge = createLabBridge(9, .9);
  bridge.position.set(0, .12, -3.4);
  root.add(bridge);

  const second = createLabPlatform("mirror-rig:second", { radius: 2.5, seed: 60, details: true, baseArt: true });
  second.group.position.set(0, 1.1, -13);
  root.add(second.group);

  const side = createLabPlatform("mirror-rig:side", { radius: 2.1, seed: 68, details: false, baseArt: true });
  side.group.position.set(-7.5, .8, -9.5);
  root.add(side.group);

  const atmosphere = new THREE.Group();
  atmosphere.name = "physical-atmosphere-planes";
  floaterSpecs.forEach(({ src, aspect, position, width }, index) => {
    const plane = createPhysicalArtPlane(src, width, aspect, `atmosphere-plane-${index + 1}`);
    plane.position.set(position[0], position[1], position[2]);
    atmosphere.add(plane);
  });
  root.add(atmosphere);
  return root;
}

function cloneWorldWithIndependentMaterials(source: THREE.Group) {
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
  });
  return clone;
}

const primaryWorld = buildCanonicalWorld();
const mirrorWorld = cloneWorldWithIndependentMaterials(primaryWorld);
mirrorWorld.name = "mirror-world-exact-clone";
mirrorWorld.rotation.z = Math.PI;
splitWorldRoot.add(primaryWorld, mirrorWorld);

function rememberMaterialState(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material.userData.labBaseOpacity === undefined) {
        material.userData.labBaseOpacity = material.opacity;
      }
      if (material.userData.labBaseDepthWrite === undefined) {
        material.userData.labBaseDepthWrite = material.depthWrite;
      }
    });
  });
}
rememberMaterialState(primaryWorld);
rememberMaterialState(mirrorWorld);

const angleInput = element<HTMLInputElement>("angle");
const angleOutput = element<HTMLOutputElement>("angle-output");
const rigAngleOutput = element<HTMLElement>("rig-angle");
const primaryAlphaOutput = element<HTMLElement>("primary-alpha");
const mirrorAlphaOutput = element<HTMLElement>("mirror-alpha");
const status = element<HTMLElement>("status");
const atmosphereToggle = element<HTMLInputElement>("include-atmosphere");
const primaryAtmosphere = primaryWorld.getObjectByName("physical-atmosphere-planes");
const mirrorAtmosphere = mirrorWorld.getObjectByName("physical-atmosphere-planes");

let direction: 1 | -1 = 1;
let playing = false;
let startedAt = 0;

function smoothstep(value: number) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function setWorldOpacity(root: THREE.Object3D, opacity: number) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const baseOpacity = Number(material.userData.labBaseOpacity ?? 1);
      const baseDepthWrite = Boolean(material.userData.labBaseDepthWrite ?? material.depthWrite);
      material.transparent = opacity < .999 || material.transparent;
      material.opacity = baseOpacity * opacity;
      material.depthWrite = baseDepthWrite && opacity > .98;
      material.needsUpdate = true;
    });
  });
}

function setAngle(degrees: number) {
  const radians = THREE.MathUtils.degToRad(degrees) * direction;
  cameraRig.rotation.z = radians;

  // Both complete worlds exist for the entire turn. Only their contribution is
  // crossfaded through the split; no world or artwork is positioned/revealed.
  const mirrorMix = smoothstep((degrees - 62) / 56);
  const primaryAlpha = 1 - mirrorMix;
  setWorldOpacity(primaryWorld, primaryAlpha);
  setWorldOpacity(mirrorWorld, mirrorMix);

  angleInput.value = String(degrees);
  angleOutput.value = `${Math.round(degrees)}°`;
  rigAngleOutput.textContent = `${Math.round(degrees) * direction}°`;
  primaryAlphaOutput.textContent = `${Math.round(primaryAlpha * 100)}%`;
  mirrorAlphaOutput.textContent = `${Math.round(mirrorMix * 100)}%`;

  const phase = degrees < 62
    ? "camera orbiting primary world"
    : degrees <= 118
      ? "crossing the mirror split"
      : "camera orbiting mirrored world";
  status.textContent = `${Math.round(degrees)}° · ${phase}`;
}

angleInput.addEventListener("input", () => {
  playing = false;
  setAngle(Number(angleInput.value));
});

atmosphereToggle.addEventListener("change", () => {
  if (primaryAtmosphere) primaryAtmosphere.visible = atmosphereToggle.checked;
  if (mirrorAtmosphere) mirrorAtmosphere.visible = atmosphereToggle.checked;
});

function play(nextDirection: 1 | -1) {
  direction = nextDirection;
  playing = true;
  startedAt = performance.now();
  setAngle(0);
}

element("play-left").addEventListener("click", () => play(-1));
element("play-right").addEventListener("click", () => play(1));
element("reset").addEventListener("click", () => {
  playing = false;
  direction = 1;
  setAngle(0);
});

let mirroredChildCount = 0;
mirrorWorld.traverse(() => { mirroredChildCount += 1; });
element("child-count").textContent = String(mirroredChildCount - 1);
setAngle(0);

function animate(now: number) {
  if (playing) {
    const progress = Math.min(1, (now - startedAt) / 3000);
    const eased = .5 - Math.cos(Math.PI * progress) * .5;
    setAngle(eased * 180);
    if (progress >= 1) playing = false;
  }
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
