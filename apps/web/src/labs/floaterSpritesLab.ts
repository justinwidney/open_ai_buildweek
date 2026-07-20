import "./lab.css";
import { element } from "./threeLab";

type SpriteKind = "floater" | "cloud" | "island";

interface SpriteSpec {
  id: string;
  label: string;
  src: string;
  kind: SpriteKind;
  angle: number;
  radius: number;
  top: number;
  depth: number;
  scale: number;
  drift: number;
  width: string;
}

interface SpriteState extends SpriteSpec {
  element: HTMLImageElement;
  phase: number;
  worldX: number;
  worldZ: number;
}

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
const selectedXReadout = element<HTMLElement>("selected-x");
const selectedZReadout = element<HTMLElement>("selected-z");
const status = element<HTMLElement>("status");
const tray = element<HTMLElement>("sprite-tray");

const FLOATERS: readonly SpriteSpec[] = [
  { id: "balloon-large", label: "Balloon", src: "/lab-assets/floaters/balloon-large-final.png", kind: "floater", angle: -43, radius: .88, top: 19, depth: .42, scale: 1, drift: .72, width: "clamp(72px, 8vw, 132px)" },
  { id: "spire-small", label: "Spire", src: "/lab-assets/floaters/spire-small-final.png", kind: "floater", angle: -10, radius: .78, top: 25, depth: .75, scale: .92, drift: .28, width: "clamp(54px, 6vw, 94px)" },
  { id: "balloon-small", label: "Far balloon", src: "/lab-assets/floaters/balloon-small-final.png", kind: "floater", angle: 38, radius: .84, top: 19, depth: .84, scale: .92, drift: .42, width: "clamp(45px, 5vw, 82px)" },
  { id: "island-small", label: "Far island", src: "/lab-assets/floaters/island-small-final.png", kind: "floater", angle: -27, radius: .9, top: 58, depth: .65, scale: 1, drift: .18, width: "clamp(92px, 12vw, 190px)" },
  { id: "island-large", label: "Near island", src: "/lab-assets/floaters/island-large-final.png", kind: "floater", angle: 18, radius: 1.02, top: 57, depth: .38, scale: 1, drift: .12, width: "clamp(145px, 18vw, 310px)" },
  { id: "airship-large", label: "Airship", src: "/lab-assets/floaters/airship-large-final.png", kind: "floater", angle: 51, radius: 1.05, top: 35, depth: .3, scale: 1.18, drift: .56, width: "clamp(170px, 22vw, 360px)" },
];

const CLOUDS: readonly SpriteSpec[] = [
  { id: "cloud-tower-left", label: "Tower L", src: "/lab-assets/clouds/tower-left.png", kind: "cloud", angle: -62, radius: 1.12, top: 8, depth: .34, scale: 1, drift: .11, width: "clamp(210px, 31vw, 560px)" },
  { id: "cloud-golden-ribbon", label: "Gold ribbon", src: "/lab-assets/clouds/golden-ribbon.png", kind: "cloud", angle: -39, radius: .86, top: 11, depth: .72, scale: 1, drift: .18, width: "clamp(180px, 25vw, 460px)" },
  { id: "cloud-lavender-puff", label: "Lavender", src: "/lab-assets/clouds/lavender-puff.png", kind: "cloud", angle: -20, radius: .76, top: 32, depth: .82, scale: 1, drift: .14, width: "clamp(100px, 15vw, 260px)" },
  { id: "cloud-tower-glow", label: "Glow tower", src: "/lab-assets/clouds/tower-glow.png", kind: "cloud", angle: 2, radius: .79, top: 9, depth: .68, scale: 1, drift: .1, width: "clamp(110px, 17vw, 300px)" },
  { id: "cloud-wing-sunset", label: "Sunset wing", src: "/lab-assets/clouds/wing-sunset.png", kind: "cloud", angle: 31, radius: .9, top: 15, depth: .76, scale: 1, drift: .16, width: "clamp(170px, 23vw, 420px)" },
  { id: "cloud-cumulus-right", label: "Cumulus R", src: "/lab-assets/clouds/cumulus-right.png", kind: "cloud", angle: 59, radius: 1.08, top: 21, depth: .3, scale: 1, drift: .12, width: "clamp(190px, 29vw, 520px)" },
  { id: "cloud-violet-bank", label: "Violet bank", src: "/lab-assets/clouds/violet-bank.png", kind: "cloud", angle: -53, radius: 1.03, top: 69, depth: .58, scale: 1, drift: .1, width: "clamp(210px, 32vw, 590px)" },
  { id: "cloud-garden-cumulus", label: "Garden", src: "/lab-assets/clouds/garden-cumulus.png", kind: "cloud", angle: -4, radius: .82, top: 66, depth: .63, scale: 1, drift: .17, width: "clamp(135px, 19vw, 340px)" },
  { id: "cloud-bottom-cumulus", label: "Bottom cloud", src: "/lab-assets/clouds/bottom-cumulus.png", kind: "cloud", angle: 46, radius: 1.14, top: 76, depth: .43, scale: 1, drift: .13, width: "clamp(220px, 34vw, 620px)" },
  { id: "cloud-streak-large", label: "Long streak", src: "/lab-assets/clouds/streak-large.png", kind: "cloud", angle: 69, radius: 1.2, top: 51, depth: .57, scale: 1, drift: .2, width: "clamp(230px, 35vw, 650px)" },
  { id: "cloud-ribbon-middle", label: "Mid ribbon", src: "/lab-assets/clouds/ribbon-middle.png", kind: "cloud", angle: 14, radius: .74, top: 46, depth: .88, scale: 1, drift: .15, width: "clamp(145px, 21vw, 380px)" },
  { id: "cloud-pink-islet", label: "Pink islet", src: "/lab-assets/clouds/pink-islet.png", kind: "cloud", angle: -31, radius: .72, top: 49, depth: .9, scale: 1, drift: .12, width: "clamp(86px, 13vw, 230px)" },
];

