#!/usr/bin/env python3
"""
generate_landscape.py — Generate random landscapes matching the reference grammar:

  1. sky gradient: blue -> white haze at horizon -> soft water blue
  2. clouds hugging the top edge, big ones anchoring the corners
  3. castle island at top-center focal point
  4. far islands/mountains arcing outward from the castle along the horizon
  5. midfield floating islands: scale & opacity ramp with y (depth),
     blue atmospheric tint on far ones, waterfall islands preferred low
  6. foreground: continuous ground terrace built from overlapping slabs,
     dressed with rocks/bushes/flowers, framed by big trees in the corners

Painted back-to-front so nearer sprites overlap farther ones.

Usage:
    python generate_landscape.py out/svg manifest.json scene.svg --seed 3
    python generate_landscape.py out/svg manifest.json scene --layers  # sky/far/mid/near/fg
Options: --width --height --density --sun/--no-sun
"""
import argparse
import glob
import json
import math
import os
import random
import re

# colors sampled from the reference image
SKY_TOP = "#77a3d4"
HAZE = "#ece9e4"
WATER = "#98abbd"
WATER_DEEP = "#8aa0b5"


def load_sprites(svg_dir, manifest):
    man = json.load(open(manifest))
    sprites = {}
    for p in sorted(glob.glob(os.path.join(svg_dir, "**", "*.svg"), recursive=True)):
        name = os.path.splitext(os.path.basename(p))[0]
        if name not in man:
            continue
        src = open(p).read()
        m = re.search(r'width="(\d+)" height="(\d+)"', src)
        inner = re.sub(r"^.*?<svg[^>]*>", "", src, flags=re.S)
        inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)
        sprites[name] = {
            "inner": inner, "w": int(m.group(1)), "h": int(m.group(2)),
            "role": man[name]["role"],
        }
    return sprites


def by_role(sprites, *roles):
    return [n for n, s in sprites.items() if s["role"] in roles]


