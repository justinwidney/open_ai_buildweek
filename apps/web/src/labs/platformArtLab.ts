import * as THREE from "three";
import "./lab.css";
import { createLabPlatform, disposeLabObject } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";

const canvas = element<HTMLCanvasElement>("scene");
const lab = createThreeLab(canvas, { fov: 38 });
lab.scene.fog = new THREE.FogExp2(0x9bb8cf, .024);
addLabLighting(lab.scene);
lab.camera.position.set(0, 4.7, 13.5);
lab.camera.lookAt(0, -.7, 0);

const profile = element<HTMLSelectElement>("profile");
const jagged = element<HTMLInputElement>("jagged");
const depth = element<HTMLInputElement>("depth");
const jaggedOutput = element<HTMLOutputElement>("jagged-output");
const depthOutput = element<HTMLOutputElement>("depth-output");
const cameraReadout = element<HTMLElement>("camera-readout");
const status = element<HTMLElement>("status");
const front = element<HTMLButtonElement>("front");
const below = element<HTMLButtonElement>("below");
let seed = 73;
let platform = createLabPlatform("art-study", { seed, profile: "storybook", jaggedness: .14, cragDepth: 1.18 });
lab.scene.add(platform.group);

function rebuild() {
  disposeLabObject(platform.group);
  platform = createLabPlatform("art-study", {
    seed,
    profile: profile.value as "storybook" | "ancient" | "wild",
    jaggedness: Number(jagged.value),
    cragDepth: Number(depth.value),
  });
  lab.scene.add(platform.group);
  jaggedOutput.value = Number(jagged.value).toFixed(2);
  depthOutput.value = `${Number(depth.value).toFixed(2)}×`;
  status.textContent = `${profile.options[profile.selectedIndex]?.text ?? profile.value} · seed ${seed}`;
}

profile.addEventListener("change", rebuild);
jagged.addEventListener("input", rebuild);
depth.addEventListener("input", rebuild);
element("reseed").addEventListener("click", () => { seed += 137; rebuild(); });
front.addEventListener("click", () => {
  front.classList.add("is-active"); below.classList.remove("is-active");
  lab.camera.position.set(0, 4.7, 13.5); lab.camera.lookAt(0, -.7, 0); cameraReadout.textContent = "front";
});
below.addEventListener("click", () => {
  below.classList.add("is-active"); front.classList.remove("is-active");
  lab.camera.position.set(0, -.8, 14.5); lab.camera.lookAt(0, -1.8, 0); cameraReadout.textContent = "below";
});

function animate() {
  const elapsed = lab.clock.getElapsedTime();
  platform.group.rotation.y = Math.sin(elapsed * .18) * .07;
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}
animate();
