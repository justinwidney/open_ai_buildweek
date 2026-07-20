#!/usr/bin/env python3
"""
analyze_reference.py — Extract a generator config from any reference image.

Measures: sky/haze/water palette, land coverage per depth band, cloud
coverage, and (if present) the winding path network: trunk centerline
spline + width taper + convergence (focal) point.

Usage:
    python analyze_reference.py reference.png config.json
Then:
    python generate_path_landscape.py sprites_svg manifest.json out.svg \
        --config config.json --seed 5
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def rgbhex(v):
    return "#%02x%02x%02x" % tuple(int(c) for c in v)


def analyze(path_img):
    ref = np.array(Image.open(path_img).convert("RGB")).astype(float)
    H, W, _ = ref.shape
    r, g, b = ref[..., 0], ref[..., 1], ref[..., 2]

    cfg = {}
    # ---- palette ----
    top = ref[: int(0.06 * H)]
    blue_top = top[top[..., 2] > top[..., 0] + 15]
    cfg["sky_top"] = rgbhex(blue_top.mean(0)) if len(blue_top) else "#77a3d4"
    hz = ref[int(0.10 * H): int(0.18 * H)]
    cfg["haze"] = rgbhex(hz[hz.min(-1) > 190].mean(0)) if (hz.min(-1) > 190).any() else "#ece9e4"
    mid = ref[int(0.3 * H): int(0.7 * H)]
    wm = (mid[..., 2] > mid[..., 0] + 15) & (mid[..., 2] > 120)
    cfg["water"] = rgbhex(mid[wm].mean(0)) if wm.any() else "#98abbd"
    pm_all = (r > 165) & (r < 245) & (r > b + 35) & (g > b + 12) & (g < r) & (b > 90)
    cfg["path_color"] = rgbhex(ref[pm_all].mean(0)) if pm_all.any() else "#c8a76b"

    # ---- coverage ----
    land = (g > b - 3) & (np.abs(r - b) + np.abs(g - b) > 12)
    white = (r > 215) & (g > 215) & (b > 205)
    cfg["land_bands"] = [round(float(land[int(f0 * H):int(f1 * H)].mean()), 2)
                         for f0, f1 in [(0.1, 0.25), (0.25, 0.5), (0.5, 0.75), (0.75, 1.0)]]
    cfg["cloud_bands"] = [round(float(white[int(f0 * H):int(f1 * H)].mean()), 2)
                          for f0, f1 in [(0.0, 0.15), (0.15, 0.4), (0.4, 0.7), (0.7, 1.0)]]

    # ---- path network ----
    lab, n = ndimage.label(pm_all)
    cfg["has_path"] = False
    if n:
        sizes = ndimage.sum(pm_all, lab, range(1, n + 1))
        main = lab == (np.argmax(sizes) + 1)
        if main.mean() > 0.015:  # a real path, not stray beige
            pts, widths = [], []
            for y in range(H - 1, int(0.05 * H), -max(8, H // 70)):
                seg = main[max(0, y - 6): y + 6]
                xs = np.where(seg.any(axis=0))[0]
                if len(xs) < 5:
                    continue
                pts.append([round(float(xs.mean()) / W, 3), round(y / H, 3)])
                widths.append(float(len(xs)) / W)
            if len(pts) > 6:
                cfg["has_path"] = True
                # smooth the centerline
                xs = np.array([p[0] for p in pts])
                k = 5
                xs = np.convolve(xs, np.ones(k) / k, mode="same")
                cfg["path_points"] = [[round(float(x), 3), p[1]]
                                      for x, p in zip(xs, pts)][::2]
                cfg["path_width_bottom"] = round(float(np.median(widths[:6])), 3)
                cfg["path_width_top"] = round(float(np.median(widths[-6:])), 3)
                cfg["focal"] = [cfg["path_points"][-1][0], max(0.07, pts[-1][1] - 0.08)]
    if "focal" not in cfg:
        cfg["focal"] = [0.5, 0.10]
    return cfg


if __name__ == "__main__":
    cfg = analyze(sys.argv[1])
    out = sys.argv[2] if len(sys.argv) > 2 else "config.json"
    json.dump(cfg, open(out, "w"), indent=1)
    print(json.dumps(cfg, indent=1))