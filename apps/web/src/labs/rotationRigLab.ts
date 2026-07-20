import * as THREE from "three";
import "./lab.css";
import { createLabBridge, createLabPlatform } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";
import { createPlatformArtStack, setArtStackOpacity } from "../world/assets/platformDetailCards";

const lab = createThreeLab(element<HTMLCanvasElement>("scene"), { fov: 42 });
addLabLighting(lab.scene);
lab.camera.position.set(0, 6.4, 18);
lab.camera.lookAt(0, -.2, -8);
const turnRoot = new THREE.Group();
turnRoot.name = "turn-root-all-spatial-elements";
lab.scene.add(turnRoot);

function buildWorld(name: string, tint: number, withIncomingArt = false) {
  const root = new THREE.Group();
  root.name = name;
  const first = createLabPlatform(`${name}:first`, { radius: 4.4, seed: tint, details: true });
  first.group.position.set(0, 0, 0);
  root.add(first.group);
  const bridge = createLabBridge(9, .9);
  bridge.position.set(0, .12, -3.4);
  root.add(bridge);
  const second = createLabPlatform(`${name}:second`, { radius: 2.5, seed: tint + 9, details: true });
  second.group.position.set(0, 1.1, -13);
  root.add(second.group);
  const side = createLabPlatform(`${name}:side`, { radius: 2.1, seed: tint + 17, details: false });
  side.group.position.set(-7.5, .8, -9.5);
  root.add(side.group);
  const revealArt = new THREE.Group();
  revealArt.name = `${name}:reveal-only-art`;
  if (withIncomingArt) {
    const firstArt = createPlatformArtStack({ radius: 4.4, surfaceY: first.build.surfaceY, variant: "garden", detailSpread: 1.1 });
    first.group.add(firstArt);
    const secondArt = createPlatformArtStack({ radius: 2.5, surfaceY: second.build.surfaceY, variant: "waterfall", detailSpread: .72 });
    second.group.add(secondArt);
    const revealIsland = createLabPlatform(`${name}:reveal-island`, { radius: 1.65, seed: tint + 41, details: false });
    revealIsland.group.position.set(7.2, 1.25, -10.5);
    revealIsland.group.add(createPlatformArtStack({ radius: 1.65, surfaceY: revealIsland.build.surfaceY, variant: "castle", includeDetails: false }));
    revealArt.add(revealIsland.group);
    root.add(revealArt);
  }
  return { root, revealArt };
}

const outgoingBuild = buildWorld("outgoing-world", 51);
const incomingBuild = buildWorld("incoming-world", 305, true);
const outgoing = outgoingBuild.root;
const incoming = incomingBuild.root;
const incomingRevealArt = incomingBuild.revealArt;
incoming.rotation.z = -Math.PI;
turnRoot.add(outgoing, incoming);

const loader = new THREE.TextureLoader();
const spriteSpecs = [
  ["/lab-assets/floaters/balloon-large-final.png", -8, 8, -22, 4.8],
  ["/lab-assets/floaters/airship-large-final.png", 9, 6, -28, 6],
] as const;
function createAtmosphere(name: string) {
  const atmosphere = new THREE.Group();
  atmosphere.name = name;
  spriteSpecs.forEach(([src,x,y,z,scale]) => {
    const material = new THREE.SpriteMaterial({ map: loader.load(src), transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x,y,z); sprite.scale.set(scale,scale,1); atmosphere.add(sprite);
  });
  return atmosphere;
}
const outgoingAtmosphere = createAtmosphere("outgoing-world-atmosphere");
const incomingAtmosphere = createAtmosphere("incoming-world-atmosphere");
outgoing.add(outgoingAtmosphere);
incoming.add(incomingAtmosphere);

const angleInput = element<HTMLInputElement>("angle");
const angleOutput = element<HTMLOutputElement>("angle-output");
const worldAngle = element<HTMLElement>("world-angle");
const revealState = element<HTMLElement>("reveal-state");
const status = element<HTMLElement>("status");
const atmosphereToggle = element<HTMLInputElement>("include-atmosphere");
let direction: 1 | -1 = 1;
let playing = false;
let startedAt = 0;

function smoothstep(value: number) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function setWorldOpacity(root: THREE.Object3D, opacity: number) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material.userData.labBaseOpacity === undefined) material.userData.labBaseOpacity = material.opacity;
      material.transparent = true;
      material.opacity = Number(material.userData.labBaseOpacity) * opacity;
      material.depthWrite = opacity > .96 && !(material instanceof THREE.SpriteMaterial);
      material.needsUpdate = true;
    });
  });
  root.visible = opacity > .002;
}

function setAngle(degrees: number) {
  const radians = THREE.MathUtils.degToRad(degrees) * direction;
  turnRoot.rotation.z = radians;
  const outgoingAlpha = 1 - smoothstep((degrees - 34) / 78);
  const incomingAlpha = smoothstep((degrees - 72) / 78);
  setWorldOpacity(outgoing, outgoingAlpha);
  setWorldOpacity(incoming, incomingAlpha);
  incoming.rotation.set(0, -direction * (1 - incomingAlpha) * .52, -Math.PI * direction);
  const revealScale = .74 + incomingAlpha * .26;
  incoming.scale.setScalar(revealScale);
  incoming.position.y = -(1 - incomingAlpha) * 1.25;
  incomingRevealArt.rotation.y = direction * (1 - incomingAlpha) * .34;
  incomingRevealArt.position.z = (1 - incomingAlpha) * -2.2;
  setArtStackOpacity(incomingRevealArt, incomingAlpha);
  angleInput.value = String(degrees);
  angleOutput.value = `${Math.round(degrees)}°`;
  worldAngle.textContent = `${Math.round(degrees) * direction}°`;
  revealState.textContent = `${Math.round(incomingAlpha * 100)}%`;
  status.textContent = `${Math.round(degrees)}° · ${incomingAlpha > 0 ? "incoming art rotating in" : "outgoing world"}`;
}

angleInput.addEventListener("input", () => { playing = false; setAngle(Number(angleInput.value)); });
atmosphereToggle.addEventListener("change", () => {
  if (atmosphereToggle.checked) {
    outgoing.add(outgoingAtmosphere);
    incoming.add(incomingAtmosphere);
    incomingAtmosphere.visible = true;
  } else {
    lab.scene.add(outgoingAtmosphere);
    incomingAtmosphere.visible = false;
  }
});
element("play-left").addEventListener("click", () => { direction = -1; playing = true; startedAt = performance.now(); });
element("play-right").addEventListener("click", () => { direction = 1; playing = true; startedAt = performance.now(); });
element("reset").addEventListener("click", () => { playing = false; direction = 1; setAngle(0); });
let spatialChildCount = 0;
turnRoot.traverse(() => { spatialChildCount += 1; });
element("child-count").textContent = String(spatialChildCount - 1);
setAngle(0);

function animate(now: number) {
  if (playing) {
    const progress = Math.min(1, (now - startedAt) / 3000);
    const eased = -(Math.cos(Math.PI * progress) - 1) / 2;
    setAngle(eased * 180);
    if (progress >= 1) playing = false;
  }
  [outgoingAtmosphere, incomingAtmosphere].forEach((atmosphere) => {
    atmosphere.children.forEach((object, index) => { object.position.y += Math.sin(now * .001 + index) * .0008; });
  });
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
