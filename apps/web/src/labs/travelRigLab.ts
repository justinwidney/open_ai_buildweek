import * as THREE from "three";
import "./lab.css";
import { sampleIslandTransition } from "../world/animation/island-transition";
import { createLabBridge, createLabPlatform } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";

const canvas = element<HTMLCanvasElement>("scene");
const lab = createThreeLab(canvas, { fov: 45, far: 220 });
addLabLighting(lab.scene);
lab.camera.position.set(0, 5.2, 11);
lab.camera.lookAt(0, .2, -11);
const rail = new THREE.Group();
rail.name = "continuous-world-rail";
lab.scene.add(rail);
const step = 14;
const platforms: { object: THREE.Group; index: number; retired: boolean }[] = [];
let nextIndex = 0;

function addStop(index: number) {
  const platform = createLabPlatform(`travel-stop-${index}`, { radius: index % 3 === 0 ? 4.2 : 2.7, seed: 80 + index * 31, details: index % 2 === 0 });
  platform.group.position.set(Math.sin(index * 1.7) * 2.2, index * .24, -index * step);
  rail.add(platform.group);
  platforms.push({ object: platform.group, index, retired: false });
  if (index > 0) {
    const bridge = createLabBridge(step - 4.8, .82);
    bridge.position.set(Math.sin((index - 1) * 1.7) * 1.2, .18 + index * .24, -(index - 1) * step - 3);
    rail.add(bridge);
  }
}
for (let index = 0; index < 7; index += 1) addStop(index);

const durationInput = element<HTMLInputElement>("duration");
const durationOutput = element<HTMLOutputElement>("duration-output");
const status = element<HTMLElement>("status");
const offsetReadout = element<HTMLElement>("offset");
const retiredReadout = element<HTMLElement>("retired");
const recycle = element<HTMLInputElement>("recycle");
let running = false;
let startedAt = 0;
let startOffset = 0;
let retiredCount = 0;

durationInput.addEventListener("input", () => { durationOutput.value = `${Number(durationInput.value).toFixed(2)}s`; });
element("travel").addEventListener("click", () => {
  if (running) return;
  running = true;
  startedAt = performance.now();
  startOffset = rail.position.z;
  status.textContent = "Accelerating · camera locked";
});
element("reset").addEventListener("click", () => {
  running = false; rail.position.z = 0; nextIndex = 0; retiredCount = 0;
  platforms.forEach(({ object, index }) => { object.position.z = -index * step; object.visible = true; });
  platforms.forEach((entry) => { entry.retired = false; });
  canvas.style.filter = ""; offsetReadout.textContent = "0.0m"; retiredReadout.textContent = "0"; status.textContent = "Ready · camera locked";
});

function retirePassed() {
  for (const entry of platforms) {
    const worldZ = entry.object.position.z + rail.position.z;
    if (entry.retired || worldZ < lab.camera.position.z + 5) continue;
    entry.retired = true;
    retiredCount += 1;
    if (recycle.checked) {
      const furthest = Math.max(...platforms.map((candidate) => candidate.index));
      entry.index = furthest + 1;
      entry.object.position.z = -entry.index * step;
      entry.object.position.x = Math.sin(entry.index * 1.7) * 2.2;
      entry.retired = false;
    } else entry.object.visible = false;
  }
  retiredReadout.textContent = String(retiredCount);
}

function animate(now: number) {
  if (running) {
    const total = Number(durationInput.value) * 1000;
    const scale = total / 2100;
    const snapshot = sampleIslandTransition(now - startedAt, {
      travelDistance: step,
      durations: { accelerationMs: 380 * scale, cruiseMs: 900 * scale, decelerationMs: 820 * scale, settlingMs: 0 },
      maxBlurPx: .78,
      maxMotionBlurIntensity: .3,
    });
    rail.position.z = startOffset + snapshot.worldOffsetProgress * step;
    canvas.style.filter = `blur(${snapshot.blurPx.toFixed(2)}px) saturate(${(1 - snapshot.motionBlurIntensity * .025).toFixed(3)})`;
    offsetReadout.textContent = `${rail.position.z.toFixed(1)}m`;
    status.textContent = `${snapshot.phase} · camera locked`;
    retirePassed();
    if (snapshot.complete) {
      running = false; nextIndex += 1; canvas.style.filter = ""; status.textContent = `Arrived at stop ${nextIndex + 1}`;
    }
  }
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
