import "./lab.css";
import { element } from "./threeLab";

interface SpriteSpec { id: string; src: string; depth: number; drift: number; }
interface SpriteState extends SpriteSpec { element: HTMLImageElement; x: number; y: number; scale: number; phase: number; }

const stage = element<HTMLElement>("sprite-stage");
const yaw = element<HTMLInputElement>("yaw");
const yawOutput = element<HTMLOutputElement>("yaw-output");
const yawReadout = element<HTMLElement>("yaw-readout");
const depthInput = element<HTMLInputElement>("sprite-depth");
const depthOutput = element<HTMLOutputElement>("sprite-depth-output");
const scaleInput = element<HTMLInputElement>("sprite-scale");
const scaleOutput = element<HTMLOutputElement>("sprite-scale-output");
const animateToggle = element<HTMLInputElement>("animate");
const selectedReadout = element<HTMLElement>("selected");
const status = element<HTMLElement>("status");
const initialPositions = [[18,31],[39,22],[77,27],[27,65],[58,61],[82,56]] as const;
let sprites: SpriteState[] = [];
let selected: SpriteState | undefined;
let drag: { sprite: SpriteState; pointerId: number } | undefined;

function select(sprite: SpriteState) {
  selected?.element.classList.remove("is-selected");
  selected = sprite;
  sprite.element.classList.add("is-selected");
  depthInput.value = String(sprite.depth);
  scaleInput.value = String(sprite.scale);
  depthOutput.value = sprite.depth.toFixed(2);
  scaleOutput.value = `${sprite.scale.toFixed(2)}×`;
  selectedReadout.textContent = sprite.id;
  status.textContent = `${sprite.id} selected · drag to place`;
}

function setFromPointer(event: PointerEvent, sprite: SpriteState) {
  const rect = stage.getBoundingClientRect();
  sprite.x = Math.min(96, Math.max(4, (event.clientX - rect.left) / rect.width * 100));
  sprite.y = Math.min(91, Math.max(9, (event.clientY - rect.top) / rect.height * 100));
}

async function loadSprites() {
  const manifest = await fetch("/lab-assets/floaters/manifest.json").then((response) => response.json()) as { sprites: SpriteSpec[] };
  sprites = manifest.sprites.map((spec, index) => {
    const image = document.createElement("img");
    image.src = spec.src;
    image.alt = spec.id;
    image.draggable = false;
    image.className = "floater-sprite";
    stage.appendChild(image);
    const state: SpriteState = { ...spec, element: image, x: initialPositions[index]?.[0] ?? 50, y: initialPositions[index]?.[1] ?? 50, scale: index === 1 || index === 2 ? .7 : 1, phase: index * 1.31 };
    image.addEventListener("pointerdown", (event) => {
      select(state); drag = { sprite: state, pointerId: event.pointerId }; image.setPointerCapture(event.pointerId); setFromPointer(event, state);
    });
    image.addEventListener("pointermove", (event) => { if (drag?.pointerId === event.pointerId && drag.sprite === state) setFromPointer(event, state); });
    image.addEventListener("pointerup", (event) => { if (drag?.pointerId === event.pointerId) drag = undefined; });
    return state;
  });
  element("sprite-count").textContent = String(sprites.length);
  if (sprites[0]) select(sprites[0]);
}

yaw.addEventListener("input", () => {
  yawOutput.value = `${yaw.value}°`; yawReadout.textContent = `${yaw.value}°`;
});
depthInput.addEventListener("input", () => {
  if (!selected) return; selected.depth = Number(depthInput.value); depthOutput.value = selected.depth.toFixed(2);
});
scaleInput.addEventListener("input", () => {
  if (!selected) return; selected.scale = Number(scaleInput.value); scaleOutput.value = `${selected.scale.toFixed(2)}×`;
});
element("reset").addEventListener("click", () => {
  sprites.forEach((sprite, index) => {
    sprite.x = initialPositions[index]?.[0] ?? 50; sprite.y = initialPositions[index]?.[1] ?? 50; sprite.depth = index % 3 === 0 ? .35 : .65; sprite.scale = index === 1 || index === 2 ? .7 : 1;
  });
  yaw.value = "0"; yawOutput.value = "0°"; yawReadout.textContent = "0°"; if (sprites[0]) select(sprites[0]);
});

function render(now: number) {
  const yawDegrees = Number(yaw.value);
  sprites.forEach((sprite) => {
    const cameraShift = -yawDegrees * (1 - sprite.depth) * 8;
    const bob = animateToggle.checked ? Math.sin(now * .00055 * (1 + sprite.drift) + sprite.phase) * (8 + sprite.drift * 9) : 0;
    const drift = animateToggle.checked ? Math.cos(now * .00016 + sprite.phase) * sprite.drift * 18 : 0;
    const depthScale = .55 + (1 - sprite.depth) * .72;
    sprite.element.style.left = `${sprite.x}%`;
    sprite.element.style.top = `${sprite.y}%`;
    sprite.element.style.zIndex = String(Math.round((1 - sprite.depth) * 80 + 2));
    sprite.element.style.transform = `translate(-50%, -50%) translate3d(${cameraShift + drift}px, ${bob}px, 0) scale(${sprite.scale * depthScale})`;
    sprite.element.style.opacity = String(.62 + (1 - sprite.depth) * .38);
  });
  requestAnimationFrame(render);
}
loadSprites().then(() => requestAnimationFrame(render));
