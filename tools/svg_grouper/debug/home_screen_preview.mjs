// Offline approximation of the home screen reveal so the composition can be
// judged without a browser -- keep DROPS/GROW in step with HomeScreen.tsx and
// this prints the frames the animation passes through.
//
//   node preview.mjs [outdir]
//
// sharp lives in this folder, which is why the script does too.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, "../../../apps/web/public");
const OUT = process.argv[2] ?? path.join(HERE, "home-preview");
fs.mkdirSync(OUT, { recursive: true });
const W = 1600, H = 900, ASPECT = 668 / 720;
const P = 700; // pad so rotated drop layers never exceed the canvas
const GROW = 1400;

const DROPS = [
  { cx: 800, cy: 380, size: 720, rotate: -12, delay: 0, hue: 0 },
  { cx: 330, cy: 300, size: 600, rotate: 148, delay: 900, hue: -18 },
  { cx: 1240, cy: 430, size: 660, rotate: 62, delay: 1450, hue: 12 },
  { cx: 620, cy: 760, size: 560, rotate: -104, delay: 1900, hue: 24 },
  { cx: 1480, cy: 760, size: 540, rotate: 24, delay: 2500, hue: -30 },
  { cx: 150, cy: 720, size: 580, rotate: -158, delay: 2900, hue: 8 },
  { cx: 1030, cy: 120, size: 480, rotate: 96, delay: 3450, hue: -12 },
  { cx: 430, cy: 60, size: 460, rotate: -46, delay: 3900, hue: 18 },
];

const road = await sharp(`${PUB}/home/road-backdrop.webp`)
  .resize(W, H, { fit: "cover" }).png().toBuffer();

const crop = (buf) => sharp(buf).extract({ left: P, top: P, width: W, height: H }).png().toBuffer();

const pad = (layers) =>
  sharp({ create: { width: W + 2 * P, height: H + 2 * P, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png().toBuffer();

/** Placed layers for every drop, scaled to its bloom progress at time `t`. */
async function layers(t, src, { hue = false } = {}) {
  const placed = [];
  for (const d of DROPS) {
    const p = Math.min(1, Math.max(0, (t - d.delay) / GROW));
    if (p <= 0) continue;
    const scale = 0.12 + 0.88 * p; // matches the bloom keyframes
    const h = Math.round(d.size * scale), w = Math.round(d.size * ASPECT * scale);
    let img = sharp(src).resize(w, h, { fit: "fill" })
      .rotate(d.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (hue) img = img.modulate({ hue: d.hue });
    const buf = await img.png().toBuffer();
    const meta = await sharp(buf).metadata();
    placed.push({
      input: buf,
      left: Math.round(d.cx - meta.width / 2) + P,
      top: Math.round(d.cy - meta.height / 2) + P,
    });
  }
  return placed;
}

function titleSvg(opacity) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="${W / 2}" y="${H * 0.14 + 76}" text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif" font-size="84" font-weight="700"
          letter-spacing="3.4" fill="#f4e4bd" fill-opacity="${opacity}"
          style="paint-order:stroke" stroke="rgba(28,20,12,.55)" stroke-width="3">Conquer Your Path</text>
  </svg>`);
}

async function frame(t, name, { fill = 0, ink = 1, title = 1 } = {}) {
  const maskLayers = await layers(t, `${PUB}/home/wash-mask.webp`);
  const revealed = maskLayers.length
    ? await sharp(road).composite([{ input: await crop(await pad(maskLayers)), blend: "dest-in" }]).png().toBuffer()
    : null;

  const stack = [];
  if (revealed) stack.push({ input: revealed });
  if (fill > 0) stack.push({ input: await sharp(road).ensureAlpha(fill).png().toBuffer() });
  if (ink > 0) {
    const inkLayers = await layers(t, `${PUB}/home/wash-01.webp`, { hue: true });
    if (inkLayers.length) stack.push({ input: await sharp(await crop(await pad(inkLayers))).ensureAlpha(ink).png().toBuffer() });
  }
  if (title > 0) stack.push({ input: titleSvg(title) });

  // The plate, at the same clamp(280,30vw,430) width and 18vh from the bottom.
  const plateW = Math.round(Math.min(430, Math.max(280, W * 0.3)));
  const plate = await sharp(`${PUB}/home/panel-start.svg`, { density: 300 }).resize({ width: plateW }).png().toBuffer();
  const pm = await sharp(plate).metadata();
  stack.push({ input: plate, left: Math.round((W - pm.width) / 2), top: Math.round(H - H * 0.18 - pm.height) });

  await sharp({ create: { width: W, height: H, channels: 4, background: "#7eb2d2" } })
    .composite(stack).png().toFile(`${OUT}/${name}.png`);
  console.log(name.padEnd(16), "t=" + t + "ms");
}

await frame(1400, "frame-a-first", { fill: 0, ink: 1, title: 1 });
await frame(2900, "frame-b-mid", { fill: 0, ink: 1, title: 1 });
await frame(6200, "frame-c-final", { fill: 1, ink: 0, title: 1 });
