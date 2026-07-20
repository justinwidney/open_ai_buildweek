import "./lab.css";
import { element } from "./threeLab";

const stage = element<HTMLElement>("pan-stage");
const depthInput = element<HTMLInputElement>("depth");
const driftInput = element<HTMLInputElement>("drift");
const depthOutput = element<HTMLOutputElement>("depth-output");
const driftOutput = element<HTMLOutputElement>("drift-output");
const status = element<HTMLElement>("status");
const auto = element<HTMLInputElement>("auto");
const tracks = [...stage.querySelectorAll<HTMLElement>("[data-depth]")];
const layerToggles = [...document.querySelectorAll<HTMLInputElement>("[data-layer-toggle]")];
const buttons = {
  left: element<HTMLButtonElement>("left"),
  center: element<HTMLButtonElement>("center"),
  right: element<HTMLButtonElement>("right"),
};
let sector: -1 | 0 | 1 = 0;
let lastAutoShift = performance.now();

function visibleElementCount() {
  return layerToggles.filter((toggle) => toggle.checked).length;
}

function sectorLabel() {
  return sector < 0 ? "Left" : sector > 0 ? "Right" : "Center";
}

function updateStatus() {
  status.textContent = `${sectorLabel()} sector · ${visibleElementCount()} visible`;
}

layerToggles.forEach((toggle) => {
  toggle.addEventListener("change", () => {
    const id = toggle.dataset.layerToggle;
    if (!id) return;
    stage.querySelectorAll<HTMLElement>(`[data-layer-id="${id}"]`).forEach((layer) => {
      layer.classList.toggle("is-hidden", !toggle.checked);
    });
    updateStatus();
  });
});

function selectSector(next: -1 | 0 | 1) {
  sector = next;
  Object.entries(buttons).forEach(([name, button]) => button.classList.toggle("is-active", (name === "left" ? -1 : name === "right" ? 1 : 0) === sector));
  updateStatus();
}
buttons.left.addEventListener("click", () => selectSector(-1));
buttons.center.addEventListener("click", () => selectSector(0));
buttons.right.addEventListener("click", () => selectSector(1));
depthInput.addEventListener("input", () => { depthOutput.value = `${Number(depthInput.value).toFixed(2)}×`; });
driftInput.addEventListener("input", () => { driftOutput.value = `${Number(driftInput.value).toFixed(2)}×`; });

function animate(now: number) {
  if (auto.checked && now - lastAutoShift > 3600) {
    selectSector(sector === 1 ? -1 : (sector + 1) as -1 | 0 | 1);
    lastAutoShift = now;
  }
  const depthScale = Number(depthInput.value);
  const driftScale = Number(driftInput.value);
  tracks.forEach((layer, index) => {
    const depth = Number(layer.dataset.depth ?? .5);
    const sectorShift = sector * depth * depthScale * 42;
    const drift = Math.sin(now * (.00007 + index * .000025) + index * 1.7) * driftScale * depth * 10;
    const lift = Math.cos(now * .00009 + index) * driftScale * depth * 3;
    layer.style.transform = `translate3d(${sectorShift + drift}vw, ${lift}px, 0) scale(${1.03 + depth * .025})`;
  });
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