const BACKGROUND_ISLANDS: readonly SpriteSpec[] = [
  { id: "hd-tree-island", label: "Tree island", src: "/lab-assets/platform-hires/tree-island-hd.png", kind: "island", angle: -49, radius: 1.08, top: 42, depth: .2, scale: 1, drift: .42, width: "clamp(210px, 28vw, 510px)" },
  { id: "hd-waterfall-island", label: "Waterfall", src: "/lab-assets/platform-hires/waterfall-shrine-hd.png", kind: "island", angle: 5, radius: .94, top: 49, depth: .3, scale: 1, drift: .36, width: "clamp(180px, 23vw, 420px)" },
  { id: "hd-castle-island", label: "Castle island", src: "/lab-assets/platform-hires/castle-island-hd.png", kind: "island", angle: 52, radius: 1.12, top: 39, depth: .16, scale: 1, drift: .3, width: "clamp(220px, 30vw, 550px)" },
];

const SPRITE_SPECS = [...CLOUDS, ...BACKGROUND_ISLANDS, ...FLOATERS] as const;
const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const DAMPING = 2.6;
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let sprites: SpriteState[] = [];
let selected: SpriteState | undefined;
let drag: { sprite: SpriteState; pointerId: number } | undefined;
let currentYaw = 0;
let targetYaw = 0;
let previousTimestamp: number | undefined;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function select(sprite: SpriteState) {
  selected?.element.classList.remove("is-selected");
  selected = sprite;
  sprite.element.classList.add("is-selected");
  depthInput.value = String(sprite.depth);
  scaleInput.value = String(sprite.scale);
  depthOutput.value = sprite.depth.toFixed(2);
  scaleOutput.value = `${sprite.scale.toFixed(2)}×`;
  selectedReadout.textContent = sprite.id;
  status.textContent = `${sprite.label} selected · drag to change its polar placement`;
  tray.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.spriteId === sprite.id);
  });
}

function setFromPointer(event: PointerEvent, sprite: SpriteState) {
  const rect = stage.getBoundingClientRect();
  const normalizedX = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width * .48), -1, 1);
  const localAngle = Math.asin(clamp(normalizedX / sprite.radius, -1, 1)) * RADIANS_TO_DEGREES;
  sprite.angle = localAngle + currentYaw;
  sprite.top = clamp((event.clientY - rect.top) / rect.height * 100, 7, 92);
}

function loadSprites() {
  let loadedCount = 0;
  sprites = SPRITE_SPECS.map((spec, index) => {
    const image = document.createElement("img");
    image.src = spec.src;
    image.alt = spec.label;
    image.draggable = false;
    image.className = `floater-sprite floater-sprite--${spec.kind}`;
    image.style.width = spec.width;
    image.addEventListener("load", () => {
      loadedCount += 1;
      element("sprite-count").textContent = `${loadedCount} / ${SPRITE_SPECS.length}`;
      if (loadedCount === SPRITE_SPECS.length) {
        status.textContent = "Ready · Look left/right to orbit every sprite through x and z";
      }
    });
    image.addEventListener("error", () => {
      image.classList.add("has-error");
      status.textContent = `Could not load ${spec.id}`;
    });
    stage.appendChild(image);

    const state: SpriteState = {
      ...spec,
      element: image,
      phase: index * 1.31,
      worldX: 0,
      worldZ: 0,
    };
    const choice = document.createElement("button");
    choice.type = "button";
    choice.dataset.spriteId = spec.id;
    choice.dataset.kind = spec.kind;
    choice.className = "sprite-choice";
    choice.title = `Select ${spec.label}`;
    choice.innerHTML = `<img alt="" src="${spec.src}"><span>${spec.label}</span>`;
    choice.addEventListener("click", () => select(state));
    tray.appendChild(choice);

    image.addEventListener("pointerdown", (event) => {
      select(state);
      drag = { sprite: state, pointerId: event.pointerId };
      image.setPointerCapture(event.pointerId);
      setFromPointer(event, state);
    });
    image.addEventListener("pointermove", (event) => {
      if (drag?.pointerId === event.pointerId && drag.sprite === state) {
        setFromPointer(event, state);
      }
    });
    image.addEventListener("pointerup", (event) => {
      if (drag?.pointerId === event.pointerId) drag = undefined;
    });
    image.addEventListener("pointercancel", (event) => {
      if (drag?.pointerId === event.pointerId) drag = undefined;
    });
    return state;
  });
  if (sprites[0]) select(sprites[0]);
}

