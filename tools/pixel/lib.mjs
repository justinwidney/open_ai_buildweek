/**
 * Shared pixel-toolchain helpers: a tiny 3x5 bitmap font, raw pngjs pixel
 * setters, and hex/blend color math. Extracted from compile.mjs /
 * animate-preview.mjs so tools/levels/render-levels.mjs can reuse the exact
 * same rendering primitives instead of re-implementing them a third time.
 *
 * Pure refactor: behavior of compile.mjs / animate-preview.mjs is unchanged,
 * they now just import these instead of defining local copies.
 */

// ---------------------------------------------------------------------------
// Tiny 3x5 bitmap font (lowercase, digits, underscore, dash, colon).
// Each glyph is 5 rows of a 3-bit mask (bit 2 = leftmost).
// ---------------------------------------------------------------------------

export const FONT = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  a: [0b010, 0b101, 0b111, 0b101, 0b101],
  b: [0b110, 0b101, 0b110, 0b101, 0b110],
  c: [0b011, 0b100, 0b100, 0b100, 0b011],
  d: [0b110, 0b101, 0b101, 0b101, 0b110],
  e: [0b111, 0b100, 0b111, 0b100, 0b111],
  f: [0b111, 0b100, 0b111, 0b100, 0b100],
  g: [0b011, 0b100, 0b101, 0b101, 0b011],
  h: [0b101, 0b101, 0b111, 0b101, 0b101],
  i: [0b111, 0b010, 0b010, 0b010, 0b111],
  j: [0b001, 0b001, 0b001, 0b101, 0b010],
  k: [0b101, 0b101, 0b110, 0b101, 0b101],
  l: [0b100, 0b100, 0b100, 0b100, 0b111],
  m: [0b101, 0b111, 0b111, 0b101, 0b101],
  n: [0b101, 0b111, 0b111, 0b111, 0b101],
  o: [0b111, 0b101, 0b101, 0b101, 0b111],
  p: [0b110, 0b101, 0b110, 0b100, 0b100],
  q: [0b111, 0b101, 0b101, 0b111, 0b001],
  r: [0b110, 0b101, 0b110, 0b101, 0b101],
  s: [0b011, 0b100, 0b010, 0b001, 0b110],
  t: [0b111, 0b010, 0b010, 0b010, 0b010],
  u: [0b101, 0b101, 0b101, 0b101, 0b111],
  v: [0b101, 0b101, 0b101, 0b101, 0b010],
  w: [0b101, 0b101, 0b111, 0b111, 0b101],
  x: [0b101, 0b101, 0b010, 0b101, 0b101],
  y: [0b101, 0b101, 0b010, 0b010, 0b010],
  z: [0b111, 0b001, 0b010, 0b100, 0b111],
  _: [0b000, 0b000, 0b000, 0b000, 0b111],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  '.': [0b000, 0b000, 0b000, 0b000, 0b010],
  ':': [0b000, 0b010, 0b000, 0b010, 0b000],
  ' ': [0b000, 0b000, 0b000, 0b000, 0b000],
};
export const FONT_W = 3;
export const FONT_H = 5;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function blend(base, tint, amount) {
  return {
    r: Math.round(base.r * (1 - amount) + tint.r * amount),
    g: Math.round(base.g * (1 - amount) + tint.g * amount),
    b: Math.round(base.b * (1 - amount) + tint.b * amount),
  };
}

// ---------------------------------------------------------------------------
// Raw pixel setters
// ---------------------------------------------------------------------------

export function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

/** Alpha-blends {r,g,b} over the pixel already at (x, y), amount in [0, 1]. */
export function blendPixel(png, x, y, color, amount) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  if (amount <= 0) return;
  const idx = (png.width * y + x) << 2;
  if (amount >= 1) {
    png.data[idx] = color.r;
    png.data[idx + 1] = color.g;
    png.data[idx + 2] = color.b;
    png.data[idx + 3] = 255;
    return;
  }
  png.data[idx] = Math.round(png.data[idx] * (1 - amount) + color.r * amount);
  png.data[idx + 1] = Math.round(png.data[idx + 1] * (1 - amount) + color.g * amount);
  png.data[idx + 2] = Math.round(png.data[idx + 2] * (1 - amount) + color.b * amount);
  png.data[idx + 3] = 255;
}

