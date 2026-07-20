#!/usr/bin/env node
/**
 * Renders `tools/pixel/anim-preview.png`: a horizontal 4-frame strip (8x,
 * labeled) for every animatable sprite — anything with a `blades` part
 * (grass `sway`) or a packet `body` part (`flight`) — using the exact same
 * remap math as the runtime animator.
 *
 * KEEP IN SYNC with `packages/ui/src/sprites/pixel/animate.ts` — this file
 * ports `remapSway`/`remapFlight`/`squashVertical`/`modeColorExcluding` into
 * plain JS so the node-side preview doesn't need a TS loader. Any change to
 * the transform math in `animate.ts` must be mirrored here (and vice versa).
 *
 * Run with `npm run sprites:anim`.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { loadSprites } from './compile.mjs';
import { hexToRgb, setPixel, drawChecker, textWidth, drawText } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PNG = join(__dirname, 'anim-preview.png');

// ---------------------------------------------------------------------------
// Ported transform math — mirrors packages/ui/src/sprites/pixel/animate.ts
// ---------------------------------------------------------------------------

const SWAY_TABLE = [0, 1, 0, -1];

function modeColorExcluding(data, excludeIdx) {
  const exclude = new Set(excludeIdx);
  const counts = new Map();
  data.forEach((v, i) => {
    if (v === -1 || exclude.has(i)) return;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  });
  let best = 0;
  let bestCount = -1;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

function remapSway(sprite, frame) {
  const size = sprite.size;
  const bladeIdx = sprite.parts.blades ?? [];
  const grid = sprite.data.slice();
  if (bladeIdx.length === 0) return grid;

  const baseColor = modeColorExcluding(sprite.data, bladeIdx);
  for (const idx of bladeIdx) grid[idx] = baseColor;
  for (const idx of bladeIdx) {
    const row = Math.floor(idx / size);
    const col = idx % size;
    const dx = SWAY_TABLE[(col + frame) % SWAY_TABLE.length];
    const newCol = Math.min(size - 1, Math.max(0, col + dx));
    grid[row * size + newCol] = sprite.data[idx];
  }
  return grid;
}

function squashVertical(grid, size, indices) {
  const byCol = new Map();
  for (const idx of indices) {
    const row = Math.floor(idx / size);
    const col = idx % size;
    const rows = byCol.get(col) ?? [];
    rows.push(row);
    byCol.set(col, rows);
  }

  const out = grid.slice();
  for (const [col, rows] of byCol) {
    rows.sort((a, b) => a - b);
    const minRow = rows[0];
    const maxRow = rows[rows.length - 1];
    const height = maxRow - minRow + 1;
    const newHeight = Math.max(1, height - 1);
    for (const row of rows) out[row * size + col] = -1;
    for (const row of rows) {
      const newRow =
        height <= 1 ? row : maxRow - Math.round(((maxRow - row) * (newHeight - 1)) / (height - 1));
      out[newRow * size + col] = grid[row * size + col];
    }
  }
  return out;
}

function remapFlight(sprite, frame) {
  const size = sprite.size;
  const bodyIdx = sprite.parts.body ?? [];
  const glintIdx = sprite.parts.glint ?? [];
  let grid = sprite.data.slice();

  if (glintIdx.length > 0) {
    const origIdx = glintIdx[0];
    const row0 = Math.floor(origIdx / size);
    const col0 = origIdx % size;
    const loop = [
      [row0, col0],
      [row0, col0 + 1],
      [row0 + 1, col0 + 1],
      [row0 + 1, col0],
    ];
    const glintColor = sprite.data[origIdx];
    const fillColor = sprite.data[origIdx + 1] ?? glintColor;
    grid[origIdx] = fillColor;
    const [lr, lc] = loop[frame % loop.length];
    const nr = Math.min(size - 1, Math.max(0, lr));
    const nc = Math.min(size - 1, Math.max(0, lc));
    grid[nr * size + nc] = glintColor;
  }

  if ((frame === 1 || frame === 3) && bodyIdx.length > 0) {
    grid = squashVertical(grid, size, bodyIdx);
  }

  return grid;
}

const FRAME_COUNT = 4;

function remapGrid(sprite, anim, frame) {
  return anim === 'sway' ? remapSway(sprite, frame) : remapFlight(sprite, frame);
}

// ---------------------------------------------------------------------------
// Bitmap font + PNG helpers now live in ./lib.mjs (shared with compile.mjs
// and tools/levels/render-levels.mjs). FONT_H is still needed locally below.
// ---------------------------------------------------------------------------

const FONT_H = 5;

function drawSpriteFrame(png, sprite, grid, x0, y0, scale) {
  for (let py = 0; py < sprite.size; py++) {
    for (let px = 0; px < sprite.size; px++) {
      const idx = grid[py * sprite.size + px];
      if (idx === -1 || idx === undefined) continue;
      const { r, g, b } = hexToRgb(sprite.palette[idx]);
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          setPixel(png, x0 + px * scale + sx, y0 + py * scale + sy, r, g, b, 255);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const { sprites } = loadSprites();

  const rows = [];
  for (const [name, sprite] of [...sprites.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if ((sprite.parts.blades ?? []).length > 0) rows.push({ name, sprite, anim: 'sway' });
    else if ((sprite.parts.body ?? []).length > 0) rows.push({ name, sprite, anim: 'flight' });
  }

  if (rows.length === 0) {
    console.log('sprites:anim — no animatable sprites found (need a "blades" or "body" part)');
    return;
  }

  const SCALE = 8;
  const LABEL_SCALE = 2;
  const PAD = 12;
  const LABEL_H = FONT_H * LABEL_SCALE + 6;
  const maxSize = rows.reduce((m, r) => Math.max(m, r.sprite.size), 1);
  const frameW = maxSize * SCALE + PAD;
  const rowLabelW = 140;
  const rowH = maxSize * SCALE + PAD * 2 + LABEL_H;

  const width = rowLabelW + FRAME_COUNT * frameW + PAD;
  const height = rows.length * rowH;

  const png = new PNG({ width, height });
  drawChecker(png);

  rows.forEach((row, ri) => {
    const y0 = ri * rowH;
    const labelText = `${row.name} : ${row.anim}`;
    drawText(png, labelText, PAD, y0 + Math.floor(rowH / 2) - Math.floor((FONT_H * LABEL_SCALE) / 2), LABEL_SCALE, {
      r: 245,
      g: 232,
      b: 213,
    });

    for (let f = 0; f < FRAME_COUNT; f++) {
      const grid = remapGrid(row.sprite, row.anim, f);
      const cellX = rowLabelW + f * frameW;
      const spriteX = cellX + Math.floor((frameW - row.sprite.size * SCALE) / 2);
      const spriteY = y0 + PAD;
      drawSpriteFrame(png, row.sprite, grid, spriteX, spriteY, SCALE);
      const label = `f${f}`;
      const tw = textWidth(label, LABEL_SCALE);
      const labelX = cellX + Math.max(0, Math.floor((frameW - tw) / 2));
      drawText(png, label, labelX, spriteY + row.sprite.size * SCALE + 6, LABEL_SCALE, { r: 200, g: 210, b: 220 });
    }
  });

  writeFileSync(OUT_PNG, PNG.sync.write(png));
  console.log(`sprites:anim — rendered ${rows.length} animated strip(s) (${FRAME_COUNT} frames each)`);
  console.log(`  -> ${OUT_PNG}`);
}

main();
