import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace
} from "three";

export type ProceduralTextureKind = "parchment" | "stone" | "foliage" | "trim";

export interface ProceduralTextureOptions {
  readonly size?: number;
  readonly seed?: number;
  readonly anisotropy?: number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createCanvas(size: number): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new Error("Procedural textures require a browser canvas.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function paintParchment(context: CanvasRenderingContext2D, size: number, random: () => number): void {
  context.fillStyle = "#eadab5";
  context.fillRect(0, 0, size, size);
  for (let index = 0; index < size * 3; index += 1) {
    const alpha = 0.025 + random() * 0.045;
    context.fillStyle = random() > 0.55 ? `rgba(255,247,215,${alpha})` : `rgba(70,52,34,${alpha})`;
    const radius = 0.5 + random() * 2.5;
    context.beginPath();
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = "rgba(91,66,42,.055)";
  context.lineWidth = Math.max(1, size / 256);
  for (let index = 0; index < 22; index += 1) {
    const y = random() * size;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(size * 0.3, y + random() * 5, size * 0.7, y - random() * 5, size, y);
    context.stroke();
  }
}

function paintStone(context: CanvasRenderingContext2D, size: number, random: () => number): void {
  context.fillStyle = "#4b6664";
  context.fillRect(0, 0, size, size);
  const cell = Math.max(22, Math.floor(size / 8));
  context.lineWidth = Math.max(1.5, size / 190);
  for (let row = -1; row < Math.ceil(size / cell) + 1; row += 1) {
    const offset = row % 2 === 0 ? -cell * 0.5 : 0;
    for (let column = -1; column < Math.ceil(size / cell) + 1; column += 1) {
      const x = column * cell + offset + (random() - 0.5) * 5;
      const y = row * cell + (random() - 0.5) * 4;
      context.strokeStyle = "rgba(26,52,55,.3)";
      context.strokeRect(x, y, cell + random() * 4, cell * 0.68 + random() * 3);
      context.strokeStyle = "rgba(185,205,181,.08)";
      context.beginPath();
      context.moveTo(x + 2, y + 2);
      context.lineTo(x + cell - 2, y + 2);
      context.stroke();
    }
  }
}

function paintFoliage(context: CanvasRenderingContext2D, size: number, random: () => number): void {
  context.fillStyle = "#617f51";
  context.fillRect(0, 0, size, size);
  for (let index = 0; index < size * 1.4; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const length = 3 + random() * 8;
    context.strokeStyle = random() > 0.48 ? "rgba(182,214,140,.15)" : "rgba(35,66,43,.13)";
    context.lineWidth = 0.6 + random() * 1.3;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + (random() - 0.5) * length, y - length * 0.5, x + (random() - 0.5) * length, y - length);
    context.stroke();
  }
}

function paintTrim(context: CanvasRenderingContext2D, size: number, random: () => number): void {
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#f4cf7b");
  gradient.addColorStop(0.48, "#c8964e");
  gradient.addColorStop(1, "#ebbd67");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  context.fillStyle = "rgba(82,56,31,.1)";
  for (let index = 0; index < size * 0.75; index += 1) {
    context.fillRect(random() * size, random() * size, 1 + random() * 3, 0.5 + random());
  }
  context.strokeStyle = "rgba(255,240,178,.16)";
  context.lineWidth = Math.max(1, size / 180);
  for (let stripe = 0; stripe < size; stripe += Math.max(8, size / 20)) {
    context.beginPath();
    context.moveTo(stripe, 0);
    context.lineTo(stripe + size * 0.2, size);
    context.stroke();
  }
}

export function createProceduralTexture(
  kind: ProceduralTextureKind,
  options: ProceduralTextureOptions = {}
): CanvasTexture {
  const size = Math.max(32, Math.floor(options.size ?? 256));
  const canvas = createCanvas(size);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create a 2D canvas context.");
  const random = seededRandom(options.seed ?? 34129);
  if (kind === "parchment") paintParchment(context, size, random);
  if (kind === "stone") paintStone(context, size, random);
  if (kind === "foliage") paintFoliage(context, size, random);
  if (kind === "trim") paintTrim(context, size, random);
  const texture = new CanvasTexture(canvas);
  texture.name = `fantasy-${kind}-procedural`;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(kind === "parchment" ? 1 : 2, kind === "parchment" ? 1 : 2);
  texture.anisotropy = Math.max(1, options.anisotropy ?? 1);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}
