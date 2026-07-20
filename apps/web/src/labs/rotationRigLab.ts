import * as THREE from "three";
import "./lab.css";
import { createLabBridge, createLabPlatform } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";

const lab = createThreeLab(element<HTMLCanvasElement>("scene"), { fov: 42 });
addLabLighting(lab.scene);
lab.camera.position.set(0, 6.4, 18);
lab.camera.lookAt(0, -.2, -8);
const turnRoot = new THREE.Group();
turnRoot.name = "turn-root-all-spatial-elements";
lab.scene.add(turnRoot);

function buildWorld(name: string, tint: number) {
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
  return root;
}

const outgoing = buildWorld("outgoing-world", 51);
const incoming = buildWorld("incoming-world", 305);
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

function setAngle(degrees: number) {
  const radians = THREE.MathUtils.degToRad(degrees) * direction;
  turnRoot.rotation.z = radians;
  outgoing.visible = degrees < 90;
  incoming.visible = degrees >= 90;
  angleInput.value = String(degrees);
  angleOutput.value = `${Math.round(degrees)}°`;
  worldAngle.textContent = `${Math.round(degrees) * direction}°`;
  revealState.textContent = degrees >= 90 ? "incoming" : "waiting";
  status.textContent = `${Math.round(degrees)}° · ${degrees >= 90 ? "incoming world" : "outgoing world"}`;
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
