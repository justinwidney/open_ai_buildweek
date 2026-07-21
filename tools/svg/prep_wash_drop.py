#!/usr/bin/env python3
"""
prep_wash_drop.py — Turn a white-backed watercolour wash into a trimmed,
soft-alpha drop asset for the home screen reveal.

The source wash (18846700_detailed_pastel_watercolour_texture_background_2508)
is one big organic splat painted on solid white. The home screen uses it two
ways at once -- as the visible coloured drop, and as the alpha mask that reveals
the road backdrop underneath -- so the export has to keep the ragged, feathered
edge intact. Whiteness becomes transparency rather than a hard cutout: a pixel's
alpha is how far it is from white, which preserves the wash's soft bloom.

Vectorizing this would flatten the gradients into hundreds of banded shapes, so
the export stays a raster; `--svg` is available to compare if you want it.

Usage:
    python prep_wash_drop.py wash.png outdir --name wash-01 [--size 720]
                             [--floor 6] [--gamma 1.15] [--alpha-gain 1.0] [--svg]

Tuning tips:
  --floor  alpha below this is snapped to 0, clearing the faint white haze that
           would otherwise show as a square edge when the drop is masked.
  --gamma  >1 firms up the mid-alpha bloom, <1 makes the drop wispier.
  --alpha-gain  >1 saturates the body to opaque, keeping only the fringe soft.
           The home screen ships two exports from one source: gain 1 for the
           visible pigment, gain ~3 for the mask that reveals the world.
"""
import argparse
import os

import numpy as np
from PIL import Image


def wash_to_alpha(img, floor, gamma, alpha_gain=1.0):
    """RGBA where alpha is distance-from-white, so the feathered edge survives."""
    rgb = np.array(img.convert("RGB")).astype(np.float32)

    # Distance from white, per pixel, on 0..1. The darkest channel carries the
    # pigment: a pale peach is (250, 225, 205) -> alpha comes from the 205.
    alpha = 1.0 - (rgb.min(axis=-1) / 255.0)
    alpha = np.clip(alpha, 0.0, 1.0) ** gamma

    # A gain > 1 saturates the body of the splat to fully opaque while the thin
    # outer fringe still ramps. That is what the reveal mask wants: the world
    # underneath should read at full strength inside the drop, with only the
    # painted edge feathering out. The pigment export keeps gain at 1.
    alpha = np.clip(alpha * alpha_gain, 0.0, 1.0)

    alpha8 = (alpha * 255.0).astype(np.uint8)
    alpha8 = np.where(alpha8 < floor, 0, alpha8).astype(np.uint8)

    # Unmultiply off the white paper. The source pixel is pigment composited
    # over white; storing it as-is with a low alpha would wash the peach out to
    # nothing over a dark backdrop. Solving src = pigment*a + 255*(1-a) for
    # pigment recovers the real paint, so the drop keeps its hue at any opacity.
    safe = np.maximum(alpha, 1e-3)[..., None]
    pigment = (rgb - 255.0 * (1.0 - safe)) / safe
    pigment = np.clip(pigment, 0, 255).astype(np.uint8)
    pigment = np.where(alpha8[..., None] == 0, 255, pigment).astype(np.uint8)

    return Image.fromarray(np.dstack([pigment, alpha8]), mode="RGBA")


def build_drop(img, floor, gamma, alpha_gain):
    """Crop to the splat, always using the un-boosted bounds.

    A gain > 1 lifts faint haze above `floor` and would trim to a slightly wider
    box, so a mask export and a pigment export would no longer share a centre or
    an aspect ratio -- and the reveal would sit off its own drop. Taking the
    bounds from the gain-1 pass keeps every export from one source geometrically
    identical, so the pair can be placed with a single set of coordinates.
    """
    base = wash_to_alpha(img, floor, gamma, 1.0)
    bbox = base.getchannel("A").getbbox()
    if bbox is None:
        return base
    if alpha_gain == 1.0:
        return base.crop(bbox)
    return wash_to_alpha(img, floor, gamma, alpha_gain).crop(bbox)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="rendered PNG of the wash (white background)")
    ap.add_argument("outdir")
    ap.add_argument("--name", required=True)
    ap.add_argument("--size", type=int, default=720, help="longest edge of the export")
    ap.add_argument("--floor", type=int, default=6)
    ap.add_argument("--gamma", type=float, default=1.15)
    ap.add_argument("--alpha-gain", type=float, default=1.0,
                    help=">1 solidifies the splat body; use for the reveal-mask export")
    ap.add_argument("--svg", action="store_true", help="also emit a vtracer SVG to compare")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    src = Image.open(args.source)

    drop = build_drop(src, args.floor, args.gamma, args.alpha_gain)
    drop.thumbnail((args.size, args.size), Image.LANCZOS)

    png_path = os.path.join(args.outdir, args.name + ".png")
    drop.save(png_path, optimize=True)
    print(f"{args.name}: {drop.size[0]}x{drop.size[1]}  {os.path.getsize(png_path) / 1024:.0f} KB  {png_path}")

    # WebP is what the world-background art already ships as, and it carries the
    # feathered alpha at a fraction of the PNG's weight.
    webp_path = os.path.join(args.outdir, args.name + ".webp")
    drop.save(webp_path, quality=88, method=6)
    print(f"  webp: {os.path.getsize(webp_path) / 1024:.0f} KB  {webp_path}")

    if args.svg:
        import vtracer
        svg_path = os.path.join(args.outdir, args.name + ".svg")
        vtracer.convert_image_to_svg_py(
            png_path, svg_path,
            colormode="color", hierarchical="stacked", mode="spline",
            filter_speckle=16, color_precision=6, layer_difference=24,
            corner_threshold=60, length_threshold=6.0, splice_threshold=45,
            path_precision=1,
        )
        print(f"  svg: {os.path.getsize(svg_path) / 1024:.0f} KB  {svg_path}")


if __name__ == "__main__":
    main()
