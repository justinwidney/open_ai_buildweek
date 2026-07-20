#!/usr/bin/env node
/**
 * Pixel toolchain for Connected Kingdom.
 *
 * Reads every `.pxl` file under packages/ui/src/sprites/pixel/, validates it,
 * and produces two artifacts:
 *
 *   1. packages/ui/src/sprites/pixel/generated.ts
 *      A typed `pixelSprites: Record<string, PixelSprite>` map consumed by
 *      `fromPixelSprite()` at render time.
 *
 *   2. tools/pixel/preview.png + tools/pixel/preview.json
 *      A labeled grid of every sprite at 8x nearest-neighbor scale on a
 *      neutral checker background, so the pixel artist (human or agent) can
 *      visually inspect every sprite in one place after each build.
 *
 * Run with `npm run sprites:build`.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { FONT, FONT_W, FONT_H, hexToRgb, blend, setPixel, drawChecker, textWidth, drawText } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const PXL_DIR = join(REPO_ROOT, 'packages', 'ui', 'src', 'sprites', 'pixel');
const GENERATED_PATH = join(PXL_DIR, 'generated.ts');
const PREVIEW_PNG_PATH = join(__dirname, 'preview.png');
const PREVIEW_JSON_PATH = join(__dirname, 'preview.json');
const TOKENS_PATH = join(__dirname, 'tokens.json');
// Keep source sizes compatible with fromPixelSprite(), which scales every
// sprite into the shared 256px logical canvas using an integer pixel factor.
const LOGICAL_SPRITE_PX = 256;

// ---------------------------------------------------------------------------
// Design tokens ($group.name -> #RRGGBB), see docs/DESIGN_TOKENS.md
// ---------------------------------------------------------------------------

/** Loads tools/pixel/tokens.json into a flat Map<"group.name", "#RRGGBB">. */
function loadTokens() {
  let raw;
  try {
    raw = readFileSync(TOKENS_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return new Map();
    throw err;
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${TOKENS_PATH} — invalid JSON: ${err.message}`);
  }
  const tokens = new Map();
  for (const [group, entries] of Object.entries(json)) {
    for (const [name, hex] of Object.entries(entries)) {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        throw new Error(`${TOKENS_PATH} — token "${group}.${name}" has invalid hex value "${hex}"`);
      }
      tokens.set(`${group}.${name}`, hex.toUpperCase());
    }
  }
  return tokens;
}

/** Resolves a "$group.name" reference against the loaded token map, throwing
 * a helpful PxlError (including the full list of known tokens) if unknown. */
function resolveToken(ref, tokens, filePath, lineNo) {
  const path = ref.slice(1); // strip leading "$"
  const hex = tokens.get(path);
  if (hex === undefined) {
    const known = [...tokens.keys()].sort().join(', ') || '(none loaded — is tools/pixel/tokens.json missing?)';
    throw new PxlError(filePath, lineNo, `unknown color token "${ref}" — known tokens: ${known}`);
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

class PxlError extends Error {
  constructor(filePath, lineNo, message) {
    const where = lineNo ? `${filePath}:${lineNo}` : filePath;
    super(`${where} — ${message}`);
    this.name = 'PxlError';
  }
}

// ---------------------------------------------------------------------------
// .pxl parser
// ---------------------------------------------------------------------------

/**
 * Parses one `.pxl` file's text into { name, size, palette, data }.
 * `palette` is an ordered array of hex strings (index = palette index used
 * in `data`). `data` is row-major palette indices, -1 for transparent.
 */
function parsePxl(text, filePath, tokens) {
  const rawLines = text.split(/\r\n|\n/);
  let name = null;
  let size = null;
  const palette = new Map(); // char -> hex
  const paletteOrder = []; // char order == palette index order
  const pixelRows = [];
  const partsLines = []; // { lineNo, tokens }
  let section = 'header'; // 'header' -> 'palette' -> 'parts' -> 'pixels'

  for (let i = 0; i < rawLines.length; i++) {
    const lineNo = i + 1;
    const line = rawLines[i];

    if (section === 'pixels') {
      if (line.trim() === '' && pixelRows.length >= (size ?? Infinity)) continue;
      if (line.trim() === '') continue; // tolerate stray blank lines
      pixelRows.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed === '') continue;

    const nameMatch = trimmed.match(/^#\s*name:\s*(.+)$/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
      continue;
    }
    const sizeMatch = trimmed.match(/^#\s*size:\s*(\d+)\s*$/i);
    if (sizeMatch) {
      size = parseInt(sizeMatch[1], 10);
      continue;
    }
    if (trimmed.startsWith('#')) continue; // plain comment

    if (trimmed === 'palette:') {
      section = 'palette';
      continue;
    }
    if (trimmed === 'parts:') {
      section = 'parts';
      continue;
    }
    if (trimmed === 'pixels:') {
      if (name == null) throw new PxlError(filePath, lineNo, 'missing "# name: <name>" header before "pixels:"');
      if (size == null) throw new PxlError(filePath, lineNo, 'missing "# size: <n>" header before "pixels:"');
      section = 'pixels';
      continue;
    }

    if (section === 'palette') {
      const m = trimmed.match(/^(\S)\s+(#[0-9a-fA-F]{6}|\$[A-Za-z0-9_.]+)$/);
      if (!m) {
        throw new PxlError(
          filePath,
          lineNo,
          `invalid palette line "${trimmed}" — expected "<char> #RRGGBB" or "<char> $token.name"`,
        );
      }
      const [, ch, value] = m;
      if (ch === '_') {
        throw new PxlError(filePath, lineNo, '"_" is reserved for transparent and cannot be given a color');
      }
      if (palette.has(ch)) {
        throw new PxlError(filePath, lineNo, `duplicate palette char "${ch}"`);
      }
      const hex = value.startsWith('$') ? resolveToken(value, tokens, filePath, lineNo) : value.toUpperCase();
      palette.set(ch, hex);
      paletteOrder.push(ch);
      continue;
    }

    if (section === 'parts') {
      const tokens = trimmed.split(/\s+/);
      if (tokens.length < 2) {
        throw new PxlError(
          filePath,
          lineNo,
          `invalid parts line "${trimmed}" — expected "<partName> <char> [char ...]"`,
        );
      }
      partsLines.push({ lineNo, tokens });
      continue;
    }

    throw new PxlError(
      filePath,
      lineNo,
      `unexpected line "${trimmed}" — expected "palette:", "parts:", or "pixels:" section header`,
    );
  }

  if (name == null) throw new PxlError(filePath, null, 'missing "# name: <name>" header');
  if (size == null) throw new PxlError(filePath, null, 'missing "# size: <n>" header');
  if (!Number.isInteger(size) || size <= 0) {
    throw new PxlError(filePath, null, `"# size: ${size}" must be a positive integer`);
  }
  if (LOGICAL_SPRITE_PX % size !== 0) {
    throw new PxlError(filePath, null, `"# size: ${size}" must divide ${LOGICAL_SPRITE_PX} so runtime scaling stays pixel-perfect`);
  }
  if (pixelRows.length !== size) {
    throw new PxlError(
      filePath,
      null,
      `expected ${size} pixel rows under "pixels:", got ${pixelRows.length}`,
    );
  }

  const data = new Array(size * size);
  pixelRows.forEach((row, r) => {
    if (row.length !== size) {
      throw new PxlError(
        filePath,
        null,
        `pixel row ${r} has length ${row.length}, expected ${size}: "${row}"`,
      );
    }
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '_') {
        data[r * size + c] = -1;
        continue;
      }
      const idx = paletteOrder.indexOf(ch);
      if (idx === -1) {
        throw new PxlError(
          filePath,
          null,
          `pixel row ${r}, col ${c} uses undefined palette char "${ch}" (declare it in "palette:" or use "_" for transparent)`,
        );
      }
      data[r * size + c] = idx;
    }
  });

  // Resolve parts: partName -> char[] -> row-major pixel indices whose
  // palette char is in that part's char set. Validated against the palette
  // (and against "_", which can't belong to a part).
  const parts = {};
  const seenPartNames = new Set();
  for (const { lineNo, tokens } of partsLines) {
    const [partName, ...chars] = tokens;
    if (seenPartNames.has(partName)) {
      throw new PxlError(filePath, lineNo, `duplicate part name "${partName}"`);
    }
    seenPartNames.add(partName);
    const charSet = new Set();
    for (const ch of chars) {
      if (ch === '_') {
        throw new PxlError(filePath, lineNo, `part "${partName}" cannot reference "_" (transparent isn't a pixel)`);
      }
      if (!palette.has(ch)) {
        throw new PxlError(
          filePath,
          lineNo,
          `part "${partName}" references undefined palette char "${ch}" (declare it in "palette:")`,
        );
      }
      charSet.add(ch);
    }
    const indices = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const ch = pixelRows[r][c];
        if (charSet.has(ch)) indices.push(r * size + c);
      }
    }
    parts[partName] = indices;
  }

  return { name, size, palette: paletteOrder.map((ch) => palette.get(ch)), data, parts };
}

