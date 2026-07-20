import * as THREE from "three";
import "./lab.css";
import { createLabPlatform, disposeLabObject } from "./labWorldObjects";
import { addLabLighting, createThreeLab, element } from "./threeLab";
import {
  createFlowerPatch,
  createLantern,
  createMilestoneSpinner,
  createStorybookTree,
  type DecorationMaterials,
} from "../world/content/forward/decorations";
import { createFoundationInscription, createRouteNumber, createSkillSign } from "../world/content/forward/signage";
import type { WorldPlatform } from "../world/world.types";

type DetailId = "tree" | "lantern-left" | "lantern-right" | "flowers" | "sign" | "milestone" | "route-number" | "inscription";
type DetailEntry = { id: DetailId; label: string; root: THREE.Object3D; initial: { x: number; z: number; scale: number; rotation: number }; enabled: boolean };

const canvas = element<HTMLCanvasElement>("scene");
const lab = createThreeLab(canvas, { fov: 44 });
lab.scene.fog = new THREE.FogExp2(0x9ebbd2, .016);
addLabLighting(lab.scene);

const platform: WorldPlatform = { id: "detail-forge", title: "Foundation", subtitle: "Know yourself", position: [0, 0, 0], radius: 4.8, kind: "start" };
const materials: DecorationMaterials = {
  stone: new THREE.MeshStandardMaterial({ color: 0xc5b187, roughness: .94 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x64482f, roughness: .96 }),
  foliage: new THREE.MeshStandardMaterial({ color: 0x5f764b, roughness: .98 }),
  foliageLight: new THREE.MeshStandardMaterial({ color: 0x91a66b, roughness: .96 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffcf72, transparent: true, opacity: .86 }),
  flower: new THREE.MeshStandardMaterial({ color: 0xd3a3d8, roughness: .78 }),
};

let support = createLabPlatform("detail-forge-base", { radius: platform.radius, seed: 73, details: false, baseArt: true, textures: true, jaggedness: .025, cragDepth: .72 });
lab.scene.add(support.group);
const detailRoot = new THREE.Group();
detailRoot.name = "platform-detail-catalog";
lab.scene.add(detailRoot);

function entry(id: DetailId, label: string, root: THREE.Object3D, x: number, z: number, scale = 1, rotation = 0): DetailEntry {
  root.name = `detail:${id}`;
  root.position.set(x, support.build.surfaceY, z);
  root.scale.setScalar(scale);
  root.rotation.y = THREE.MathUtils.degToRad(rotation);
  detailRoot.add(root);
  return { id, label, root, initial: { x, z, scale, rotation }, enabled: true };
}

const details: DetailEntry[] = [
  entry("tree", "Storybook tree", createStorybookTree(materials, 1.05), -2.1, -.45),
  entry("lantern-left", "Left lantern", createLantern(materials, .72), -3.25, 1.05),
  entry("lantern-right", "Right lantern", createLantern(materials, .72), 3.25, 1.05),
  entry("flowers", "Flower bed", createFlowerPatch(materials, 13, 28), 1.65, -.35),
  entry("sign", "Skill sign", createSkillSign(platform, 0x806397), 2.05, -1.5, .82, -12),
  entry("milestone", "Milestone spinner", createMilestoneSpinner(materials, 1.05), 0, -.6, .75),
  entry("route-number", "Route number", createRouteNumber(2, platform.radius), 0, 1.15, 1),
  entry("inscription", "Foundation lettering", createFoundationInscription(platform), 0, 0, 1),
];

const assetControl = element<HTMLSelectElement>("asset");
const enabledControl = element<HTMLInputElement>("asset-enabled");
const xControl = element<HTMLInputElement>("x");
const zControl = element<HTMLInputElement>("z");
const scaleControl = element<HTMLInputElement>("scale");
const rotationControl = element<HTMLInputElement>("rotation");
const texturesControl = element<HTMLInputElement>("textures");
const wireframeControl = element<HTMLInputElement>("wireframe");
const gridControl = element<HTMLInputElement>("grid");
const placementGrid = element<HTMLElement>("placement-grid");
const status = element<HTMLElement>("status");
const catalog = element<HTMLElement>("catalog");
const visibleCount = element<HTMLElement>("visible-count");

assetControl.innerHTML = details.map((detail) => `<option value="${detail.id}">${detail.label}</option>`).join("");
catalog.innerHTML = details.map((detail) => `<label class="lab-check"><input type="checkbox" data-detail-toggle="${detail.id}" checked><span>${detail.label}</span></label>`).join("");

function selected() {
  return details.find((detail) => detail.id === assetControl.value) ?? details[0]!;
}

function updateCount() {
  visibleCount.textContent = String(details.filter((detail) => detail.enabled).length);
}

