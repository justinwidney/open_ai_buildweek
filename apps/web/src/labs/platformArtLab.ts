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
import {
  createFoundationInscription,
  createRouteNumber,
  createSkillSign,
} from "../world/content/forward/signage";
import type { WorldPlatform } from "../world/world.types";

type PlatformPurpose = "foundation" | "learning" | "milestone" | "path";

const canvas = element<HTMLCanvasElement>("scene");
const lab = createThreeLab(canvas, { fov: 38 });
lab.scene.fog = new THREE.FogExp2(0x9bb8cf, .018);
addLabLighting(lab.scene);
lab.camera.position.set(0, 5.2, 14.5);
lab.camera.lookAt(0, -.5, 0);

const purposeControl = element<HTMLSelectElement>("purpose");
const scaleControl = element<HTMLInputElement>("mesh-scale");
const scaleOutput = element<HTMLOutputElement>("mesh-scale-output");
const meshesToggle = element<HTMLInputElement>("purpose-meshes");
const wireframeToggle = element<HTMLInputElement>("wireframe");
const meshCount = element<HTMLElement>("mesh-count");
const cameraReadout = element<HTMLElement>("camera-readout");
const status = element<HTMLElement>("status");
const front = element<HTMLButtonElement>("front");
const below = element<HTMLButtonElement>("below");
const purposes: PlatformPurpose[] = ["foundation", "learning", "milestone", "path"];

const support = createLabPlatform("approved-base-platform", {
  radius: 4.6,
  seed: 73,
  details: false,
  baseArt: true,
  jaggedness: .04,
  cragDepth: .74,
});
lab.scene.add(support.group);

let purposeRoot = new THREE.Group();
purposeRoot.name = "purpose-meshes";
lab.scene.add(purposeRoot);

function createPurposeMaterials(): DecorationMaterials {
  return {
    stone: new THREE.MeshStandardMaterial({ color: 0xc3ad82, roughness: .94 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x64492f, roughness: .96 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x61784c, roughness: .98 }),
    foliageLight: new THREE.MeshStandardMaterial({ color: 0x91a666, roughness: .96 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffcf72, transparent: true, opacity: .88 }),
    flower: new THREE.MeshStandardMaterial({ color: 0xd4a4d9, roughness: .78 }),
  };
}

function labPlatform(purpose: PlatformPurpose): WorldPlatform {
  const copy = {
    foundation: ["Foundation", "A calm place to begin"],
    learning: ["Clarity", "A place for one focused skill"],
    milestone: ["Milestone", "A visible moment of progress"],
    path: ["Waypoint", "A quiet connection onward"],
  } as const;
  return {
    id: `lab-${purpose}`,
    title: copy[purpose][0],
    subtitle: copy[purpose][1],
    position: [0, 0, 0],
    radius: support.build.radius,
    kind: purpose === "foundation" ? "start" : "front",
  };
}

function buildPurposeMeshes(purpose: PlatformPurpose) {
  disposeLabObject(purposeRoot);
  purposeRoot = new THREE.Group();
  purposeRoot.name = `purpose-meshes:${purpose}`;
  const materials = createPurposeMaterials();
  const platform = labPlatform(purpose);
  const surfaceY = support.build.surfaceY;

  if (purpose === "foundation") {
    const tree = createStorybookTree(materials, 1.05);
    tree.position.set(-1.95, surfaceY, -.6);
    purposeRoot.add(tree);
    for (const x of [-3.1, 3.1]) {
      const lantern = createLantern(materials, .72);
      lantern.position.set(x, surfaceY, .4);
      purposeRoot.add(lantern);
    }
    purposeRoot.add(createFoundationInscription(platform));
  } else if (purpose === "learning") {
    purposeRoot.add(createSkillSign(platform, 0x806397));
    const flowers = createFlowerPatch(materials, 13, 24);
    flowers.position.set(1.45, surfaceY, -.15);
    purposeRoot.add(flowers);
  } else if (purpose === "milestone") {
    const spinner = createMilestoneSpinner(materials, 1.15);
    spinner.position.set(0, surfaceY, -.35);
    purposeRoot.add(spinner, createRouteNumber(3, support.build.radius));
  } else {
    purposeRoot.add(createRouteNumber(2, support.build.radius));
  }

  purposeRoot.visible = meshesToggle.checked;
  purposeRoot.scale.setScalar(Number(scaleControl.value));
  lab.scene.add(purposeRoot);
  let count = 0;
  purposeRoot.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) count += 1;
  });
  meshCount.textContent = String(count);
  status.textContent = `Neutral base · ${purposeControl.options[purposeControl.selectedIndex]?.text.toLowerCase()}`;
}

function setWireframe(enabled: boolean) {
  support.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) material.wireframe = enabled;
    });
  });
}

purposeControl.addEventListener("change", () => buildPurposeMeshes(purposeControl.value as PlatformPurpose));
scaleControl.addEventListener("input", () => {
  const value = Number(scaleControl.value);
  scaleOutput.value = `${value.toFixed(2)}×`;
  purposeRoot.scale.setScalar(value);
});
meshesToggle.addEventListener("change", () => { purposeRoot.visible = meshesToggle.checked; });
wireframeToggle.addEventListener("change", () => setWireframe(wireframeToggle.checked));
element("next-purpose").addEventListener("click", () => {
  const next = (purposes.indexOf(purposeControl.value as PlatformPurpose) + 1) % purposes.length;
  purposeControl.value = purposes[next] ?? "foundation";
  buildPurposeMeshes(purposeControl.value as PlatformPurpose);
});
front.addEventListener("click", () => {
  front.classList.add("is-active"); below.classList.remove("is-active");
  lab.camera.position.set(0, 5.2, 14.5); lab.camera.lookAt(0, -.5, 0); cameraReadout.textContent = "front";
});
below.addEventListener("click", () => {
  below.classList.add("is-active"); front.classList.remove("is-active");
  lab.camera.position.set(0, -.45, 14.5); lab.camera.lookAt(0, -1.15, 0); cameraReadout.textContent = "near edge";
});

function animate() {
  const elapsed = lab.clock.getElapsedTime();
  purposeRoot.traverse((object) => {
    if (object.name === "decorative-spinner") object.rotation.y = elapsed * .42;
  });
  lab.renderer.render(lab.scene, lab.camera);
  requestAnimationFrame(animate);
}

window.addEventListener("beforeunload", () => {
  disposeLabObject(purposeRoot);
  disposeLabObject(support.group);
  lab.dispose();
}, { once: true });

scaleOutput.value = `${Number(scaleControl.value).toFixed(2)}×`;
buildPurposeMeshes("foundation");
animate();
