#!/usr/bin/env python3
"""
cutout_ui_sprite.py — Cut one UI plate out of a sprite sheet and vectorize it,
keeping only the plate itself: the soft drop shadow the sheet bakes in is
discarded so the plate can take a live CSS shadow over the world art instead.

`sheet_to_svgs.py` keys on "not near-white", which keeps that gray halo (and,
on a checkerboard-backed sheet, the checker squares). This script keys on the
plate's own paint instead — a pixel belongs to the sprite when it is either
saturated (purple velvet, gold filigree) or genuinely dark (the border ink).
Neutral mid-gray shadow fails both tests and drops out.

Usage:
    python cutout_ui_sprite.py sheet.png outdir --name panel-start \
                               --bbox 760 674 1083 781 \
                               [--sat 0.12] [--dark 120] [--pad 4]

Tuning tips:
  --sat    minimum saturation to count as plate paint. Raise if shadow survives,
           lower if pale parchment interiors get eaten.
  --dark   max brightness that counts as border ink regardless of saturation.
  --keep-holes  skip hole filling, for plates meant to be see-through inside.
"""
import argparse
import os

import numpy as np
from PIL import Image
from scipy import ndimage
import vtracer


def plate_mask(rgb, sat_min, dark_max, keep_holes=False):
    """Boolean mask of the plate: saturated paint or dark border ink, largest blob."""
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    saturation = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0)

    mask = (saturation >= sat_min) | (mx <= dark_max)

    # Close hairline gaps in the filigree so the border reads as one ring,
    # then keep only the largest blob -- stray sheet speckle is dropped.
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3), dtype=bool))
    labels, count = ndimage.label(mask)
    if count == 0:
        raise SystemExit("no plate found -- loosen --sat / --dark")
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    mask = labels == (int(np.argmax(sizes)) + 1)

    # The velvet interior is saturated, but pale highlights inside it are not;
    # filling holes makes the plate solid so vtracer traces a closed shape.
    if not keep_holes:
        mask = ndimage.binary_fill_holes(mask)
    return mask


def cutout(sheet_path, bbox, sat_min, dark_max, pad, keep_holes):
    """Return an RGBA crop of the plate with everything else transparent."""
    sheet = np.array(Image.open(sheet_path).convert("RGBA")).astype(int)
    x0, y0, x1, y1 = bbox
    y0 = max(0, y0 - pad)
    x0 = max(0, x0 - pad)
    y1 = min(sheet.shape[0] - 1, y1 + pad)
    x1 = min(sheet.shape[1] - 1, x1 + pad)
    crop = sheet[y0:y1 + 1, x0:x1 + 1].copy()

    mask = plate_mask(crop[..., :3], sat_min, dark_max, keep_holes)
    crop[..., 3] = np.where(mask, 255, 0)

    # Trim to the mask so the SVG viewBox hugs the plate and CSS sizing is exact.
    ys, xs = np.where(mask)
    crop = crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(crop.astype(np.uint8))


def vectorize(png_path, svg_path, color_precision, filter_speckle):
    vtracer.convert_image_to_svg_py(
        png_path,
        svg_path,
        colormode="color",
        hierarchical="stacked",
        mode="spline",
        filter_speckle=filter_speckle,
        color_precision=color_precision,
        layer_difference=16,
        corner_threshold=60,
        length_threshold=4.0,
        splice_threshold=45,
        path_precision=2,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("outdir")
    ap.add_argument("--name", required=True)
    ap.add_argument("--bbox", type=int, nargs=4, required=True, metavar=("X0", "Y0", "X1", "Y1"))
    ap.add_argument("--sat", type=float, default=0.12)
    ap.add_argument("--dark", type=int, default=120)
    ap.add_argument("--pad", type=int, default=4)
    ap.add_argument("--keep-holes", action="store_true")
    ap.add_argument("--color-precision", type=int, default=7)
    ap.add_argument("--filter-speckle", type=int, default=8)
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    png_path = os.path.join(args.outdir, args.name + ".png")
    svg_path = os.path.join(args.outdir, args.name + ".svg")

    crop = cutout(args.sheet, args.bbox, args.sat, args.dark, args.pad, args.keep_holes)
    crop.save(png_path)
    vectorize(png_path, svg_path, args.color_precision, args.filter_speckle)

    print(f"{args.name}: {crop.size[0]}x{crop.size[1]}")
    print(f"  {png_path}\n  {svg_path}")


if __name__ == "__main__":
    main()