function syncControls() {
  const detail = selected();
  enabledControl.checked = detail.enabled;
  xControl.value = String(detail.root.position.x);
  zControl.value = String(detail.root.position.z);
  scaleControl.value = String(detail.root.scale.x);
  rotationControl.value = String(Math.round(THREE.MathUtils.radToDeg(detail.root.rotation.y)));
  element<HTMLOutputElement>("x-output").value = `${detail.root.position.x.toFixed(2)}m`;
  element<HTMLOutputElement>("z-output").value = `${detail.root.position.z.toFixed(2)}m`;
  element<HTMLOutputElement>("scale-output").value = `${detail.root.scale.x.toFixed(2)}×`;
  element<HTMLOutputElement>("rotation-output").value = `${Math.round(THREE.MathUtils.radToDeg(detail.root.rotation.y))}°`;
  status.textContent = `High 2.5D view · ${detail.label.toLowerCase()} selected`;
}

function applySelectedTransform() {
  const detail = selected();
  detail.root.position.x = Number(xControl.value);
  detail.root.position.z = Number(zControl.value);
  detail.root.scale.setScalar(Number(scaleControl.value));
  detail.root.rotation.y = THREE.MathUtils.degToRad(Number(rotationControl.value));
  syncControls();
}

function setWireframe(enabled: boolean) {
  support.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh)) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => { if (material instanceof THREE.MeshStandardMaterial) material.wireframe = enabled; });
  });
}

function rebuildSupport() {
  const old = support;
  support = createLabPlatform("detail-forge-base", { radius: platform.radius, seed: 73, details: false, baseArt: true, textures: texturesControl.checked, jaggedness: .025, cragDepth: .72 });
  lab.scene.add(support.group);
  detailRoot.position.y = support.build.surfaceY - old.build.surfaceY;
  disposeLabObject(old.group);
  setWireframe(wireframeControl.checked);
  element("texture-readout").textContent = texturesControl.checked ? "painted" : "flat shape";
}

assetControl.addEventListener("change", syncControls);
enabledControl.addEventListener("change", () => {
  const detail = selected();
  detail.enabled = enabledControl.checked;
  detail.root.visible = detail.enabled;
  const toggle = document.querySelector<HTMLInputElement>(`[data-detail-toggle="${detail.id}"]`);
  if (toggle) toggle.checked = detail.enabled;
  updateCount();
});
[xControl, zControl, scaleControl, rotationControl].forEach((control) => control.addEventListener("input", applySelectedTransform));
catalog.querySelectorAll<HTMLInputElement>("[data-detail-toggle]").forEach((toggle) => toggle.addEventListener("change", () => {
  const detail = details.find((candidate) => candidate.id === toggle.dataset.detailToggle);
  if (!detail) return;
  detail.enabled = toggle.checked;
  detail.root.visible = detail.enabled;
  if (detail.id === selected().id) enabledControl.checked = detail.enabled;
  updateCount();
}));
texturesControl.addEventListener("change", rebuildSupport);
wireframeControl.addEventListener("change", () => setWireframe(wireframeControl.checked));
gridControl.addEventListener("change", () => placementGrid.classList.toggle("is-visible", gridControl.checked));

function setCamera(mode: "high" | "edge") {
  const high = mode === "high";
  lab.camera.position.set(0, high ? 8.2 : 4.9, high ? 12.8 : 14.5);
  lab.camera.lookAt(0, high ? -.55 : -.25, high ? -.8 : 0);
  element("camera-readout").textContent = high ? "high" : "near edge";
  element("high").classList.toggle("is-active", high);
  element("edge").classList.toggle("is-active", !high);
}
element("high").addEventListener("click", () => setCamera("high"));
element("edge").addEventListener("click", () => setCamera("edge"));
element("reset").addEventListener("click", () => {
  details.forEach((detail) => {
    detail.enabled = true;
    detail.root.visible = true;
    detail.root.position.set(detail.initial.x, support.build.surfaceY, detail.initial.z);
    detail.root.scale.setScalar(detail.initial.scale);
    detail.root.rotation.y = THREE.MathUtils.degToRad(detail.initial.rotation);
  });
  catalog.querySelectorAll<HTMLInputElement>("input").forEach((toggle) => { toggle.checked = true; });
  texturesControl.checked = true;
  wireframeControl.checked = false;
  gridControl.checked = true;
  placementGrid.classList.add("is-visible");
  rebuildSupport();
  setCamera("high");
  updateCount();
  syncControls();
});

function animate() {
  const elapsed = lab.clock.getElapsedTime();
  details.find((detail) => detail.id === "milestone")!.root.rotation.y += .004 + Math.sin(elapsed) * .0003;
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}

window.addEventListener("beforeunload", () => {
  disposeLabObject(detailRoot);
  disposeLabObject(support.group);
  lab.dispose();
}, { once: true });

placementGrid.classList.add("is-visible");
setCamera("high");
updateCount();
syncControls();
animate();
