#!/usr/bin/env python3
"""
generate_path_landscape.py — Generate landscapes where islands chain along a
winding path that converges on the castle (grammar of the second reference).

Stages:
  1. sky gradient + heavy corner/edge clouds + sun
  2. castle at the path's convergence point, horizon dome behind it
  3. trunk path spline (from --config analysis of a reference, else random
     S-curve) + 1-3 side branches
  4. islands chained along every spline with overlap, scale ramping with y;
     side clusters widen the network
  5. tapered dirt-path polygon drawn over the island chain
  6. foreground terrace + dressing + corner framing trees

Usage:
    python analyze_reference.py reference.png config.json
    python generate_path_landscape.py sprites_svg manifest.json scene.svg \
        --config config.json --seed 5 [--layers]
"""
import argparse
import json
import math
import random

from generate_landscape import Scene, load_sprites, by_role


def catmull(pts, samples=140):
    """Catmull-Rom through control points -> dense polyline."""
    if len(pts) < 3:
        return pts
    P = [pts[0]] + pts + [pts[-1]]
    out = []
    per = max(2, samples // (len(P) - 3))
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for j in range(per):
            t = j / per
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
                       + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                       + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
                for k in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


class PathScene(Scene):
    def __init__(self, W, H, sprites, rng, cfg=None):
        super().__init__(W, H, sprites, rng)
        self.cfg = cfg or {}
        self.paths = []          # list of dense polylines (px coords)
        self.wts = None          # per-sprite dirt weights (trunk selection)

    # ---------- path network ----------
    def build_paths(self):
        W, H, r = self.W, self.H, self.rng
        fx, fy = self.cfg.get("focal", [0.5, 0.10])
        fx = min(0.72, max(0.28, fx + r.uniform(-0.06, 0.06)))
        self.focal = (fx * W, fy * H)
        self.route_focal = (fx * W, min(.38, fy + .16) * H)

        if self.cfg.get("has_path") and self.cfg.get("path_points"):
            # jitter the analyzed centerline for variation, pin ends
            base = self.cfg["path_points"]
            ctrl = []
            for i, (x, y) in enumerate(base[::3]):
                jx = 0 if i == 0 else r.uniform(-0.05, 0.05)
                ctrl.append((min(0.95, max(0.05, x + jx)) * W, y * H))
            ctrl[-1] = self.route_focal
        else:
            # random S-curve from bottom to focal point
            x = r.uniform(0.3, 0.7)
            ctrl, y = [(x * W, H * 1.02)], 1.02
            while y > fy + 0.12:
                y -= r.uniform(0.12, 0.2)
                x = min(0.9, max(0.1, x + r.uniform(-0.22, 0.22)))
                ctrl.append((x * W, y * H))
            ctrl.append(self.route_focal)
        trunk = catmull(ctrl)
        self.paths.append(trunk)

        # side branches leaving the trunk partway up
        for _ in range(r.randint(1, 3)):
            i0 = r.randint(len(trunk) // 4, 3 * len(trunk) // 4)
            bx, by = trunk[i0]
            side = r.choice([-1, 1])
            ctrl = [(bx, by)]
            x, y = bx, by
            for _ in range(r.randint(2, 3)):
                x = min(0.96 * self.W, max(0.04 * self.W,
                        x + side * r.uniform(0.10, 0.22) * self.W))
                y -= r.uniform(0.06, 0.13) * self.H
                ctrl.append((x, y))
            self.paths.append(catmull(ctrl, 60))

    # ---------- islands chained along the paths ----------
    def chain_islands(self):
        W, H, r = self.W, self.H, self.rng
        small = by_role(self.sp, "island_small") or by_role(self.sp, "island_far")
        large = by_role(self.sp, "island_large")
        ground = by_role(self.sp, "ground")
        for pi, poly in enumerate(self.paths):
            dist = 0.0
            prev = poly[0]
            for (x, y) in poly[1:]:
                dist += math.hypot(x - prev[0], y - prev[1])
                prev = (x, y)
                d = max(0.0, min(1.0, (y / H - 0.15) / 0.75))   # depth 0 far..1 near
                if y / H < 0.16 or y / H > 0.92:
                    continue
                step = (26 + 95 * d ** 1.2) if pi == 0 else (32 + 130 * d ** 1.2)
                if dist < step:
                    continue
                dist = 0.0
                # islands with grassy tops carry the path; slabs mix in near
                pool = (small + large) if d < 0.28 else (large if d < 0.8 or not ground
                                               else large + ground)
                if pi == 0 and self.wts is not None:
                    # trunk: prefer sprites with dirt paths painted on top so
                    # the trail emerges from the artwork itself
                    w = [self.wts.get(p, 0.05) for p in pool]
                    n = r.choices(pool, weights=w, k=1)[0]
                else:
                    n = r.choice(pool)
                sc = (0.6 + 1.6 * d ** 1.25) * r.uniform(0.85, 1.15)
                layer = "far" if d < 0.25 else ("mid" if d < 0.55 else "near")
                # center island slightly below the path line so the path
                # rides on its top surface
                self.put(layer, n, x + r.uniform(-0.12, 0.12) * self.sp[n]["w"] * sc,
                         y + self.sp[n]["h"] * sc * 0.28,
                         sc, min(1.0, 0.85 + 0.15 * d), r.random() < 0.5,
                         tint=max(0.0, 0.45 - d))
                # neighbor clusters on both sides widen the chain into a landmass
                for side in (-1, 1):
                    if r.random() < 0.48:
                        m = r.choice(pool)
                        ms = sc * r.uniform(0.55, 0.85)
                        self.put(layer, m,
                                 x + side * self.sp[n]["w"] * sc * r.uniform(0.45, 0.85),
                                 y + self.sp[m]["h"] * ms * 0.3 + r.uniform(0, 0.04) * H,
                                 ms, min(1.0, 0.82 + 0.18 * d), r.random() < 0.5,
                                 tint=max(0.0, 0.45 - d))

    def corridor_fill(self):
        """Scatter islands through the wedge around the path network so the
        land reads as a broad connected mass, like the reference."""
        W, H, r = self.W, self.H, self.rng
        small = by_role(self.sp, "island_small") or by_role(self.sp, "island_far")
        large = by_role(self.sp, "island_large")
        allpts = [p for poly in self.paths for p in poly]
        for _ in range(42):
            x0, y0 = r.choice(allpts)
            d = max(0.0, min(1.0, (y0 / H - 0.15) / 0.75))
            if y0 / H < 0.15 or y0 / H > 0.9:
                continue
            corridor = W * (0.08 + 0.12 * d)
            x = x0 + r.uniform(-1, 1) * corridor
            if not (0.02 * W < x < 0.98 * W):
                continue
            pool = (small + large) if d < 0.28 else large
            n = r.choice(pool)
            sc = (0.5 + 1.4 * d ** 1.25) * r.uniform(0.8, 1.1)
            layer = "far" if d < 0.25 else ("mid" if d < 0.55 else "near")
            self.put(layer, n, x, y0 + r.uniform(0.0, 0.05) * H, sc,
                     min(1.0, 0.84 + 0.16 * d), r.random() < 0.5,
                     tint=max(0.0, 0.45 - d))

    # ---------- draw the dirt path itself ----------
    def draw_paths(self):
        W, H = self.W, self.H
        col = self.cfg.get("path_color", "#c8a76b")
        wb = self.cfg.get("path_width_bottom", 0.075) * W
        wt = max(2.5, self.cfg.get("path_width_top", 0.01) * W * 0.4)
        for pi, poly in enumerate(self.paths):
            left, right = [], []
            for i, (x, y) in enumerate(poly):
                d = max(0.0, min(1.0, (y / H - 0.12) / 0.85))
                w = (wt + (wb - wt) * d ** 1.6) * (1.0 if pi == 0 else 0.6)
                if i == 0:
                    dx, dy = poly[1][0] - x, poly[1][1] - y
                else:
                    dx, dy = x - poly[i - 1][0], y - poly[i - 1][1]
                L = math.hypot(dx, dy) or 1
                nx, ny = -dy / L, dx / L
                left.append((x + nx * w / 2, y + ny * w / 2))
                right.append((x - nx * w / 2, y - ny * w / 2))
            pts = left + right[::-1]
            dstr = "M " + " L ".join(f"{px:.0f},{py:.0f}" for px, py in pts) + " Z"
            center = "M " + " L ".join(f"{px:.0f},{py:.0f}" for px, py in poly)
            # sort-key: bottom of the path so islands placed lower overlap it
            key = max(p[1] for p in poly) - 4
            self.layers["near"].append((key,
                f'<g filter="url(#pathWash)"><path d="{dstr}" fill="{col}" stroke="#a68a55" '
                f'stroke-width="2" opacity="0.86"/>'
                f'<path d="{center}" fill="none" stroke="#e0c890" '
                f'stroke-width="{max(1.5, wt * 0.5):.1f}" opacity="0.5" '
                f'stroke-dasharray="7 11"/></g>'))

    def route_bridges_and_waterfalls(self):
        """Add readable bridge gaps and vertical water below route islands."""
        W, H, r = self.W, self.H, self.rng
        falls = by_role(self.sp, "waterfall")
        for path_index, poly in enumerate(self.paths):
            fractions = (0.30, 0.53, 0.74) if path_index == 0 else (0.42, 0.70)
            for fraction in fractions:
                center_index = min(len(poly) - 8, max(8, int(len(poly) * fraction)))
                a = poly[center_index - 6]
                b = poly[center_index + 6]
                dx, dy = b[0] - a[0], b[1] - a[1]
                length = math.hypot(dx, dy) or 1
                depth = max(.08, min(1.0, ((a[1] + b[1]) * .5 / H - .12) / .82))
                width = (7 + 20 * depth) * (1 if path_index == 0 else .72)
                nx, ny = -dy / length, dx / length
                midx = (a[0] + b[0]) * .5 + nx * width * r.uniform(-.16, .16)
                midy = (a[1] + b[1]) * .5 + ny * width * r.uniform(-.16, .16)
                bridge_path = f'M {a[0]:.0f},{a[1]:.0f} Q {midx:.0f},{midy:.0f} {b[0]:.0f},{b[1]:.0f}'
                rail_a = f'M {a[0] + nx * width * .62:.0f},{a[1] + ny * width * .62:.0f} Q {midx + nx * width * .62:.0f},{midy + ny * width * .62:.0f} {b[0] + nx * width * .62:.0f},{b[1] + ny * width * .62:.0f}'
                rail_b = f'M {a[0] - nx * width * .62:.0f},{a[1] - ny * width * .62:.0f} Q {midx - nx * width * .62:.0f},{midy - ny * width * .62:.0f} {b[0] - nx * width * .62:.0f},{b[1] - ny * width * .62:.0f}'
                bridge = (
                    f'<g opacity=".96" filter="url(#pathWash)">'
                    f'<path d="{bridge_path}" fill="none" stroke="#756248" stroke-width="{width + 7:.1f}" stroke-linecap="round"/>'
                    f'<path d="{bridge_path}" fill="none" stroke="#d9bf85" stroke-width="{width:.1f}" stroke-linecap="round" stroke-dasharray="5 3"/>'
                    f'<path d="{rail_a}" fill="none" stroke="#665b4c" stroke-width="2.4" stroke-dasharray="3 7"/>'
                    f'<path d="{rail_b}" fill="none" stroke="#665b4c" stroke-width="2.4" stroke-dasharray="3 7"/>'
                    f'</g>')
                self.layers["near"].append((max(a[1], b[1]) + width, bridge))

            if falls:
                fall_count = 2 if path_index == 0 else 1
                for fall_index in range(fall_count):
                    fraction = (.39, .68)[fall_index] if path_index == 0 else .58
                    x, y = poly[min(len(poly) - 1, int(len(poly) * fraction))]
                    depth = max(.12, min(1.0, (y / H - .12) / .82))
                    name = r.choice(falls)
                    scale = .23 + .52 * depth
                    side = -1 if (fall_index + path_index) % 2 == 0 else 1
                    self.put("near", name, x + side * (24 + 48 * depth),
                             y + self.sp[name]["h"] * scale * .40,
                             scale, .78 + .18 * depth, side < 0)

    # ---------- cloud-heavy sky per the reference ----------
    def cloud_masses(self):
        W, H, r = self.W, self.H, self.rng
        clouds = by_role(self.sp, "cloud")
        # towering masses along both side edges (down to mid height)
        for side in (0.03, 0.97):
            y = 0.05
            while y < 0.62:
                n = r.choice(clouds)
                self.put("far", n, W * (side + r.uniform(-0.03, 0.03)),
                         H * y, r.uniform(1.3, 2.1), r.uniform(0.85, 1.0),
                         r.random() < 0.5)
                y += r.uniform(0.10, 0.17)
        # puffs drifting between islands
        for _ in range(r.randint(6, 10)):
            n = r.choice(clouds)
            self.put("mid", n, r.uniform(0.1, 0.9) * W,
                     H * r.uniform(0.25, 0.75),
                     r.uniform(0.7, 1.3), r.uniform(0.4, 0.7), r.random() < 0.5)

    def castle_and_dome(self):
        W, H, r = self.W, self.H, self.rng
        castle = by_role(self.sp, "castle")
        # greener sprites at small scale read as warm distant land (this
        # grammar's horizon is sunlit, not hazed out)
        far = (by_role(self.sp, "island_small") + by_role(self.sp, "island_large")
               + by_role(self.sp, "island_far"))
        mts = by_role(self.sp, "mountain") or far
        fx, fy = self.focal
        # dome band behind the castle
        for row_dy, smin, smax in [(0.03, 0.5, 0.8), (0.075, 0.6, 0.95),
                                    (0.125, 0.7, 1.1)]:
            x = -20
            while x < W:
                n = r.choice(far)
                sc = r.uniform(smin, smax)
                self.put("far", n, x, fy + H * (row_dy + r.uniform(-0.015, 0.015)),
                         sc, r.uniform(0.82, 0.95), r.random() < 0.5, tint=0.3)
                x += self.sp[n]["w"] * sc * r.uniform(0.5, 0.85)
        for cx, flip in [(W * r.uniform(0.06, 0.14), False),
                         (W * r.uniform(0.86, 0.94), True)]:
            self.put("far", r.choice(mts), cx, fy + H * r.uniform(0.04, 0.10),
                     r.uniform(0.8, 1.2), 0.85, flip, tint=0.35)
        if castle:
            name = "castle_final_island" if "castle_final_island" in castle else castle[0]
            target_width = W * r.uniform(.31, .36)
            scale = target_width / self.sp[name]["w"]
            castle_height = self.sp[name]["h"] * scale
            center_y = max(fy + H * .08, castle_height * .5 + H * .01)
            self.put("far", name, fx, center_y, scale, 1.0)

    def foreground_terrace(self):
        W, H, r = self.W, self.H, self.rng
        grounds = by_role(self.sp, "ground")
        rocks = by_role(self.sp, "rock")
        trees = by_role(self.sp, "tree", "tree_big")
        bushes = by_role(self.sp, "bush")
        flowers = by_role(self.sp, "flower")
        x = -W * 0.05
        while x < W * 1.05:
            n = r.choice(grounds)
            sc = r.uniform(1.4, 2.0)
            w = self.sp[n]["w"] * sc
            self.put("fg", n, x + w * 0.4, H * r.uniform(0.99, 1.06), sc,
                     1.0, r.random() < 0.5)
            x += w * r.uniform(0.42, 0.6)
        surface = lambda: H * r.uniform(0.88, 0.99)
        for pool, cnt, smin, smax in [(rocks, (4, 6), 0.3, 0.6),
                                      (bushes, (3, 5), 0.5, 0.9),
                                      (flowers, (8, 12), 0.55, 0.95)]:
            for _ in range(r.randint(*cnt)):
                self.put("fg", r.choice(pool), r.uniform(0.04, 0.96) * W,
                         surface(), r.uniform(smin, smax), 1.0, r.random() < 0.5)
        for cx, flip in [(W * r.uniform(0.02, 0.07), False),
                         (W * r.uniform(0.91, 0.97), True)]:
            self.put("fg", r.choice(trees), cx, H * r.uniform(0.78, 0.86),
                     r.uniform(1.7, 2.4), 1.0, flip)


def dirt_weights(sprites, names, manifest):
    d = json.load(open(manifest))
    return [0.05 + (d[n].get("dirt", 0) ** 2) * 12 for n in names]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svg_dir")
    ap.add_argument("manifest")
    ap.add_argument("output")
    ap.add_argument("--config", default=None)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--layers", action="store_true")
    ap.add_argument("--no-sun", dest="sun", action="store_false")
    ap.add_argument("--path-overlay", action="store_true",
                    help="draw the procedural dirt-ribbon (off by default)")
    args = ap.parse_args()

    cfg = json.load(open(args.config)) if args.config else {}
    # feed analyzed palette into the shared gradient
    import generate_landscape as gl
    gl.SKY_TOP = cfg.get("sky_top", gl.SKY_TOP)
    gl.HAZE = cfg.get("haze", gl.HAZE)
    gl.WATER = cfg.get("water", gl.WATER)
    gl.WATER_DEEP = cfg.get("water", gl.WATER)

    rng = random.Random(args.seed)
    sprites = load_sprites(args.svg_dir, args.manifest)
    sc = PathScene(args.width, args.height, sprites, rng, cfg)
    dm = json.load(open(args.manifest))
    sc.wts = {n: 0.05 + (dm[n].get("dirt", 0) ** 2) * 12 for n in sprites}
    sc.build_paths()
    sc.sky_and_clouds(sun=args.sun)
    sc.flowing_water(1.25)
    sc.cloud_masses()
    sc.castle_and_dome()
    sc.chain_islands()
    sc.corridor_fill()
    if args.path_overlay:
        sc.draw_paths()
    sc.route_bridges_and_waterfalls()
    sc.foreground_terrace()
    sc.write(args.output if args.output.endswith(".svg") or args.layers
             else args.output + ".svg", split_layers=args.layers)


if __name__ == "__main__":
    main()