function setTargetYaw(value: number) {
  targetYaw = clamp(value, -50, 50);
  yaw.value = String(targetYaw);
  yawOutput.value = `${Math.round(targetYaw)}° target`;
  status.textContent = targetYaw === 0
    ? "Returning to the center pivot"
    : `Pivoting ${targetYaw < 0 ? "left" : "right"} · x and z are damped`;
}

yaw.addEventListener("input", () => setTargetYaw(Number(yaw.value)));
depthInput.addEventListener("input", () => {
  if (!selected) return;
  selected.depth = Number(depthInput.value);
  depthOutput.value = selected.depth.toFixed(2);
});
scaleInput.addEventListener("input", () => {
  if (!selected) return;
  selected.scale = Number(scaleInput.value);
  scaleOutput.value = `${selected.scale.toFixed(2)}×`;
});

element("reset").addEventListener("click", () => {
  sprites.forEach((sprite, index) => {
    const initial = SPRITE_SPECS[index];
    if (!initial) return;
    sprite.angle = initial.angle;
    sprite.radius = initial.radius;
    sprite.top = initial.top;
    sprite.depth = initial.depth;
    sprite.scale = initial.scale;
  });
  currentYaw = 0;
  setTargetYaw(0);
  if (sprites[0]) select(sprites[0]);
});

element("yaw-left").addEventListener("click", () => setTargetYaw(-38));
element("yaw-center").addEventListener("click", () => setTargetYaw(0));
element("yaw-right").addEventListener("click", () => setTargetYaw(38));

function render(timestamp: number) {
  const deltaSeconds = Math.min(.05, Math.max(0, (timestamp - (previousTimestamp ?? timestamp)) / 1000));
  previousTimestamp = timestamp;
  const blend = reduceMotionQuery.matches ? 1 : 1 - Math.exp(-DAMPING * deltaSeconds);
  currentYaw += (targetYaw - currentYaw) * blend;
  if (Math.abs(targetYaw - currentYaw) < .005) currentYaw = targetYaw;
  yawReadout.textContent = `${currentYaw.toFixed(1)}°`;

  const stageWidth = stage.clientWidth;
  sprites.forEach((sprite) => {
    const ambientPhase = timestamp * .0001 * (1 + sprite.drift) + sprite.phase;
    const ambientAngle = animateToggle.checked && !reduceMotionQuery.matches
      ? Math.sin(ambientPhase) * sprite.drift * 3.2
      : 0;
    const ambientRadius = animateToggle.checked && !reduceMotionQuery.matches
      ? Math.cos(ambientPhase * .73) * sprite.drift * .025
      : 0;
    const theta = (sprite.angle + ambientAngle - currentYaw) * DEGREES_TO_RADIANS;
    const radius = sprite.radius + ambientRadius;
    const worldX = Math.sin(theta) * radius;
    const worldZ = Math.cos(theta) * radius;
    const orbitDepth = clamp((worldZ + 1.2) / 2.4, 0, 1);
    const nearness = clamp((1 - sprite.depth) * .58 + orbitDepth * .42, 0, 1);
    const screenX = worldX * stageWidth * .48;
    const idleAmplitude = sprite.kind === "cloud"
      ? 2 + sprite.drift * 5
      : sprite.kind === "island"
        ? 6 + sprite.drift * 9
        : 5 + sprite.drift * 10;
    const screenY = animateToggle.checked && !reduceMotionQuery.matches
      ? Math.sin(ambientPhase * 1.37) * idleAmplitude
      : 0;
    const perspectiveScale = .58 + nearness * .64;

    sprite.worldX = worldX;
    sprite.worldZ = worldZ;
    sprite.element.style.left = "50%";
    sprite.element.style.top = `${sprite.top}%`;
    sprite.element.style.zIndex = String(Math.round(2 + nearness * 90));
    sprite.element.style.opacity = String(.4 + nearness * .6);
    sprite.element.style.transform = `translate(-50%, -50%) translate3d(${screenX.toFixed(2)}px, ${screenY.toFixed(2)}px, 0) scale(${(sprite.scale * perspectiveScale).toFixed(4)})`;
  });

  if (selected) {
    selectedXReadout.textContent = selected.worldX.toFixed(2);
    selectedZReadout.textContent = selected.worldZ.toFixed(2);
  }
  window.requestAnimationFrame(render);
}

loadSprites();
window.requestAnimationFrame(render);