// ---------------------------------------------------------------------------
// Frame grouping: "<base>.f1.pxl", "<base>.f2.pxl", ... are extra animation
// frames of "<base>". Frame 0 is always the base sprite itself (no ".fN."
// suffix). Returns a Map<baseName, string[]> (ordered frame sprite names,
// index 0 = base) for every base that has at least one extra frame file.
// ---------------------------------------------------------------------------

const FRAME_SUFFIX_RE = /^(.+)\.f(\d+)$/;

function groupFrames(sprites, fileBaseNames) {
  // fileBaseNames: Map<spriteName, fileStemWithoutExt> so we can detect the
  // ".fN" suffix on the *file*, independent of what the sprite's own
  // "# name:" happens to be.
  const framesByBase = new Map(); // baseSpriteName -> Map<frameIndex, spriteName>

  for (const [spriteName, stem] of fileBaseNames) {
    const m = stem.match(FRAME_SUFFIX_RE);
    if (!m) continue;
    const [, baseStem, frameNoStr] = m;
    const frameNo = parseInt(frameNoStr, 10);
    if (frameNo <= 0) {
      throw new PxlError(spriteName, null, `frame file "${stem}.pxl" must use frame index >= 1 (frame 0 is the base sprite)`);
    }
    // The base sprite is whichever sprite came from a file stem equal to
    // baseStem (not baseStem.fN).
    const baseEntry = [...fileBaseNames.entries()].find(([, s]) => s === baseStem);
    if (!baseEntry) {
      throw new PxlError(
        spriteName,
        null,
        `frame file "${stem}.pxl" has no base file "${baseStem}.pxl"`,
      );
    }
    const [baseSpriteName] = baseEntry;
    const baseSprite = sprites.get(baseSpriteName);
    const frameSprite = sprites.get(spriteName);
    if (baseSprite.size !== frameSprite.size) {
      throw new PxlError(
        spriteName,
        null,
        `frame "${spriteName}" size (${frameSprite.size}) doesn't match base "${baseSpriteName}" size (${baseSprite.size})`,
      );
    }
    if (!framesByBase.has(baseSpriteName)) framesByBase.set(baseSpriteName, new Map());
    const byIndex = framesByBase.get(baseSpriteName);
    if (byIndex.has(frameNo)) {
      throw new PxlError(spriteName, null, `duplicate frame index ${frameNo} for base "${baseSpriteName}"`);
    }
    byIndex.set(frameNo, spriteName);
  }

  const frames = new Map();
  for (const [baseSpriteName, byIndex] of framesByBase) {
    const maxIndex = Math.max(...byIndex.keys());
    const ordered = [baseSpriteName];
    for (let i = 1; i <= maxIndex; i++) {
      const spriteName = byIndex.get(i);
      if (!spriteName) {
        throw new PxlError(
          baseSpriteName,
          null,
          `frames for "${baseSpriteName}" are missing frame index ${i} (frames must be contiguous starting at 1)`,
        );
      }
      ordered.push(spriteName);
    }
    frames.set(baseSpriteName, ordered);
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Load + validate all sprites
// ---------------------------------------------------------------------------

function loadSprites() {
  const tokens = loadTokens();

  let files;
  try {
    files = readdirSync(PXL_DIR).filter((f) => f.endsWith('.pxl'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      mkdirSync(PXL_DIR, { recursive: true });
      files = [];
    } else {
      throw err;
    }
  }

  const sprites = new Map(); // name -> sprite
  const seenBy = new Map(); // name -> filename (for duplicate-name errors)
  const fileBaseNames = new Map(); // spriteName -> file stem (filename minus ".pxl")

  for (const file of files.sort()) {
    const filePath = join(PXL_DIR, file);
    const text = readFileSync(filePath, 'utf8');
    const sprite = parsePxl(text, filePath, tokens);
    if (sprites.has(sprite.name)) {
      throw new PxlError(
        filePath,
        null,
        `duplicate sprite name "${sprite.name}" (already defined in ${seenBy.get(sprite.name)})`,
      );
    }
    sprites.set(sprite.name, sprite);
    seenBy.set(sprite.name, file);
    fileBaseNames.set(sprite.name, file.slice(0, -'.pxl'.length));
  }

  const frames = groupFrames(sprites, fileBaseNames);

  return { sprites, frames };
}

// ---------------------------------------------------------------------------
// generated.ts emitter
// ---------------------------------------------------------------------------

function emitGeneratedTs(sprites, frames) {
  const names = [...sprites.keys()].sort();
  const entries = names.map((name) => {
    const s = sprites.get(name);
    const paletteLit = JSON.stringify(s.palette);
    const dataLit = `[${s.data.join(',')}]`;
    const partsLit = JSON.stringify(s.parts ?? {});
    return `  ${JSON.stringify(name)}: { size: ${s.size}, palette: ${paletteLit}, data: ${dataLit}, parts: ${partsLit} },`;
  });

  const frameEntries = [...frames.keys()].sort().map((base) => {
    return `  ${JSON.stringify(base)}: ${JSON.stringify(frames.get(base))},`;
  });

  const out = `/**
 * AUTO-GENERATED by tools/pixel/compile.mjs — do not edit by hand.
 * Source of truth: packages/ui/src/sprites/pixel/*.pxl
 * Regenerate with \`npm run sprites:build\`.
 */

export type PixelSprite = {
  size: number;
  palette: string[];
  /** Row-major palette indices; -1 = transparent. */
  data: number[];
  /** Named sub-regions: partName -> row-major pixel indices. Empty if the sprite declares no "parts:" section. */
  parts: Record<string, number[]>;
};

export const pixelSprites: Record<string, PixelSprite> = {
${entries.join('\n')}
};

/**
 * Animation frame groups: base sprite name -> ordered list of sprite names,
 * where index 0 is always the base sprite itself. Populated from
 * "<base>.f1.pxl", "<base>.f2.pxl", ... files. Bases with no extra
 * hand-authored frames are absent from this map (prefer runtime part
 * transforms for those — see the pixel-artist agent doc).
 */
export const pixelFrames: Record<string, string[]> = {
${frameEntries.join('\n')}
};
`;

  writeFileSync(GENERATED_PATH, out, 'utf8');
  return names;
}

// ---------------------------------------------------------------------------
// preview.png / preview.json renderer
// ---------------------------------------------------------------------------
//
// FONT/hexToRgb/setPixel/drawChecker/drawText/textWidth now live in ./lib.mjs
// (shared with animate-preview.mjs and tools/levels/render-levels.mjs).

// Distinct saturated overlay tints, cycled by part index, so each named
// part reads as a different color in the "parts debug" preview copy.
const PART_TINTS = [
  { r: 255, g: 64, b: 64 }, // red
  { r: 64, g: 220, b: 255 }, // cyan
  { r: 255, g: 220, b: 64 }, // yellow
  { r: 140, g: 90, b: 255 }, // violet
  { r: 64, g: 255, b: 140 }, // green
  { r: 255, g: 140, b: 64 }, // orange
  { r: 255, g: 96, b: 220 }, // pink
];

function partTint(i) {
  return PART_TINTS[i % PART_TINTS.length];
}

function drawSpriteCell(png, sprite, spriteX, spriteY, scale, partIndexOfPixel) {
  for (let py = 0; py < sprite.size; py++) {
    for (let px = 0; px < sprite.size; px++) {
      const pxi = py * sprite.size + px;
      const idx = sprite.data[pxi];
      if (idx === -1) continue; // let checker show through
      let color = hexToRgb(sprite.palette[idx]);
      if (partIndexOfPixel) {
        const partIdx = partIndexOfPixel.get(pxi);
        color = partIdx === undefined ? blend(color, { r: 20, g: 22, b: 28 }, 0.45) : blend(color, partTint(partIdx), 0.6);
      }
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          setPixel(png, spriteX + px * scale + sx, spriteY + py * scale + sy, color.r, color.g, color.b, 255);
        }
      }
    }
  }
}

function renderPreview(sprites, names) {
  const SCALE = 8;
  const LABEL_SCALE = 2;
  const PAD = 12;
  const LABEL_H = FONT_H * LABEL_SCALE + 6;

  // Expand the sprite list into render items: every sprite gets a normal
  // cell; sprites with a non-empty "parts:" section additionally get a
  // "parts debug" cell right after, where each declared part is tinted a
  // distinct saturated overlay color so part masks are visually checkable.
  const items = [];
  for (const name of names) {
    const sprite = sprites.get(name);
    items.push({ name, label: name, sprite, debug: false });
    const partNames = Object.keys(sprite.parts ?? {});
    if (partNames.length > 0) {
      const partIndexOfPixel = new Map();
      partNames.forEach((partName, pi) => {
        for (const pxi of sprite.parts[partName]) partIndexOfPixel.set(pxi, pi);
      });
      items.push({ name, label: `${name}:parts`, sprite, debug: true, partIndexOfPixel });
    }
  }

  const COLUMNS = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(items.length || 1))));

  const maxSize = items.reduce((m, it) => Math.max(m, it.sprite.size), 1);
  const cellW = maxSize * SCALE + PAD * 2;
  const cellH = maxSize * SCALE + PAD * 2 + LABEL_H;

  const rows = Math.max(1, Math.ceil(items.length / COLUMNS));
  const width = Math.max(1, COLUMNS * cellW);
  const height = Math.max(1, rows * cellH);

  const png = new PNG({ width, height });
  drawChecker(png);

  const index = [];
  items.forEach((item, i) => {
    const { sprite, label } = item;
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    const cellX = col * cellW;
    const cellY = row * cellH;
    const spriteX = cellX + Math.floor((cellW - sprite.size * SCALE) / 2);
    const spriteY = cellY + PAD;

    drawSpriteCell(png, sprite, spriteX, spriteY, SCALE, item.debug ? item.partIndexOfPixel : null);

    const labelY = spriteY + sprite.size * SCALE + 6;
    const tw = textWidth(label, LABEL_SCALE);
    const labelX = cellX + Math.max(2, Math.floor((cellW - tw) / 2));
    drawText(png, label, labelX, labelY, LABEL_SCALE, { r: 245, g: 232, b: 213 });

    index.push({
      name: item.name,
      label,
      debug: item.debug,
      col,
      row,
      x: spriteX,
      y: spriteY,
      width: sprite.size * SCALE,
      height: sprite.size * SCALE,
      size: sprite.size,
    });
  });

  writeFileSync(PREVIEW_PNG_PATH, PNG.sync.write(png));
  writeFileSync(
    PREVIEW_JSON_PATH,
    JSON.stringify({ columns: COLUMNS, cellWidth: cellW, cellHeight: cellH, sprites: index }, null, 2),
    'utf8',
  );
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  try {
    const { sprites, frames } = loadSprites();
    const names = emitGeneratedTs(sprites, frames);
    renderPreview(sprites, names);
    console.log(`sprites:build — compiled ${names.length} sprite(s): ${names.join(', ') || '(none)'}`);
    if (frames.size > 0) {
      const frameSummary = [...frames.entries()].map(([base, list]) => `${base} (${list.length} frames)`).join(', ');
      console.log(`  frame groups: ${frameSummary}`);
    }
    console.log(`  -> ${GENERATED_PATH}`);
    console.log(`  -> ${PREVIEW_PNG_PATH}`);
    console.log(`  -> ${PREVIEW_JSON_PATH}`);
  } catch (err) {
    if (err instanceof PxlError) {
      console.error(`sprites:build failed: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

// Exported for `tools/pixel/animate-preview.mjs`, which reuses the same
// parser/loader to render the animated preview strip without duplicating
// the `.pxl` parsing logic.
export { loadSprites, PXL_DIR, PxlError };

// Only run the compile pipeline when this file is executed directly (not
// when imported for its `loadSprites` export).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
