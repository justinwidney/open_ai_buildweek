#!/usr/bin/env python3
"""
sam_regions.py — Produce a region label map for group_svg_objects.py --regions
using Meta's Segment Anything (FastSAM by default; the full SAM with a
checkpoint if you have one).

The output PNG paints each segment in a distinct flat color (black = no
region). Feed it back into the grouper, which will turn every color into its
own top-level object group, overriding the color/connectivity heuristics
wherever the map is painted:

  python sam_regions.py scene.png -o scene_regions.png
  python group_svg_objects.py scene.svg --regions scene_regions.png

Use a *render of the SVG* (debug/render_diff.cjs makes one) or the original
raster; any resolution works — the grouper rescales the map to its canvas.

Requirements: pip install ultralytics   (FastSAM-s.pt auto-downloads, ~23 MB)
         or:  pip install segment-anything + a SAM checkpoint (--checkpoint)

The map is just a PNG — open it in any editor to merge/split/erase regions by
painting, or paint one from scratch; the grouper doesn't care where it came
from.
"""
import argparse
import colorsys
import sys

import numpy as np
from PIL import Image


def palette(n):
    cols = []
    h = 0.0
    for _ in range(n):
        h = (h + 0.61803398875) % 1.0
        cols.append(tuple(int(c * 255) for c in colorsys.hsv_to_rgb(h, 0.65, 0.95)))
    return cols


def masks_fastsam(img_path, imgsz, conf):
    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")
    res = model(img_path, retina_masks=True, imgsz=imgsz, conf=conf, iou=0.9,
                verbose=False)
    m = res[0].masks
    if m is None:
        sys.exit("FastSAM found no segments")
    return m.data.cpu().numpy().astype(bool)


def masks_sam(img_path, checkpoint, model_type):
    from segment_anything import (SamAutomaticMaskGenerator, sam_model_registry)
    sam = sam_model_registry[model_type](checkpoint=checkpoint)
    gen = SamAutomaticMaskGenerator(sam)
    img = np.asarray(Image.open(img_path).convert("RGB"))
    return np.stack([r["segmentation"] for r in gen.generate(img)])


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("image", help="PNG/JPG of the scene (render of the SVG, or source art)")
    ap.add_argument("-o", "--out", default=None, help="output label map PNG")
    ap.add_argument("--checkpoint", help="use full SAM with this checkpoint instead of FastSAM")
    ap.add_argument("--model-type", default="vit_b", help="SAM model type for --checkpoint")
    ap.add_argument("--imgsz", type=int, default=1024)
    ap.add_argument("--conf", type=float, default=0.4)
    ap.add_argument("--max-frac", type=float, default=0.5,
                    help="drop segments covering more than this canvas fraction (backgrounds)")
    ap.add_argument("--min-px", type=int, default=200, help="drop tiny segments")
    args = ap.parse_args()

    masks = (masks_sam(args.image, args.checkpoint, args.model_type)
             if args.checkpoint else masks_fastsam(args.image, args.imgsz, args.conf))
    src = Image.open(args.image)
    W, H = src.size
    keep = []
    for m in masks:
        if m.shape != (H, W):
            m = np.asarray(Image.fromarray(m).resize((W, H), Image.NEAREST), dtype=bool)
        a = int(m.sum())
        if args.min_px <= a <= args.max_frac * W * H:
            keep.append((a, m))
    keep.sort(key=lambda t: -t[0])  # paint large first so small ones stay on top
    print(f"{len(masks)} segments from SAM, keeping {len(keep)}")

    out = np.zeros((H, W, 3), dtype=np.uint8)
    for color, (_, m) in zip(palette(len(keep)), keep):
        out[m] = color
    out_path = args.out or (args.image.rsplit(".", 1)[0] + "_regions.png")
    Image.fromarray(out).save(out_path)
    # preview: regions at half opacity over the source image
    prev = (np.asarray(src.convert("RGB"), dtype=np.uint16) + out) // 2
    prev_path = out_path.rsplit(".", 1)[0] + "_preview.png"
    Image.fromarray(prev.astype(np.uint8)).save(prev_path)
    print(f"wrote {out_path} and {prev_path}")


if __name__ == "__main__":
    main()
