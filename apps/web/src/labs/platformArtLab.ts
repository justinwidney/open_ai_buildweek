import * as THREE from "three";
import "./lab.css";
import { createLabPlatform, disposeLabObject } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";
import {
  createPlatformArtStack,
  type PlatformArtVariant,
} from "../world/assets/platformDetailCards";

const canvas = element<HTMLCanvasElement>("scene");
const lab = createThreeLab(canvas, { fov: 38 });
lab.scene.fog = new THREE.FogExp2(0x9bb8cf, .018);
addLabLighting(lab.scene);
lab.camera.position.set(0, 4.8, 14.5);
lab.camera.lookAt(0, -.9, 0);

const variant = element<HTMLSelectElement>("variant");
const spread = element<HTMLInputElement>("spread");
const spreadOutput = element<HTMLOutputElement>("spread-output");
const details = element<HTMLInputElement>("details");
const geometry = element<HTMLInputElement>("geometry");
const layerCount = element<HTMLElement>("layer-count");
const cameraReadout = element<HTMLElement>("camera-readout");
const status = element<HTMLElement>("status");
const front = element<HTMLButtonElement>("front");
const below = element<HTMLButtonElement>("below");
const variants: PlatformArtVariant[] = ["tree", "waterfall", "castle", "garden"];

let support = createLabPlatform("atlas-support", { radius: 4.6, seed: 73, details: false });
support.group.visible = false;
lab.scene.add(support.group);
let art = createPlatformArtStack({ radius: 4.6, surfaceY: support.build.surfaceY, variant: "tree" });
lab.scene.add(art);

function rebuild() {
  art.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
      material.dispose();
    });
  });
  art.removeFromParent();
  art = createPlatformArtStack({
    radius: 4.6,
    surfaceY: support.build.surfaceY,
    variant: variant.value as PlatformArtVariant,
    detailSpread: Number(spread.value),
    includeDetails: details.checked,
  });
  lab.scene.add(art);
  spreadOutput.value = `${Number(spread.value).toFixed(2)}×`;
  layerCount.textContent = String(art.userData.layerCount ?? art.children.length);
  status.textContent = `10_23_53 atlas · ${variant.options[variant.selectedIndex]?.text.toLowerCase()}`;
}

variant.addEventListener("change", rebuild);
spread.addEventListener("input", rebuild);
details.addEventListener("change", rebuild);
geometry.addEventListener("change", () => { support.group.visible = geometry.checked; });
element("next-art").addEventListener("click", () => {
  const nextIndex = (variants.indexOf(variant.value as PlatformArtVariant) + 1) % variants.length;
  variant.value = variants[nextIndex] ?? "tree";
  rebuild();
});
front.addEventListener("click", () => {
  front.classList.add("is-active"); below.classList.remove("is-active");
  lab.camera.position.set(0, 4.8, 14.5); lab.camera.lookAt(0, -.9, 0); cameraReadout.textContent = "front";
});
below.addEventListener("click", () => {
  below.classList.add("is-active"); front.classList.remove("is-active");
  lab.camera.position.set(0, -.65, 14.5); lab.camera.lookAt(0, -2.2, 0); cameraReadout.textContent = "below";
});

function animate() {
  const elapsed = lab.clock.getElapsedTime();
  const yaw = Math.sin(elapsed * .22) * .09;
  art.rotation.y = yaw;
  support.group.rotation.y = yaw;
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}

window.addEventListener("beforeunload", () => disposeLabObject(support.group), { once: true });
rebuild();
animate();