export function drawChecker(png, checkerSize = 8) {
  const light = { r: 58, g: 62, b: 78 };
  const dark = { r: 46, g: 49, b: 62 };
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const on = (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0;
      const c = on ? light : dark;
      setPixel(png, x, y, c.r, c.g, c.b, 255);
    }
  }
}

export function fillRect(png, x0, y0, w, h, color) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setPixel(png, x0 + x, y0 + y, color.r, color.g, color.b, 255);
    }
  }
}

// ---------------------------------------------------------------------------
// Pixel-sprite blit (nearest-neighbor, mirrors fromPixel.ts's canvas blit)
// ---------------------------------------------------------------------------

/**
 * Blits a compiled `.pxl` sprite (as shaped by packages/ui/.../generated.ts:
 * { size, palette, data }) into `png` at (x0, y0), scaling each source pixel
 * up to a `scale`x`scale` block. Transparent source pixels (-1) are skipped
 * (existing content shows through), mirroring fromPixel.ts.
 */
export function drawPixelSprite(png, sprite, x0, y0, scale) {
  for (let py = 0; py < sprite.size; py++) {
    for (let px = 0; px < sprite.size; px++) {
      const idx = sprite.data[py * sprite.size + px];
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
// Flat rounded-square tile (procedural stand-in for terrain/pieces that
// have no pixel-art sprite yet — mirrors the rounded-square look of
// packages/ui/src/sprites/{terrain,pieces}.ts's roundRectShape, at whatever
// output pixel resolution the caller is rendering).
// ---------------------------------------------------------------------------

export function fillRoundedRect(png, x0, y0, w, h, radius, color, outline, outlineWidth = 1) {
  const r = Math.max(0, Math.min(radius, Math.floor(Math.min(w, h) / 2)));
  const r2 = r * r;
  const rInner = Math.max(0, r - outlineWidth);
  const rInner2 = rInner * rInner;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Distance into the nearest corner region, if any.
      let dx = 0;
      let dy = 0;
      if (x < r && y < r) {
        dx = r - x;
        dy = r - y;
      } else if (x >= w - r && y < r) {
        dx = x - (w - r - 1);
        dy = r - y;
      } else if (x < r && y >= h - r) {
        dx = r - x;
        dy = y - (h - r - 1);
      } else if (x >= w - r && y >= h - r) {
        dx = x - (w - r - 1);
        dy = y - (h - r - 1);
      }
      if (dx * dx + dy * dy > r2) continue; // outside the rounded corner

      const nearFlatEdge = x < outlineWidth || y < outlineWidth || x >= w - outlineWidth || y >= h - outlineWidth;
      const nearRoundedEdge = (dx > 0 || dy > 0) && dx * dx + dy * dy > rInner2;
      const onEdge = outline && (nearFlatEdge || nearRoundedEdge);
      const c = onEdge ? outline : color;
      setPixel(png, x0 + x, y0 + y, c.r, c.g, c.b, 255);
    }
  }
}

// ---------------------------------------------------------------------------
// Bitmap-font text
// ---------------------------------------------------------------------------

export function textWidth(text, scale) {
  return text.length * (FONT_W + 1) * scale;
}

export function drawText(png, text, x0, y0, scale, color) {
  let cx = x0;
  for (const ch of text.toLowerCase()) {
    const glyph = FONT[ch] ?? FONT[' '];
    for (let row = 0; row < FONT_H; row++) {
      for (let col = 0; col < FONT_W; col++) {
        const bit = (glyph[row] >> (FONT_W - 1 - col)) & 1;
        if (!bit) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            setPixel(png, cx + col * scale + sx, y0 + row * scale + sy, color.r, color.g, color.b, 255);
          }
        }
      }
    }
    cx += (FONT_W + 1) * scale;
  }
  return cx - x0; // rendered width
}
