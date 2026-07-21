#!/usr/bin/env node
/*
render_diff.js — Render one or two SVGs with sharp (librsvg) and, given two,
report how many pixels differ. Independent check that a grouped SVG still
paints identically to the flat original.

Setup (once, in this debug/ folder or anywhere on NODE_PATH):
  npm install sharp

Usage:
  node render_diff.js scene.svg                     # -> scene.render.png
  node render_diff.js original.svg grouped.svg      # renders both + diff stats
                                                    # -> render_diff.png marks
                                                    #    differing pixels in red

Pixel-identical output is the goal; a handful of thin edge pixels (<0.1%,
small channel deltas) is antialiasing noise from reordered hidden geometry,
not a visible change. Big contiguous patches mean a real paint-order break —
re-run the grouper and check its own verification output.
*/
const sharp = require("sharp");
const path = require("path");

const THRESHOLD = 8; // per-channel delta considered a real difference

async function render(svg) {
  const out = svg.replace(/\.svg$/i, "") + ".render.png";
  const img = sharp(svg, { density: 96 });
  await img.png().toFile(out);
  console.log("rendered", out);
  return out;
}

(async () => {
  const [a, b] = process.argv.slice(2);
  if (!a) {
    console.error("usage: node render_diff.js a.svg [b.svg]");
    process.exit(1);
  }
  const pa = await render(a);
  if (!b) return;
  const pb = await render(b);

  const A = await sharp(pa).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(pb).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    console.error("size mismatch:", A.info.width, "x", A.info.height,
                  "vs", B.info.width, "x", B.info.height);
    process.exit(1);
  }
  const n = A.info.width * A.info.height;
  const mark = Buffer.from(A.data);
  let anyDiff = 0, bigDiff = 0, maxDelta = 0;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) {
      d = Math.max(d, Math.abs(A.data[i * 4 + c] - B.data[i * 4 + c]));
    }
    if (d > 0) anyDiff++;
    if (d > THRESHOLD) {
      bigDiff++;
      mark[i * 4] = 255; mark[i * 4 + 1] = 0; mark[i * 4 + 2] = 0; mark[i * 4 + 3] = 255;
    }
    if (d > maxDelta) maxDelta = d;
  }
  console.log(`pixels differing at all: ${anyDiff} (${(100 * anyDiff / n).toFixed(4)}%)`);
  console.log(`pixels differing >${THRESHOLD}/255: ${bigDiff} (${(100 * bigDiff / n).toFixed(4)}%)`);
  console.log(`max channel delta: ${maxDelta}`);
  const diffOut = path.join(path.dirname(pb), "render_diff.png");
  await sharp(mark, { raw: A.info }).png().toFile(diffOut);
  console.log("differing pixels marked red in", diffOut);
})();