class Scene:
    def __init__(self, W, H, sprites, rng):
        self.W, self.H, self.sp, self.rng = W, H, sprites, rng
        self.layers = {k: [] for k in ("sky", "water", "far", "mid", "near", "fg")}

    def put(self, layer, name, cx, cy, scale, opacity=1.0, flip=False,
            tint=0.0):
        """Place sprite centered at (cx, cy). tint: 0..1 atmospheric blue."""
        s = self.sp[name]
        w, h = s["w"] * scale, s["h"] * scale
        x, y = cx - w / 2, cy - h / 2
        t = f"translate({x:.0f},{y:.0f}) scale({scale:.3f})"
        if flip:
            t = f"translate({x + w:.0f},{y:.0f}) scale({-scale:.3f},{scale:.3f})"
        cls = ' class="atm"' if tint > 0.45 else (' class="atm2"' if tint > 0.15 else "")
        self.layers[layer].append(
            (cy + h / 2,  # paint order key: bottom edge (lower = nearer)
             f'<use href="#{name}" transform="{t}" opacity="{opacity:.2f}"{cls}/>'))

    # ---------------- grammar stages ----------------
    def sky_and_clouds(self, sun=True):
        W, H, r = self.W, self.H, self.rng
        clouds = by_role(self.sp, "cloud")
        # corner anchors
        for cx, flip in [(W * 0.07, False), (W * 0.93, True)]:
            n = r.choice(clouds)
            self.put("sky", n, cx, H * r.uniform(0.05, 0.10),
                     r.uniform(1.4, 2.0), r.uniform(0.9, 1.0), flip)
        # top edge scatter
        for _ in range(r.randint(4, 6)):
            n = r.choice(clouds)
            self.put("sky", n, r.uniform(0.12, 0.88) * W,
                     H * r.uniform(0.02, 0.12),
                     r.uniform(0.6, 1.2), r.uniform(0.55, 0.85), r.random() < 0.5)
        if sun:
            sx, sy, sr = W * r.uniform(0.82, 0.9), H * r.uniform(0.06, 0.11), H * 0.045
            rays = "".join(
                f'<line x1="{sx + math.cos(a) * sr * 1.35:.0f}" y1="{sy + math.sin(a) * sr * 1.35:.0f}" '
                f'x2="{sx + math.cos(a) * sr * 1.9:.0f}" y2="{sy + math.sin(a) * sr * 1.9:.0f}" '
                f'stroke="#e8b64c" stroke-width="{sr * 0.12:.1f}" stroke-linecap="round"/>'
                for a in [i * math.pi / 6 for i in range(12)])
            self.layers["sky"].append((0,
                f'<g opacity="0.9">{rays}<circle cx="{sx:.0f}" cy="{sy:.0f}" r="{sr:.0f}" '
                f'fill="#f2c96b" stroke="#d9a33c" stroke-width="2"/></g>'))

    def flowing_water(self, density=1.0):
        """Build a broad watercolor sea from overlapping reusable flow SVGs."""
        W, H, r = self.W, self.H, self.rng
        flows = by_role(self.sp, "water_flow")
        pools = by_role(self.sp, "water")
        if flows:
            for row, y in enumerate((0.30, 0.48, 0.66, 0.84)):
                x = -W * 0.10 - (row % 2) * W * 0.13
                while x < W * 1.10:
                    name = r.choice(flows)
                    scale = (W / max(1, self.sp[name]["w"])) * r.uniform(.52, .68)
                    self.put("water", name, x + self.sp[name]["w"] * scale / 2,
                             H * y, scale, r.uniform(.42, .64), row % 2 == 1)
                    x += self.sp[name]["w"] * scale * r.uniform(.62, .78)
        if pools:
            for _ in range(max(5, int(10 * density))):
                name = r.choice(pools)
                self.put("water", name, r.uniform(.04, .96) * W,
                         r.uniform(.30, .90) * H, r.uniform(.8, 1.8),
                         r.uniform(.14, .28), r.random() < .5)

    def horizon(self):
        """Castle focal point + far islands arcing away from it."""
        W, H, r = self.W, self.H, self.rng
        castle = by_role(self.sp, "castle")
        fx = W * r.uniform(0.42, 0.58)
        fy = H * r.uniform(0.09, 0.13)
        if castle:
            self.put("far", castle[0], fx, fy, r.uniform(1.1, 1.5), 0.95)
        far = by_role(self.sp, "island_far", "mountain_far")
        mts = by_role(self.sp, "mountain") or far
        # arcs radiating down/outward from the focal point
        for arc in range(4):
            ry = H * (0.04 + 0.045 * arc)
            count = 6 + arc * 3
            for i in range(count):
                t = (i + r.uniform(-0.3, 0.3)) / max(count - 1, 1)
                x = fx + (t - 0.5) * W * (0.55 + 0.4 * arc)
                y = fy + ry * math.sin(math.pi * min(max(t, 0), 1)) ** 0.5 \
                    + ry * 0.6
                if not (0 <= x <= W):
                    continue
                n = r.choice(far)
                self.put("far", n, x, y, r.uniform(0.7, 1.05) * (1 + arc * 0.28),
                         r.uniform(0.7, 0.9), r.random() < 0.5, tint=0.5)
        # dense band across the full horizon (the "world dome" in the reference)
        x = -20
        while x < W:
            n = r.choice(far)
            sc = r.uniform(0.6, 1.0)
            self.put("far", n, x, H * r.uniform(0.14, 0.21), sc,
                     r.uniform(0.65, 0.85), r.random() < 0.5, tint=0.5)
            x += self.sp[n]["w"] * sc * r.uniform(0.7, 1.1)
        # mountains guarding the left/right edges (as in the reference)
        for cx, flip in [(W * r.uniform(0.03, 0.10), False),
                         (W * r.uniform(0.90, 0.97), True)]:
            self.put("far", r.choice(mts), cx, H * r.uniform(0.20, 0.30),
                     r.uniform(0.9, 1.4), r.uniform(0.8, 0.95), flip, tint=0.3)

    def midfield(self, density=1.0):
        """Jittered grid of floating islands; scale/opacity ramp with depth."""
        W, H, r = self.W, self.H, self.rng
        small = by_role(self.sp, "island_small") or by_role(self.sp, "island_far")
        large = by_role(self.sp, "island_large")
        water = by_role(self.sp, "water")
        rows = 7
        for row in range(rows):
            d = row / (rows - 1)              # 0 = far, 1 = near
            y = H * (0.17 + 0.56 * d ** 1.15)
            cell = W / max(3, int((11 - 5.5 * d) * density))
            x = r.uniform(-cell * 0.3, 0)
            while x < W:
                if r.random() < 0.88:
                    pool = small if d < 0.3 else large
                    n = r.choice(pool)
                    sc = (0.62 + 1.25 * d ** 1.25) * r.uniform(0.85, 1.15)
                    self.put("mid" if d < 0.6 else "near", n,
                             x + r.uniform(0.2, 0.8) * cell,
                             y + r.uniform(-0.05, 0.05) * H,
                             sc, min(1.0, 0.72 + 0.3 * d),
                             r.random() < 0.5, tint=max(0.0, 0.55 - d))
                x += cell
            # occasional water shimmer between islands
            if water and r.random() < 0.7:
                self.put("mid", r.choice(water), r.uniform(0.15, 0.85) * W,
                         y + H * 0.02, r.uniform(0.5, 0.9) * (0.6 + d),
                         0.35 + 0.2 * d, tint=0.3)

    def foreground(self, density=1.0):
        """Continuous terrace of ground slabs + dressing + corner trees."""
        W, H, r = self.W, self.H, self.rng
        grounds = by_role(self.sp, "ground")
        rocks = by_role(self.sp, "rock")
        trees = by_role(self.sp, "tree", "tree_big")
        bushes = by_role(self.sp, "bush")
        flowers = by_role(self.sp, "flower")

        # overlapping slabs across the bottom edge -> continuous terrace
        x = -W * 0.05
        while x < W * 1.05:
            n = r.choice(grounds)
            sc = r.uniform(1.3, 1.9)
            w = self.sp[n]["w"] * sc
            self.put("fg", n, x + w * 0.4, H * r.uniform(0.97, 1.04),
                     sc, 1.0, r.random() < 0.5)
            x += w * r.uniform(0.45, 0.65)   # heavy overlap hides seams

        surface = lambda: H * r.uniform(0.86, 0.985)
        # rocks and bushes
        for _ in range(int(r.randint(4, 6) * density)):
            self.put("fg", r.choice(rocks), r.uniform(0.05, 0.95) * W,
                     surface(), r.uniform(0.35, 0.7), 1.0, r.random() < 0.5)
        for _ in range(int(r.randint(3, 5) * density)):
            self.put("fg", r.choice(bushes), r.uniform(0.05, 0.95) * W,
                     surface(), r.uniform(0.5, 0.9), 1.0, r.random() < 0.5)
        for _ in range(int(r.randint(5, 8) * density)):
            self.put("fg", r.choice(flowers), r.uniform(0.04, 0.96) * W,
                     surface(), r.uniform(0.5, 0.9), 1.0, r.random() < 0.5)
        # framing trees in the bottom corners (key to the reference's depth)
        for cx, flip in [(W * r.uniform(0.02, 0.08), False),
                         (W * r.uniform(0.90, 0.97), True)]:
            n = r.choice(trees)
            self.put("fg", n, cx, H * r.uniform(0.80, 0.88),
                     r.uniform(1.6, 2.3), 1.0, flip)
        # a couple of mid-size trees on the terrace
        for _ in range(r.randint(1, 3)):
            self.put("fg", r.choice(trees), r.uniform(0.15, 0.85) * W,
                     H * r.uniform(0.88, 0.94), r.uniform(0.7, 1.1), 1.0,
                     r.random() < 0.5)

    # ---------------- output ----------------
    def _style(self):
        W, H = self.W, self.H
        return f"""
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{SKY_TOP}"/>
      <stop offset="0.14" stop-color="{HAZE}"/>
      <stop offset="0.34" stop-color="{WATER}"/>
      <stop offset="0.80" stop-color="{WATER_DEEP}"/>
    </linearGradient>
    <filter id="atm"><feColorMatrix type="matrix"
      values="0.85 0 0 0 0.08  0 0.90 0 0 0.08  0 0 0.95 0 0.12  0 0 0 0.92 0"/>
      <feGaussianBlur stdDeviation="0.5"/></filter>
    <filter id="atm2"><feColorMatrix type="matrix"
      values="0.93 0 0 0 0.03  0 0.96 0 0 0.03  0 0 1 0 0.05  0 0 0 1 0"/></filter>
    <filter id="pathWash" x="-5%" y="-8%" width="110%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency=".018 .035" numOctaves="2" seed="23" result="paper"/>
      <feDisplacementMap in="SourceGraphic" in2="paper" scale="4" xChannelSelector="R" yChannelSelector="B"/>
    </filter>
  </defs>
  <style>.atm{{filter:url(#atm)}}.atm2{{filter:url(#atm2)}}</style>"""

    def _defs(self, body):
        used = set(re.findall(r'href="#([^"]+)"', body))
        return "<defs>" + "".join(
            f'<g id="{n}">{self.sp[n]["inner"]}</g>'
            for n in sorted(used)) + "</defs>"

    def _layer_body(self, name):
        return "\n".join(u for _, u in sorted(self.layers[name], key=lambda t: t[0]))

    def write(self, path, split_layers=False):
        W, H = self.W, self.H
        bg_rect = f'<rect width="{W}" height="{H}" fill="url(#bg)"/>'
        if split_layers:
            base = path.replace(".svg", "")
            order = ["sky", "water", "far", "mid", "near", "fg"]
            for i, nm in enumerate(order):
                body = self._layer_body(nm)
                bg = bg_rect if i == 0 else ""
                doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" '
                       f'height="{H}" viewBox="0 0 {W} {H}">{self._style()}'
                       f'{self._defs(body)}{bg}\n{body}\n</svg>')
                open(f"{base}_{i}_{nm}.svg", "w").write(doc)
                print("wrote", f"{base}_{i}_{nm}.svg")
        else:
            body = "\n".join(self._layer_body(n)
                             for n in ["sky", "water", "far", "mid", "near", "fg"])
            doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" '
                   f'height="{H}" viewBox="0 0 {W} {H}">{self._style()}'
                   f'{self._defs(body)}{bg_rect}\n{body}\n</svg>')
            open(path, "w").write(doc)
            print("wrote", path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svg_dir")
    ap.add_argument("manifest")
    ap.add_argument("output")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--density", type=float, default=1.0)
    ap.add_argument("--layers", action="store_true")
    ap.add_argument("--no-sun", dest="sun", action="store_false")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    sprites = load_sprites(args.svg_dir, args.manifest)
    sc = Scene(args.width, args.height, sprites, rng)
    sc.sky_and_clouds(sun=args.sun)
    sc.flowing_water(args.density)
    sc.horizon()
    sc.midfield(args.density)
    sc.foreground(args.density)
    sc.write(args.output if args.output.endswith(".svg") or args.layers
             else args.output + ".svg", split_layers=args.layers)


if __name__ == "__main__":
    main()
