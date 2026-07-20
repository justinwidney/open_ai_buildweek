import "./lab.css";
import { ORBITAL_SPRITES, type OrbitalSpriteDefinition } from "../world/background/layers/LayeredParallaxBackground";
import { element } from "./threeLab";

type Calibration = {
  x: number;
  y: number;
  depth: number;
  scale: number;
  opacity: number;
  saturation: number;
  warmth: number;
};

const referenceUrl = new URL("../../../../finished/ChatGPT Image Jul 20, 2026, 10_11_35 AM.png", import.meta.url).href;
const spritesRoot = element<HTMLElement>("sprites");
const assetControl = element<HTMLSelectElement>("asset");
const reference = element<HTMLImageElement>("reference");
const edgeCanvas = element<HTMLCanvasElement>("edges");
const grid = element<HTMLElement>("grid");
const status = element<HTMLElement>("status");
const placementOutput = element<HTMLTextAreaElement>("placement-output");
const controls = {
  x: element<HTMLInputElement>("x"),
  y: element<HTMLInputElement>("y"),
  depth: element<HTMLInputElement>("depth"),
  scale: element<HTMLInputElement>("scale"),
  opacity: element<HTMLInputElement>("opacity"),
  saturation: element<HTMLInputElement>("saturation"),
  warmth: element<HTMLInputElement>("warmth"),
};
const calibration = new Map<string, Calibration>();
const spriteElements = new Map<string, HTMLDivElement>();
let yaw = 0;

function labelFor(sprite: OrbitalSpriteDefinition) {
  return sprite.id.replace(/^(cloud-|hd-)/, "").replaceAll("-", " ");
}

for (const sprite of ORBITAL_SPRITES) {
  calibration.set(sprite.id, { x: 0, y: 0, depth: sprite.depth, scale: 1, opacity: .9, saturation: .85, warmth: .12 });
  const option = document.createElement("option");
  option.value = sprite.id;
  option.textContent = `${sprite.kind} · ${labelFor(sprite)}`;
  assetControl.append(option);

  const root = document.createElement("div");
  root.className = "sprite-grid-sprite";
  root.dataset.sprite = sprite.id;
  root.style.top = sprite.top;
  root.style.width = sprite.width;
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  image.src = sprite.asset;
  root.append(image);
  spritesRoot.append(root);
  spriteElements.set(sprite.id, root);
}

function selectedSprite() {
  return ORBITAL_SPRITES.find((sprite) => sprite.id === assetControl.value) ?? ORBITAL_SPRITES[0]!;
}

function selectedCalibration() {
  return calibration.get(selectedSprite().id)!;
}

function renderSprites() {
  for (const sprite of ORBITAL_SPRITES) {
    const values = calibration.get(sprite.id)!;
    const root = spriteElements.get(sprite.id)!;
    const theta = (sprite.angle - yaw) * Math.PI / 180;
    const worldX = Math.sin(theta) * sprite.radius;
    const worldZ = Math.cos(theta) * sprite.radius;
    const orbitDepth = Math.min(1, Math.max(0, (worldZ + 1.2) / 2.4));
    const nearness = Math.min(1, Math.max(0, (1 - values.depth) * .58 + orbitDepth * .42));
    const projectionScale = (.58 + nearness * .64) * values.scale;
    root.style.zIndex = String(Math.round(2 + nearness * 90));
    root.style.opacity = String(values.opacity * (.4 + nearness * .6));
    root.style.transform = `translate3d(calc(-50% + ${(worldX * 48 + values.x).toFixed(2)}vw), ${values.y.toFixed(1)}px, 0) scale(${projectionScale.toFixed(3)})`;
    root.querySelector("img")!.style.filter = `saturate(${values.saturation}) sepia(${values.warmth}) drop-shadow(0 12px 18px rgba(34,48,65,.22))`;
    root.classList.toggle("is-selected", sprite.id === selectedSprite().id);
  }
  updateOutput();
}

function updateOutput() {
  const sprite = selectedSprite();
  const values = selectedCalibration();
  placementOutput.value = JSON.stringify({
    id: sprite.id,
    view: yaw < 0 ? "left" : yaw > 0 ? "right" : "center",
    angle: sprite.angle,
    radius: sprite.radius,
    ...values,
  }, null, 2);
  status.textContent = `${yaw < 0 ? "Left" : yaw > 0 ? "Right" : "Center"} view · ${labelFor(sprite)} selected`;
}

