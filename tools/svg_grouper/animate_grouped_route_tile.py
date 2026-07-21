#!/usr/bin/env python3
"""
animate_grouped_route_tile.py -- Add sway/drift/flow/sun/wind-line motion to a
route tile SVG that has already been through group_svg_objects.py.

Why this exists instead of reusing depth_walk_kit/animate_traced_svg.py's
classify(): that script buckets by raw fill color + bbox geometry, which
works well for cloud/waterfall/water (distinct hues) but fails for trees --
VTracer paints each pine tree from many low-saturation olive/gray fragments
that are barely distinguishable from rock/shadow by color alone (validated:
color-only heuristic only tags scattered fragments of trees, producing a
glitchy detached-fragment sway instead of a whole tree bending). The grouper's
visibility-based segmentation already isolates each tree clump as a real
"vegetation_NN" subgroup, so this script rides on top of that instead of
re-deriving object boundaries from color.

Sun and wind-line streaks aren't produced as their own groups by the grouper
(no auto-label for them), so those two are still found with a small
color+geometry heuristic, validated by rendering a garish debug overlay
against 01_straight and eyeballing it: 5/5 sun paths hit the actual sun disc
+ rays in the top-right corner, ~25 wind-line paths hit the dashed streak
marks scattered over the water, both with negligible false positives.

Usage:
  python animate_grouped_route_tile.py grouped.svg groups.json -o animated.svg
"""
import argparse
import json
import re
import zlib


def hexrgb(fill):
    return tuple(int(fill[i:i + 2], 16) for i in (1, 3, 5))


def is_sun(fill, x0, y0, x1, y1, W, H):
    r, g, b = hexrgb(fill)
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return False
    cx, cy = (x0 + x1) / 2 / W, (y0 + y1) / 2 / H
    return r > 220 and 150 < g < 225 and b < 175 and r > g + 15 and cx > 0.8 and cy < 0.15


def is_windline(fill, x0, y0, x1, y1):
    r, g, b = hexrgb(fill)
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return False
    area = w * h
    light = min(r, g, b) > 150
    return light and w > h * 2.2 and 0 < h < 8 and w > 8 and area < 400


def collect_vegetation_classes(groups_json):
    veg = set()
    for obj in groups_json.get("objects", []):
        for sub in obj.get("subgroups", []):
            if sub["label"].startswith("vegetation"):
                veg.add(sub["id"])
    return veg


def stable_delay(seed_text, span):
    """Deterministic pseudo-random offset in [0, span) so repeated runs are stable."""
    return (zlib.crc32(seed_text.encode()) % 1000) / 1000 * span


