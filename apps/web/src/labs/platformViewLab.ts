import * as THREE from "three";
import "./lab.css";
import { sampleIslandTransition } from "../world/animation/island-transition";
import { createLabBridge, createLabPlatform } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";

const canvas = element<HTMLCanvasElement>("scene");
const lab = createThreeLab(canvas, { fov: 48 });
addLabLighting(lab.scene);
lab.scene.fog = new THREE.FogExp2(0xa6bdce, .018);
const navigationRoot = new THREE.Group();
lab.scene.add(navigationRoot);
const active = createLabPlatform("active-ground", { radius: 6.1, seed: 111, details: true });
navigationRoot.add(active.group);
const bridge = createLabBridge(9.5, .95);
bridge.position.set(0, .15, -4.7);
navigationRoot.add(bridge);
const next = createLabPlatform("next-ground", { radius: 5.7, seed: 309, details: true });
next.group.position.set(0, .65, -15.2);
navigationRoot.add(next.group);

const stance = element<HTMLSelectElement>("stance");
const height = element<HTMLInputElement>("height");
const fov = element<HTMLInputElement>("fov");
const heightOutput = element<HTMLOutputElement>("height-output");
const fovOutput = element<HTMLOutputElement>("fov-output");
const heightReadout = element<HTMLElement>("height-readout");
const viewReadout = element<HTMLElement>("view-readout");
const inside = element<HTMLElement>("inside");
const status = element<HTMLElement>("status");
let traveling = false;
let startedAt = 0;
let startOffset = 0;

function applyCamera() {
  const eyeHeight = Number(height.value);
  const zByStance = { edge: 5.55, on: 3.15, center: .7 } as const;
  lab.camera.position.set(0, eyeHeight, zByStance[stance.value as keyof typeof zByStance] ?? 5.55);
  lab.camera.fov = Number(fov.value);
  lab.camera.lookAt(0, .42, -10);
  lab.camera.updateProjectionMatrix();
  heightOutput.value = `${eyeHeight.toFixed(2)}m`;
  heightReadout.textContent = `${eyeHeight.toFixed(2)}m`;
  fovOutput.value = `${fov.value}°`;
  viewReadout.textContent = stance.value;
  const nearestCenterZ = Math.round(navigationRoot.position.z / 15.2) * -15.2 + navigationRoot.position.z;
  inside.textContent = Math.abs(lab.camera.position.z - nearestCenterZ) < 6.1 ? "yes" : "no";
  status.textContent = stance.options[stance.selectedIndex]?.text ?? "On platform";
}
stance.addEventListener("change", applyCamera);
height.addEventListener("input", applyCamera);
fov.addEventListener("input", applyCamera);
element("advance").addEventListener("click", () => {
  if (traveling) return; traveling = true; startedAt = performance.now(); startOffset = navigationRoot.position.z; status.textContent = "Advancing under locked camera";
});
element("reset").addEventListener("click", () => { traveling = false; navigationRoot.position.z = 0; stance.value = "edge"; height.value = "2.55"; fov.value = "48"; canvas.style.filter = ""; applyCamera(); });
applyCamera();

function animate(now: number) {
  if (traveling) {
    const snapshot = sampleIslandTransition(now - startedAt, {
      travelDistance: 15.2,
      durations: { accelerationMs: 180, cruiseMs: 350, decelerationMs: 250, settlingMs: 80 },
      maxBlurPx: .8,
    });
    navigationRoot.position.z = startOffset + snapshot.worldOffsetProgress * 15.2;
    canvas.style.filter = `blur(${snapshot.blurPx.toFixed(2)}px)`;
    if (snapshot.complete) { traveling = false; canvas.style.filter = ""; status.textContent = "Arrived · still standing on platform"; applyCamera(); }
  }
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
