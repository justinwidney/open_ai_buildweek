#!/usr/bin/env python3
"""
compose_world.py — Compose sprite SVGs into a single layered world background.

Depth recipe for a "real"-feeling scene:
  - far layer:   small sprites, high up, low opacity, slight blue tint, blur
  - mid layer:   medium sprites, mid band, medium opacity
  - near layer:  large sprites, lower band, full opacity, larger scale

Each sprite SVG's inner content is inlined into a <g> so the output is a
single self-contained SVG (also exports a per-layer version for Three.js
parallax planes with --layers).

Usage:
    python compose_world.py out/svg world.svg --width 2048 --height 1024 --seed 7
    python compose_world.py out/svg world --layers   # world_far.svg, world_mid.svg, world_near.svg
"""
import argparse
import glob
import os
import random
import re


def load_sprite(path):
    """Return (inner_markup, width, height) from a vtracer SVG."""
    src = open(path).read()
    m = re.search(r'width="(\d+)" height="(\d+)"', src)
    w, h = int(m.group(1)), int(m.group(2))
    inner = re.sub(r"^.*?<svg[^>]*>", "", src, flags=re.S)
    inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)
    return inner, w, h


def place(defs_id, x, y, scale, opacity, extra=""):
    return (f'<use href="#{defs_id}" transform="translate({x:.0f},{y:.0f}) '
            f'scale({scale:.2f})" opacity="{opacity:.2f}" {extra}/>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svg_dir")
    ap.add_argument("output")
    ap.add_argument("--width", type=int, default=2048)
    ap.add_argument("--height", type=int, default=1024)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--layers", action="store_true",
                    help="write separate far/mid/near SVGs for parallax planes")
    ap.add_argument("--density", type=float, default=1.0)
    args = ap.parse_args()

    random.seed(args.seed)
    W, H = args.width, args.height

    sprites = []
    for p in sorted(glob.glob(os.path.join(args.svg_dir, "**", "*.svg"), recursive=True)):
        inner, w, h = load_sprite(p)
        name = os.path.splitext(os.path.basename(p))[0]
        sprites.append({"id": name, "inner": inner, "w": w, "h": h,
                        "area": w * h})

    # crude size buckets = depth buckets (small art was drawn as far elements)
    sprites.sort(key=lambda s: s["area"])
    n = len(sprites)
    far, mid, near = sprites[: n // 3], sprites[n // 3: 2 * n // 3], sprites[2 * n // 3:]

    def defs_for(body):
        used = set(re.findall(r'href="#([^"]+)"', body))
        return "\n".join(f'<g id="{s["id"]}">{s["inner"]}</g>'
                         for s in sprites if s["id"] in used)

    def layer(pool, count, y_band, scale_range, opacity_range, cls):
        uses = []
        for _ in range(int(count * args.density)):
            s = random.choice(pool)
            sc = random.uniform(*scale_range)
            x = random.uniform(-s["w"] * sc * 0.3, W - s["w"] * sc * 0.5)
            y = random.uniform(y_band[0] * H, y_band[1] * H) - s["h"] * sc / 2
            op = random.uniform(*opacity_range)
            uses.append(place(s["id"], x, y, sc, op, f'class="{cls}"'))
        return "\n".join(uses)

    far_l = layer(far, 18, (0.02, 0.45), (0.7, 1.1), (0.35, 0.6), "far")
    mid_l = layer(mid, 12, (0.25, 0.70), (0.8, 1.3), (0.65, 0.85), "mid")
    near_l = layer(near, 7, (0.55, 0.95), (1.0, 1.6), (0.95, 1.0), "near")

    style = """
  <style>
    .far { filter: url(#atmos); }
  </style>
  <defs>
    <filter id="atmos"><feGaussianBlur stdDeviation="0.6"/>
      <feColorMatrix type="matrix"
        values="0.92 0 0 0 0.03  0 0.95 0 0 0.03  0 0 1 0 0.06  0 0 0 1 0"/>
    </filter>
  </defs>"""

    def doc(body):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" '
                f'width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
                f'{style}<defs>{defs_for(body)}</defs>\n{body}\n</svg>')

    if args.layers:
        base = args.output.replace(".svg", "")
        for nm, body in [("far", far_l), ("mid", mid_l), ("near", near_l)]:
            path = f"{base}_{nm}.svg"
            open(path, "w").write(doc(body))
            print("wrote", path)
    else:
        open(args.output, "w").write(doc(far_l + "\n" + mid_l + "\n" + near_l))
        print("wrote", args.output)


if __name__ == "__main__":
    main()
