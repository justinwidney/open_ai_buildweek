#!/usr/bin/env python3
"""
sheet_to_svgs.py — Slice a sprite sheet (white or transparent bg) into
individual sprites and vectorize each one to SVG with VTracer.

Usage:
    python sheet_to_svgs.py input.png output_dir [--white-thresh 245]
                            [--min-area 400] [--pad 6] [--merge 14]
                            [--color-precision 7] [--filter-speckle 8]

Tuning tips:
  --merge           dilation radius (px) used to merge nearby blobs into one
                    sprite (keeps clouds/reflections attached to their island)
  --color-precision lower = flatter/more stylized SVG, higher = more faithful
  --filter-speckle  higher = fewer tiny paths, smaller files
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
import vtracer


def slice_sheet(img_path, white_thresh=245, min_area=400, pad=6, merge=14):
    """Return list of (crop_rgba_image, bbox) for each detected sprite."""
    img = Image.open(img_path).convert("RGBA")
    arr = np.array(img)

    # Foreground mask: pixel is "content" if it's not near-white AND not transparent
    rgb = arr[..., :3]
    alpha = arr[..., 3]
    near_white = np.all(rgb >= white_thresh, axis=-1)
    mask = (~near_white) & (alpha > 10)

    # Dilate so multi-part sprites (island + reflection, fluffy cloud wisps)
    # merge into a single connected component
    if merge > 0:
        structure = np.ones((merge, merge), dtype=bool)
        merged = ndimage.binary_dilation(mask, structure=structure)
    else:
        merged = mask

    labels, n = ndimage.label(merged)
    sprites = []
    for i in range(1, n + 1):
        ys, xs = np.where(labels == i)
        if len(ys) < min_area:
            continue
        y0, y1 = ys.min(), ys.max()
        x0, x1 = xs.min(), xs.max()
        # pad and clamp
        y0 = max(0, y0 - pad); x0 = max(0, x0 - pad)
        y1 = min(arr.shape[0] - 1, y1 + pad); x1 = min(arr.shape[1] - 1, x1 + pad)

        crop = arr[y0:y1 + 1, x0:x1 + 1].copy()

        # Knock out the white background -> transparent, so the SVG
        # traces only the sprite itself
        crop_rgb = crop[..., :3]
        crop_white = np.all(crop_rgb >= white_thresh, axis=-1)
        crop[..., 3] = np.where(crop_white, 0, crop[..., 3])

        sprites.append((Image.fromarray(crop), (x0, y0, x1, y1)))

    # sort top-to-bottom, then left-to-right (reading order)
    sprites.sort(key=lambda s: (s[1][1] // 60, s[1][0]))
    return sprites


def vectorize(png_path, svg_path, color_precision=7, filter_speckle=8):
    vtracer.convert_image_to_svg_py(
        png_path,
        svg_path,
        colormode="color",
        hierarchical="stacked",
        mode="spline",
        filter_speckle=filter_speckle,   # discard tiny patches
        color_precision=color_precision, # significant bits per channel
        layer_difference=16,             # color diff between gradient layers
        corner_threshold=60,
        length_threshold=4.0,
        splice_threshold=45,
        path_precision=2,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("outdir")
    ap.add_argument("--white-thresh", type=int, default=245)
    ap.add_argument("--min-area", type=int, default=400)
    ap.add_argument("--pad", type=int, default=6)
    ap.add_argument("--merge", type=int, default=14)
    ap.add_argument("--color-precision", type=int, default=7)
    ap.add_argument("--filter-speckle", type=int, default=8)
    args = ap.parse_args()

    png_dir = os.path.join(args.outdir, "png")
    svg_dir = os.path.join(args.outdir, "svg")
    os.makedirs(png_dir, exist_ok=True)
    os.makedirs(svg_dir, exist_ok=True)

    sprites = slice_sheet(args.input, args.white_thresh, args.min_area,
                          args.pad, args.merge)
    print(f"Detected {len(sprites)} sprites")

    for idx, (crop, bbox) in enumerate(sprites):
        name = f"sprite_{idx:03d}"
        png_path = os.path.join(png_dir, name + ".png")
        svg_path = os.path.join(svg_dir, name + ".svg")
        crop.save(png_path)
        vectorize(png_path, svg_path, args.color_precision, args.filter_speckle)
        w, h = crop.size
        print(f"  {name}: bbox={bbox} size={w}x{h}")

    print(f"\nPNG crops -> {png_dir}\nSVGs      -> {svg_dir}")


if __name__ == "__main__":
    main()