CSS = """
<style>
  @keyframes cloud-sway   { from { transform: translateX(-3px);} to { transform: translateX(3px);} }
  @keyframes cloud-drift  { from { transform: translateX(-40px);} to { transform: translateX(40px);} }
  @keyframes fall-flow    { 0% { transform: translateY(-10px); opacity: 0;}
                            25% { opacity: .55;} 75% { opacity: .55;}
                            100% { transform: translateY(16px); opacity: 0;} }
  @keyframes water-glim   { 0%, 100% { filter: brightness(1);} 50% { filter: brightness(1.16);} }
  @keyframes tree-sway    { 0%, 100% { transform: rotate(-1deg);} 50% { transform: rotate(1.4deg);} }
  @keyframes sun-drift    { 0%, 100% { transform: translate(0,0);} 50% { transform: translate(-6px,4px);} }
  @keyframes sun-glow     { 0%, 100% { opacity: 1;} 50% { opacity: .8;} }
  @keyframes wind-shimmer { 0% { transform: translateX(-5px); opacity: .35;}
                            50% { opacity: .85;}
                            100% { transform: translateX(5px); opacity: .35;} }

  .cloud-obj        { animation: cloud-sway 24s ease-in-out infinite alternate; }
  .cloud-drift-clone{ animation: cloud-drift 65s ease-in-out infinite alternate; opacity: .45; }
  .fall-clone       { animation: fall-flow 2.4s linear infinite; }
  .water-obj        { animation: water-glim 6s ease-in-out infinite; transform-box: fill-box; }
  .tree-cluster      { animation: tree-sway 5s ease-in-out infinite;
                        transform-box: fill-box; transform-origin: 50% 92%; }
  .sun-part          { animation: sun-drift 46s ease-in-out infinite, sun-glow 9s ease-in-out infinite;
                        transform-box: fill-box; transform-origin: 50% 50%; }
  .wind-line         { animation: wind-shimmer 5s ease-in-out infinite;
                        transform-box: fill-box; transform-origin: 50% 50%; }
  .cloud-obj, .cloud-drift-clone, .fall-clone, .water-obj,
  .tree-cluster, .sun-part, .wind-line { will-change: transform, opacity; }
  path { transform-box: fill-box; transform-origin: center; }
</style>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("grouped_svg")
    ap.add_argument("groups_json")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--max-cloud-clones", type=int, default=14)
    ap.add_argument("--max-waterfall-clones", type=int, default=40)
    args = ap.parse_args()

    src = open(args.grouped_svg, encoding="utf-8").read()
    groups = json.load(open(args.groups_json, encoding="utf-8"))

    m = re.search(r'width="(\d+)" height="(\d+)"', src)
    W, H = int(m.group(1)), int(m.group(2))

    veg_classes = collect_vegetation_classes(groups)

    # --- tag top-level object <g>s (cloud / waterfall / water) and vegetation subgroups ---
    clone_targets = {"cloud": [], "waterfall": []}

    def tag_group(mobj):
        gid, gclass, label = mobj.group(1), mobj.group(2), mobj.group(3)
        extra = ""
        if gclass in veg_classes:
            extra = " tree-cluster"
        elif re.fullmatch(r"obj_\d+_cloud", gclass):
            extra = " cloud-obj"
            clone_targets["cloud"].append(gid)
        elif re.fullmatch(r"obj_\d+_waterfall", gclass):
            extra = " waterfall-obj"
            clone_targets["waterfall"].append(gid)
        elif re.fullmatch(r"obj_\d+_water", gclass):
            extra = " water-obj"
        if not extra:
            return mobj.group(0)
        # key the delay off gclass (shared by __p2 split parts), not gid,
        # so both halves of one visually-split object stay in phase
        delay = stable_delay(gclass, 60)
        return (f'<g id="{gid}" class="{gclass}{extra}" data-label="{label}" '
                f'style="animation-delay:-{delay:.2f}s">')

    src = re.sub(
        r'<g id="([^"]+)" class="([^"]+)" data-label="([^"]+)">',
        tag_group, src,
    )

    # --- tag sun / wind-line individual <path>s in place ---
    def tag_path(mobj):
        d, fill, tx, ty = mobj.group(1), mobj.group(2), float(mobj.group(3)), float(mobj.group(4))
        nums = [float(v) for v in re.findall(r"-?\d+\.?\d*", d)]
        xs, ys = nums[0::2], nums[1::2]
        x0, y0, x1, y1 = min(xs) + tx, min(ys) + ty, max(xs) + tx, max(ys) + ty
        cls = None
        if is_sun(fill, x0, y0, x1, y1, W, H):
            cls = "sun-part"
        elif is_windline(fill, x0, y0, x1, y1):
            cls = "wind-line"
        if cls is None:
            return mobj.group(0)
        return (f'<path d="{d}" fill="{fill}" transform="translate({tx:g},{ty:g})" '
                f'class="{cls}"/>')

    src = re.sub(
        r'<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})"'
        r' transform="translate\(([-\d.]+),([-\d.]+)\)"\s*/>',
        tag_path, src,
    )

    # --- animated clones for clouds and waterfalls (originals stay put, no stacking holes) ---
    def area_of(gid, kind):
        for obj in groups.get("objects", []):
            if obj["id"] == gid:
                bbox = obj.get("bbox", [0, 0, 0, 0])
                return (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
        return 0

    clouds_sorted = sorted(clone_targets["cloud"], key=lambda gid: -area_of(gid, "cloud"))
    clones = []
    for gid in clouds_sorted[:args.max_cloud_clones]:
        delay = stable_delay(gid + "clone", 65)
        clones.append(f'<use href="#{gid}" class="cloud-drift-clone" style="animation-delay:-{delay:.1f}s"/>')
    for gid in clone_targets["waterfall"][:args.max_waterfall_clones]:
        delay = stable_delay(gid + "clone", 2.4)
        clones.append(f'<use href="#{gid}" class="fall-clone" style="animation-delay:-{delay:.1f}s"/>')

    overlay = '\n<g id="animated-overlay">\n' + "\n".join(clones) + "\n</g>\n"
    src = src.replace("</svg>", overlay + "</svg>")

    m2 = re.search(r"<svg\b[^>]*>", src)
    src = src[:m2.end()] + CSS + src[m2.end():]

    open(args.out, "w", encoding="utf-8").write(src)
    print(f"tree-clusters: {len(veg_classes)}  clouds: {len(clone_targets['cloud'])}  "
          f"waterfalls: {len(clone_targets['waterfall'])}  clones: {len(clones)}")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
