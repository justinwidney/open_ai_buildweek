#!/usr/bin/env node
/**
 * Import a PNG reference/crop into the .pxl format used by Connected Kingdom
 * sprite compiler.
 *
 * This intentionally has no image dependency beyond pngjs, which is already
 * part of the pixel toolchain. The input is box-sampled down to a small square
 * sprite, then reduced with deterministic median-cut quantization.
 *
 * Example:
 *   node tools/pixel/import-image.mjs \
 *     --input "finished/ChatGPT Image Jul 10, 2026, 06_05_56 PM.png" \
 *     --name reference_mountain --crop 520,230,300,210 --size 32 --colors 18
 *
 * By default the output lands in packages/ui/src/sprites/pixel/, so the next
 * `npm run sprites:build` puts it in generated.ts and preview.png.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT_DIR = resolve(ROOT, 'packages/ui/src/sprites/pixel');
const PALETTE_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!$%&*+,-./:;<=>?@^|~';

function usage(message) {
  if (message) console.error(`import-image: ${message}\n`);
  console.log(`Usage:
  node tools/pixel/import-image.mjs --input image.png --name sprite_name [options]

Options:
  --input <path>              Source PNG (required)
  --name <name>               Sprite name / output basename (required)
  --out <path>                Exact .pxl output path
  --out-dir <path>            Output directory (default: packages/ui/src/sprites/pixel)
  --crop x,y,w,h              Crop source rectangle before sampling
  --size <n>                  Output sprite size (default: 16)
  --colors <n>                Maximum opaque palette colors (default: 16)
  --alpha-threshold <n>      Pixels below this alpha become transparent (default: 24)
  --nearest                   Use one nearest source pixel per output pixel
  --help                      Show this help
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage();
    if (!arg.startsWith('--')) usage(`unknown argument "${arg}"`);
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (key === 'nearest') {
      options.nearest = true;
      continue;
    }
    if (next === undefined || next.startsWith('--')) usage(`missing value for --${key}`);
    options[key] = next;
    i++;
  }
  return options;
}

function integer(value, name, min, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) throw new Error(`--${name} must be an integer >= ${min}`);
  return parsed;
}

function resolvePath(path) {
  return isAbsolute(path) ? path : resolve(ROOT, path);
}

function parseCrop(raw, width, height) {
  if (raw === undefined) {
    const side = Math.min(width, height);
    return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), width: side, height: side };
  }
  const values = raw.split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('--crop must be x,y,w,h');
  }
  const [x, y, cropWidth, cropHeight] = values;
  if (![x, y, cropWidth, cropHeight].every(Number.isInteger) || cropWidth <= 0 || cropHeight <= 0) {
    throw new Error('--crop values must be integer x,y,w,h with positive width and height');
  }
  if (x < 0 || y < 0 || x + cropWidth > width || y + cropHeight > height) {
    throw new Error(`--crop ${raw} is outside the ${width}x${height} source image`);
  }
  return { x, y, width: cropWidth, height: cropHeight };
}

function readPixel(png, x, y) {
  const index = (png.width * y + x) << 2;
  return {
    r: png.data[index],
    g: png.data[index + 1],
    b: png.data[index + 2],
    a: png.data[index + 3],
  };
}

function sampleSprite(png, crop, size, alphaThreshold, nearest) {
  const pixels = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = crop.x + (x / size) * crop.width;
      const top = crop.y + (y / size) * crop.height;
      const right = crop.x + ((x + 1) / size) * crop.width;
      const bottom = crop.y + ((y + 1) / size) * crop.height;

      if (nearest) {
        const source = readPixel(
          png,
          Math.min(png.width - 1, Math.floor((left + right) / 2)),
          Math.min(png.height - 1, Math.floor((top + bottom) / 2)),
        );
        pixels.push(source.a < alphaThreshold ? null : source);
        continue;
      }

      const x0 = Math.max(0, Math.floor(left));
      const x1 = Math.min(png.width - 1, Math.ceil(right) - 1);
      const y0 = Math.max(0, Math.floor(top));
      const y1 = Math.min(png.height - 1, Math.ceil(bottom) - 1);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weight = 0;
      for (let sy = y0; sy <= y1; sy++) {
        for (let sx = x0; sx <= x1; sx++) {
          const source = readPixel(png, sx, sy);
          if (source.a < alphaThreshold) continue;
          const alpha = source.a / 255;
          r += source.r * alpha;
          g += source.g * alpha;
          b += source.b * alpha;
          a += source.a;
          weight += alpha;
        }
      }
      pixels.push(weight === 0 ? null : { r: Math.round(r / weight), g: Math.round(g / weight), b: Math.round(b / weight), a: Math.round(a / Math.max(1, weight)) });
    }
  }
  return pixels;
}

function colorRange(box) {
  const ranges = ['r', 'g', 'b'].map((channel) => {
    const values = box.map((pixel) => pixel[channel]);
    return Math.max(...values) - Math.min(...values);
  });
  return ranges;
}

function quantize(pixels, colorLimit) {
  const opaque = pixels.filter(Boolean);
  if (opaque.length === 0) return [];
  const boxes = [opaque];
  while (boxes.length < colorLimit) {
    let selected = -1;
    let selectedScore = -1;
    let selectedChannel = 'r';
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const ranges = colorRange(boxes[i]);
      const channelIndex = ranges.indexOf(Math.max(...ranges));
      const score = Math.max(...ranges) * boxes[i].length;
      if (score > selectedScore) {
        selected = i;
        selectedScore = score;
        selectedChannel = ['r', 'g', 'b'][channelIndex];
      }
    }
    if (selected === -1) break;
    const box = boxes[selected].slice().sort((a, b) => a[selectedChannel] - b[selectedChannel]);
    const midpoint = Math.floor(box.length / 2);
    boxes.splice(selected, 1, box.slice(0, midpoint), box.slice(midpoint));
  }
  return boxes.map((box) => {
    const total = box.length;
    return {
      r: Math.round(box.reduce((sum, pixel) => sum + pixel.r, 0) / total),
      g: Math.round(box.reduce((sum, pixel) => sum + pixel.g, 0) / total),
      b: Math.round(box.reduce((sum, pixel) => sum + pixel.b, 0) / total),
    };
  });
}

function distance(a, b) {
  const r = a.r - b.r;
  const g = a.g - b.g;
  const bDelta = a.b - b.b;
  return r * r + g * g + bDelta * bDelta;
}

function nearestPaletteIndex(pixel, palette) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i++) {
    const candidateDistance = distance(pixel, palette[i]);
    if (candidateDistance < bestDistance) {
      best = i;
      bestDistance = candidateDistance;
    }
  }
  return best;
}

function hex(pixel) {
  return `#${[pixel.r, pixel.g, pixel.b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function emitPxl(name, size, pixels, palette, source, crop) {
  const chars = palette.map((_, index) => PALETTE_CHARS[index]);
  const paletteLines = palette.map((pixel, index) => `${chars[index]} ${hex(pixel)}`);
  const rows = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const pixel = pixels[y * size + x];
      row += pixel === null ? '_' : chars[nearestPaletteIndex(pixel, palette)];
    }
    rows.push(row);
  }
  return [
    `# name: ${name}`,
    `# size: ${size}`,
    `# imported from: ${source}`,
    `# crop: ${crop.x},${crop.y},${crop.width},${crop.height}`,
    'palette:',
    ...paletteLines,
    'pixels:',
    ...rows,
    '',
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.input) usage('--input is required');
  if (!options.name || !/^[A-Za-z0-9_-]+$/.test(options.name)) {
    usage('--name is required and may contain only letters, numbers, underscore, and dash');
  }

  const size = integer(options.size, 'size', 1, 16);
  const colors = integer(options.colors, 'colors', 1, 16);
  if (colors > PALETTE_CHARS.length) throw new Error(`--colors cannot exceed ${PALETTE_CHARS.length}`);
  const alphaThreshold = integer(options['alpha-threshold'], 'alpha-threshold', 0, 24);
  const input = resolvePath(options.input);
  const png = PNG.sync.read(readFileSync(input));
  const crop = parseCrop(options.crop, png.width, png.height);
  const pixels = sampleSprite(png, crop, size, alphaThreshold, options.nearest === true);
  const palette = quantize(pixels, colors);
  const output = options.out
    ? resolvePath(options.out)
    : resolve(options['out-dir'] ? resolvePath(options['out-dir']) : DEFAULT_OUT_DIR, `${options.name}.pxl`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, emitPxl(options.name, size, pixels, palette, options.input, crop), 'utf8');
  console.log(`import-image: wrote ${output}`);
  console.log(`  source=${png.width}x${png.height} crop=${crop.x},${crop.y},${crop.width},${crop.height}`);
  console.log(`  sprite=${size}x${size} palette=${palette.length} transparent=${pixels.filter((pixel) => pixel === null).length}`);
  console.log('  next: npm run sprites:build');
}

try {
  main();
} catch (error) {
  console.error(`import-image failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