function syncControls() {
  const values = selectedCalibration();
  (Object.keys(controls) as Array<keyof typeof controls>).forEach((key) => { controls[key].value = String(values[key]); });
  element<HTMLOutputElement>("x-output").value = `${values.x.toFixed(1)}vw`;
  element<HTMLOutputElement>("y-output").value = `${Math.round(values.y)}px`;
  element<HTMLOutputElement>("depth-output").value = values.depth.toFixed(2);
  element<HTMLOutputElement>("scale-output").value = `${values.scale.toFixed(2)}×`;
  element<HTMLOutputElement>("opacity-output").value = values.opacity.toFixed(2);
  element<HTMLOutputElement>("saturation-output").value = `${values.saturation.toFixed(2)}×`;
  element<HTMLOutputElement>("warmth-output").value = `${values.warmth.toFixed(2)}×`;
  renderSprites();
}

assetControl.addEventListener("change", syncControls);
(Object.keys(controls) as Array<keyof typeof controls>).forEach((key) => {
  controls[key].addEventListener("input", () => {
    selectedCalibration()[key] = Number(controls[key].value);
    syncControls();
  });
});

function selectView(nextYaw: number) {
  yaw = nextYaw;
  element("left").classList.toggle("is-active", yaw < 0);
  element("center").classList.toggle("is-active", yaw === 0);
  element("right").classList.toggle("is-active", yaw > 0);
  renderSprites();
}
element("left").addEventListener("click", () => selectView(-28));
element("center").addEventListener("click", () => selectView(0));
element("right").addEventListener("click", () => selectView(28));
element("reset").addEventListener("click", () => {
  const sprite = selectedSprite();
  calibration.set(sprite.id, { x: 0, y: 0, depth: sprite.depth, scale: 1, opacity: .9, saturation: .85, warmth: .12 });
  syncControls();
});
element("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(placementOutput.value);
  status.textContent = "Placement copied · ready to promote";
});

const referenceOpacity = element<HTMLInputElement>("reference-opacity");
referenceOpacity.addEventListener("input", () => {
  reference.style.opacity = referenceOpacity.value;
  element<HTMLOutputElement>("reference-output").value = Number(referenceOpacity.value).toFixed(2);
});
element<HTMLInputElement>("show-reference").addEventListener("change", (event) => reference.classList.toggle("is-hidden", !(event.currentTarget as HTMLInputElement).checked));
element<HTMLInputElement>("show-edges").addEventListener("change", (event) => edgeCanvas.classList.toggle("is-hidden", !(event.currentTarget as HTMLInputElement).checked));
element<HTMLInputElement>("show-grid").addEventListener("change", (event) => grid.classList.toggle("is-hidden", !(event.currentTarget as HTMLInputElement).checked));

function renderEdges() {
  const threshold = Number(element<HTMLInputElement>("edge-threshold").value);
  const width = edgeCanvas.width;
  const height = edgeCanvas.height;
  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true })!;
  scratchContext.drawImage(reference, 0, 0, width, height);
  const source = scratchContext.getImageData(0, 0, width, height);
  const output = new ImageData(width, height);
  const luminance = (index: number) => source.data[index]! * .2126 + source.data[index + 1]! * .7152 + source.data[index + 2]! * .0722;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = (offsetX: number, offsetY: number) => ((y + offsetY) * width + x + offsetX) * 4;
      const gx = -luminance(at(-1, -1)) - 2 * luminance(at(-1, 0)) - luminance(at(-1, 1)) + luminance(at(1, -1)) + 2 * luminance(at(1, 0)) + luminance(at(1, 1));
      const gy = -luminance(at(-1, -1)) - 2 * luminance(at(0, -1)) - luminance(at(1, -1)) + luminance(at(-1, 1)) + 2 * luminance(at(0, 1)) + luminance(at(1, 1));
      const strength = Math.min(255, Math.hypot(gx, gy));
      const outputIndex = (y * width + x) * 4;
      output.data[outputIndex] = 255;
      output.data[outputIndex + 1] = 214;
      output.data[outputIndex + 2] = 92;
      output.data[outputIndex + 3] = strength >= threshold ? Math.min(230, strength) : 0;
    }
  }
  edgeCanvas.getContext("2d")!.putImageData(output, 0, 0);
  element<HTMLOutputElement>("edge-output").value = String(threshold);
}

element<HTMLInputElement>("edge-threshold").addEventListener("input", renderEdges);
element<HTMLInputElement>("reference-file").addEventListener("change", (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (!file) return;
  reference.src = URL.createObjectURL(file);
});
reference.addEventListener("load", renderEdges);
reference.src = referenceUrl;
assetControl.value = "balloon-large";
syncControls();
