#!/usr/bin/env node
/**
 * Extract named tiles from a reference sheet into lossless, independently
 * editable PNG files. A JSON manifest is the source of truth: update a crop
 * once, rerun this tool, and every derived tile is refreshed predictably.
 *
 * The optional `removeBorder` mode flood-fills the dominant edge colour to
 * alpha. It is useful for object sprites (houses, trees, markers) that sit on
 * the dark presentation background of an AI reference sheet. Terrain tiles
 * should keep that disabled because their full square is the art.
 *
 * Usage:
 *   node tools/pixel/extract-atlas.mjs --manifest tools/pixel/atlases/jul-13-2026.json
 *   node tools/pixel/extract-atlas.mjs --manifest ... --only grass_1,oak
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function fail(message) {
  console.error(`extract-atlas: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage: node tools/pixel/extract-atlas.mjs --manifest <file> [options]

Options:
  --manifest <file>        JSON crop manifest (required)
  --only <name,name>       Extract only named entries
  --clean                  Remove the manifest output directory before writing
  --help                   Show this help

Manifest entries use { name, crop: [x, y, width, height], removeBorder? }.
removeBorder can be true (default tolerance 20) or { tolerance: 20 }.`);
  process.exit(0);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage();
    if (arg === '--clean') { options.clean = true; continue; }
    if (!arg.startsWith('--')) fail(`unknown option ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) fail(`missing value for ${arg}`);
    options[arg.slice(2)] = value;
    i++;
  }
  if (!options.manifest) fail('--manifest is required');
  return options;
}

function pathFromRoot(path) {
  return isAbsolute(path) ? path : resolve(ROOT, path);
}

function readManifest(file) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { fail(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`); }
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.tiles)) fail('manifest needs a tiles array');
  if (typeof manifest.input !== 'string' || typeof manifest.output !== 'string') fail('manifest needs string input and output paths');
  return manifest;
}

function pixelOffset(png, x, y) { return (png.width * y + x) << 2; }

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function edgeColour(png) {
  const counts = new Map();
  const add = (x, y) => {
    const index = pixelOffset(png, x, y);
    if (png.data[index + 3] === 0) return;
    // Quantisation makes anti-aliased variations resolve to one edge colour.
    const key = [png.data[index], png.data[index + 1], png.data[index + 2]].map((v) => Math.round(v / 8) * 8).join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < png.width; x++) { add(x, 0); add(x, png.height - 1); }
  for (let y = 1; y < png.height - 1; y++) { add(0, y); add(png.width - 1, y); }
  const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!winner) return null;
  return winner.split(',').map(Number);
}

/** Removes only edge-connected backdrop pixels, never interior matching art. */
function removeBorder(png, tolerance) {
  const key = edgeColour(png);
  if (!key) return 0;
  const visited = new Uint8Array(png.width * png.height);
  const queue = [];
  const add = (x, y) => {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
    const cell = y * png.width + x;
    if (visited[cell]) return;
    const index = pixelOffset(png, x, y);
    if (png.data[index + 3] === 0 || colorDistance([png.data[index], png.data[index + 1], png.data[index + 2]], key) > tolerance) return;
    visited[cell] = 1;
    queue.push([x, y]);
  };
  for (let x = 0; x < png.width; x++) { add(x, 0); add(x, png.height - 1); }
  for (let y = 1; y < png.height - 1; y++) { add(0, y); add(png.width - 1, y); }
  let removed = 0;
  for (let at = 0; at < queue.length; at++) {
    const [x, y] = queue[at];
    const index = pixelOffset(png, x, y);
    png.data[index + 3] = 0;
    removed++;
    add(x - 1, y); add(x + 1, y); add(x, y - 1); add(x, y + 1);
  }
  return removed;
}

function crop(input, cropRect) {
  if (!Array.isArray(cropRect) || cropRect.length !== 4 || cropRect.some((value) => !Number.isInteger(value))) fail('each crop must be [x, y, width, height] integers');
  const [x, y, width, height] = cropRect;
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > input.width || y + height > input.height) fail(`crop ${cropRect.join(',')} is outside ${input.width}x${input.height}`);
  const output = new PNG({ width, height });
  for (let row = 0; row < height; row++) {
    input.data.copy(output.data, row * width * 4, ((y + row) * input.width + x) * 4, ((y + row) * input.width + x + width) * 4);
  }
  return output;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = pathFromRoot(options.manifest);
  const manifest = readManifest(manifestPath);
  const source = PNG.sync.read(readFileSync(pathFromRoot(manifest.input)));
  const outputDir = pathFromRoot(manifest.output);
  const wanted = options.only ? new Set(options.only.split(',').map((name) => name.trim()).filter(Boolean)) : null;
  if (options.clean && !wanted) rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  const written = [];
  for (const tile of manifest.tiles) {
    if (!tile || typeof tile.name !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(tile.name)) fail('every tile needs a safe name');
    if (wanted && !wanted.has(tile.name)) continue;
    const output = crop(source, tile.crop);
    const remove = tile.removeBorder;
    const removed = remove ? removeBorder(output, typeof remove === 'object' ? remove.tolerance ?? 20 : 20) : 0;
    const filename = `${tile.name}.png`;
    writeFileSync(resolve(outputDir, filename), PNG.sync.write(output));
    written.push({ name: tile.name, crop: tile.crop, removed, file: filename });
  }
  if (wanted) {
    for (const name of wanted) if (!written.some((tile) => tile.name === name)) fail(`--only requested unknown tile ${name}`);
  }
  writeFileSync(resolve(outputDir, 'manifest.resolved.json'), `${JSON.stringify({ source: manifest.input, generatedAt: new Date().toISOString(), tiles: written }, null, 2)}\n`);
  console.log(`extract-atlas: ${written.length} tile(s) from ${source.width}x${source.height} -> ${outputDir}`);
}

main();
