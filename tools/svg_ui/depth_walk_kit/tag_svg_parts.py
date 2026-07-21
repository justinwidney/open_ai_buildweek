#!/usr/bin/env python3
"""
tag_svg_parts.py — Annotate sprite SVGs with semantic classes per path.

Every vtracer <path> gets class="dirt|grass|rock|water|light|detail" based on
its fill color, WITHOUT reordering (vtracer's stacked paint order must be
preserved). Output goes to <svg_dir>_tagged/. This makes the parts
addressable from CSS/JS/Three.js, e.g.:

    svg.querySelectorAll('path.dirt')     // the painted trail pieces
    path.grass { filter: hue-rotate(...) } // recolor seasons

Also prints a per-sprite composition summary.

Usage: python tag_svg_parts.py out/svg
"""
import glob
import os
import re
import sys
from collections import Counter


def classify_fill(hexcol):
    m = re.match(r"#?([0-9a-fA-F]{6})", hexcol or "")
    if not m:
        return "detail"
    r, g, b = (int(m.group(1)[i:i + 2], 16) for i in (0, 2, 4))
    mx, mn = max(r, g, b), min(r, g, b)
    if mx > 232 and mn > 218:
        return "light"                       # highlights / mist / snow
    if r > 160 and r > b + 28 and b + 8 < g < r + 12 and b > 80:
        return "dirt"                        # the painted path/beige
    if g >= b and g > r * 0.78 and g > 58 and (g - b) + (g - min(r, g)) > 14:
        return "grass"                       # olive/green vegetation
    if b > r + 12 and b > 110:
        return "water"                       # water, waterfalls, blue mist
    if mx - mn < 34:
        return "rock"                        # gray stone base
    return "detail"


def tag_file(path, out_path):
    src = open(path).read()
    counts = Counter()

    def sub(m):
        tag = m.group(0)
        fill = re.search(r'fill="([^"]+)"', tag)
        cls = classify_fill(fill.group(1) if fill else "")
        counts[cls] += 1
        return tag[:-1] + f' class="{cls}">'

    out = re.sub(r"<path\b[^>]*>", sub, src)
    open(out_path, "w").write(out)
    return counts


def main():
    svg_dir = sys.argv[1] if len(sys.argv) > 1 else "out/svg"
    out_dir = svg_dir.rstrip("/").rstrip("\\") + "_tagged"
    os.makedirs(out_dir, exist_ok=True)
    total = Counter()
    for p in sorted(glob.glob(os.path.join(svg_dir, "*.svg"))):
        name = os.path.basename(p)
        c = tag_file(p, os.path.join(out_dir, name))
        total += c
        parts = " ".join(f"{k}:{v}" for k, v in c.most_common())
        print(f"{name:18s} {parts}")
    print("\nTOTAL:", dict(total.most_common()))
    print("tagged SVGs ->", out_dir)


if __name__ == "__main__":
    main()
