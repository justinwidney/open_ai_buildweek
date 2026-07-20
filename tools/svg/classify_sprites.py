#!/usr/bin/env python3
"""
classify_sprites.py — Tag each sprite PNG with a scene role using color/shape stats.

Roles: cloud, water, island, mountain, castle, tree, bush, flower, rock, ground
Writes manifest.json: {name: {role, w, h, area}}
Heuristics are tuned for this watercolor sheet; override any entry in the
manifest by hand if one lands wrong.
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image


def stats(path):
    a = np.array(Image.open(path).convert("RGBA")).astype(float)
    rgb, al = a[..., :3], a[..., 3]
    m = al > 40
    if m.sum() == 0:
        return None
    r, g, b = (rgb[..., i][m] for i in range(3))
    h, w = a.shape[:2]
    ys, xs = np.where(m)
    # fraction of opaque pixels in bottom half that are grayish (rocky underside)
    bot = m & (np.arange(h)[:, None] > h * 0.55)
    if bot.sum() > 0:
        rb, gb, bb = (rgb[..., i][bot] for i in range(3))
        gray_bot = ((abs(rb - gb) < 25) & (abs(gb - bb) < 25) & (rb > 90) & (rb < 210)).mean()
    else:
        gray_bot = 0.0
    green = (g > r * 0.95) & (g > b * 1.08) & (g > 70)
    blue = (b > r * 1.08) & (b > g * 1.02)
    white = (r > 215) & (g > 215) & (b > 210)
    pink_yellow = ((r > 200) & (b > 170) & (g < r)) | ((r > 200) & (g > 170) & (b < 140))
    return {
        "w": w, "h": h, "area": int(m.sum()), "aspect": w / h,
        "green": green.mean(), "blue": blue.mean(), "white": white.mean(),
        "accent": pink_yellow.mean(), "gray_bot": gray_bot,
        "fill": m.mean(),
        "cy": ys.mean() / h,  # center of mass (low = top-heavy)
    }


def role(s):
    if s["white"] + s["blue"] > 0.72 and s["green"] < 0.08:
        return "water" if s["blue"] > s["white"] * 1.5 and s["aspect"] > 1.4 else "cloud"
    if s["accent"] > 0.10 and s["w"] < 130 and s["h"] < 130:
        return "flower"
    if s["green"] > 0.45 and s["gray_bot"] < 0.18 and s["aspect"] < 1.15:
        return "tree" if s["h"] > s["w"] * 1.15 else "bush"
    if s["green"] < 0.12 and s["gray_bot"] > 0.15:
        return "mountain" if s["h"] > s["w"] * 0.85 else "rock"
    if s["green"] > 0.10 and s["gray_bot"] > 0.15:
        # green top + rocky underside = floating island; wide & flat = ground slab
        if s["aspect"] > 2.2 and s["cy"] > 0.45:
            return "ground"
        return "island"
    if s["green"] > 0.25:
        return "bush"
    return "rock"


def main():
    png_dir = sys.argv[1] if len(sys.argv) > 1 else "out/png"
    out = {}
    for p in sorted(glob.glob(os.path.join(png_dir, "*.png"))):
        name = os.path.splitext(os.path.basename(p))[0]
        s = stats(p)
        if s is None:
            continue
        out[name] = {"role": role(s), "w": s["w"], "h": s["h"],
                     "area": s["area"],
                     **{k: round(s[k], 3) for k in
                        ("green", "blue", "white", "gray_bot", "aspect", "accent")}}
    with open("manifest.json", "w") as f:
        json.dump(out, f, indent=1)
    from collections import Counter
    print(Counter(v["role"] for v in out.values()))


if __name__ == "__main__":
    main()
