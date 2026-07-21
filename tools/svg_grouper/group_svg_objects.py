#!/usr/bin/env python3
"""
group_svg_objects.py — Structure a flat VTracer SVG into semantic <g> groups.

VTracer (stacked mode) emits one flat <path> per color region in paint order,
where each path also spans whatever later paths cover it — so path bounding
boxes overlap everywhere and geometry alone cannot separate objects. This
script instead works from what is VISIBLE:

  1. rasterize every path in paint order (bezier-flattened polygon fill) to a
     label image: which path is on top at each pixel,
  2. peel off canvas-scale washes as background layers (sky / water / ground),
  3. segment the remaining visible pixels into connected components = objects,
  4. subdivide large components by color category (vegetation / terrain /
     rock / blue / white / accent) into spatial subgroups,
  5. re-order paths so each group is as contiguous as possible, under a
     visibility constraint graph (any path painted beneath a visible pixel of
     path t must stay before t) that provably keeps the render pixel-identical;
     groups that genuinely interleave are emitted in numbered parts (__p2 ...)
     sharing a class,
  6. verify by re-simulating the new paint order and diffing label images.

Outputs (next to input unless -o given):
  <stem>_grouped.svg   grouped SVG with ids, classes + data-label/data-bbox
  <stem>_groups.json   manifest for LLM use (visible bbox, colors, sizes)
  <stem>_overlay.svg   grouped SVG + labeled bbox rectangles for eyeballing

Auto-labels are color/position heuristics; rename any group by writing a JSON
({"obj_00": "island_chain", "obj_00/blue_03": "castle_roofs", ...}) and
re-running with --labels.
"""
import argparse
import colorsys
import heapq
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

NUM_RE = re.compile(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")
PATH_RE = re.compile(r"<path\b[^>]*?/>", re.S)
ATTR_RE = re.compile(r'(\w[\w-]*)="([^"]*)"')
TOKEN_RE = re.compile(r"[MLCZmlcz]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")

CURVE_SAMPLES = 6


# ---------------------------------------------------------------- parsing

def parse_svg(text, scale=1):
    m = re.search(r"<svg\b[^>]*>", text)
    if not m:
        sys.exit("no <svg> element found")
    svg_open = m.group(0)
    attrs = dict(ATTR_RE.findall(svg_open))
    if "viewBox" in attrs:
        _, _, w, h = (float(v) for v in NUM_RE.findall(attrs["viewBox"])[:4])
    else:
        w, h = float(attrs["width"]), float(attrs["height"])
    paths = []
    for pm in PATH_RE.finditer(text):
        el = pm.group(0)
        a = dict(ATTR_RE.findall(el))
        tx = ty = 0.0
        tm = re.search(r"translate\(([-\d.]+)[ ,]([-\d.]+)\)", a.get("transform", ""))
        if tm:
            tx, ty = float(tm.group(1)), float(tm.group(2))
        polys = flatten_path(a.get("d", ""), tx, ty)
        if not polys:
            continue
        if scale != 1:
            polys = [[(x * scale, y * scale) for x, y in poly] for poly in polys]
        paths.append({"i": len(paths), "el": el, "fill": a.get("fill", ""), "polys": polys})
    return svg_open, (int(round(w * scale)), int(round(h * scale))), paths


def flatten_path(d, tx, ty):
    """d string -> list of point-list polygons (one per subpath), translated."""
    toks = TOKEN_RE.findall(d)
    polys, pts = [], []
    cx = cy = 0.0
    k = 0
    while k < len(toks):
        t = toks[k]
        if t in "Mm":
            if len(pts) >= 3:
                polys.append(pts)
            cx, cy = float(toks[k + 1]), float(toks[k + 2])
            pts = [(cx + tx, cy + ty)]
            k += 3
        elif t in "Ll":
            k += 1
            while k + 1 < len(toks) and toks[k] not in "MLCZmlcz":
                cx, cy = float(toks[k]), float(toks[k + 1])
                pts.append((cx + tx, cy + ty))
                k += 2
        elif t in "Cc":
            k += 1
            while k + 5 < len(toks) and toks[k] not in "MLCZmlcz":
                x1, y1, x2, y2, x3, y3 = (float(v) for v in toks[k:k + 6])
                for s in range(1, CURVE_SAMPLES + 1):
                    u = s / CURVE_SAMPLES
                    w0, w1 = (1 - u) ** 3, 3 * u * (1 - u) ** 2
                    w2, w3 = 3 * u * u * (1 - u), u ** 3
                    pts.append((w0 * cx + w1 * x1 + w2 * x2 + w3 * x3 + tx,
                                w0 * cy + w1 * y1 + w2 * y2 + w3 * y3 + ty))
                cx, cy = x3, y3
                k += 6
        elif t in "Zz":
            if len(pts) >= 3:
                polys.append(pts)
            pts = []
            k += 1
        else:  # stray number — skip
            k += 1
    if len(pts) >= 3:
        polys.append(pts)
    return polys


# ---------------------------------------------------------- rasterization

def path_mask(p, size):
    """Boolean mask of a path's own geometry (even-odd across subpaths)."""
    if len(p["polys"]) == 1:
        img = Image.new("L", size, 0)
        ImageDraw.Draw(img).polygon(p["polys"][0], fill=255)
        return np.asarray(img, dtype=bool)
    acc = np.zeros((size[1], size[0]), dtype=bool)
    for poly in p["polys"]:
        img = Image.new("L", size, 0)
        ImageDraw.Draw(img).polygon(poly, fill=255)
        acc ^= np.asarray(img, dtype=bool)
    return acc


def label_image(paths, size, order=None):
    """Per-pixel index (into `paths`, +1; 0 = uncovered) of the topmost path."""
    label = np.zeros((size[1], size[0]), dtype=np.int32)
    for idx in (order if order is not None else range(len(paths))):
        label[path_mask(paths[idx], size)] = idx + 1
    return label


# ------------------------------------------------------------ categories

def color_category(fill):
    m = re.fullmatch(r"#([0-9a-fA-F]{6})", fill or "")
    if not m:
        return "other"
    v = int(m.group(1), 16)
    r, g, b = (v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255
    h, s, val = colorsys.rgb_to_hsv(r, g, b)
    hd = h * 360
    if s < 0.13:
        return "white" if val > 0.72 else "rock"
    if val > 0.80 and s <= 0.25:
        return "white"
    if 170 <= hd < 208:
        return "water"  # cyan lake/sky blues
    if 208 <= hd < 260:
        return "blue"   # royal blues: castle roofs, flags
    if 25 <= hd < 60 and val > 0.72 and s < 0.45:
        return "sand"  # light sandy tones: the road, beaches, bright cliffs
    if 30 <= hd < 170:
        return "vegetation" if (val < 0.52 or hd >= 62) else "terrain"
    return "accent"


# visible pixels of these categories separate solid landmasses instead of
# connecting them (water between islands, clouds drifting across everything)
SEPARATORS = ("water", "white")


def bg_auto_label(p, cat, size):
    if cat in ("blue", "water"):
        ys = [pt[1] for poly in p["polys"] for pt in poly]
        return "sky" if sum(ys) / len(ys) < size[1] * 0.5 else "water"
    return {"white": "clouds"}.get(cat, cat)


# ------------------------------------------------- connected components

def dilate(mask, iters):
    m = mask.copy()
    for _ in range(iters):
        grown = m.copy()
        grown[1:, :] |= m[:-1, :]
        grown[:-1, :] |= m[1:, :]
        grown[:, 1:] |= m[:, :-1]
        grown[:, :-1] |= m[:, 1:]
        m = grown
    return m


def connected_components(mask):
    """4-connected labeling via per-row runs + union-find. Returns int32 image."""
    H, W = mask.shape
    parent = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    next_lab = 1
    all_runs = []  # (y, x0, x1, lab)
    prev = []
    for y in range(H):
        row = mask[y].astype(np.int8)
        edges = np.flatnonzero(np.diff(np.concatenate(([0], row, [0]))))
        cur = []
        for x0, x1 in edges.reshape(-1, 2):
            lab = None
            for px0, px1, plab in prev:
                if px0 < x1 and x0 < px1:
                    root = find(plab)
                    if lab is None:
                        lab = root
                    elif root != lab:
                        parent[root] = lab
            if lab is None:
                lab = next_lab
                parent[lab] = lab
                next_lab += 1
            cur.append((x0, x1, lab))
            all_runs.append((y, x0, x1, lab))
        prev = cur
    remap, out_n = {}, 0
    labels = np.zeros((H, W), dtype=np.int32)
    for y, x0, x1, lab in all_runs:
        root = find(lab)
        if root not in remap:
            out_n += 1
            remap[root] = out_n
        labels[y, x0:x1] = remap[root]
    return labels, out_n


def majority(values):
    if len(values) == 0:
        return 0
    return int(np.bincount(values).argmax())


# ------------------------------------------------------------ scheduling

def schedule(paths, unit_of, edges):
    """Topological order of paths (respecting `edges` u->t) that keeps paths
    of the same unit adjacent whenever the constraints allow it. On a unit
    switch, prefer units all of whose remaining paths are ready (smallest
    first) so they are emitted in one piece; fall back to lowest z."""
    n = len(paths)
    indeg = [0] * n
    adj = [[] for _ in range(n)]
    for u, t in edges:
        adj[u].append(t)
        indeg[t] += 1
    ready = {}      # unit -> heap of path indices
    remaining = {}  # unit -> paths not yet emitted
    for i in range(n):
        remaining[unit_of[i]] = remaining.get(unit_of[i], 0) + 1
        if indeg[i] == 0:
            ready.setdefault(unit_of[i], []).append(i)
    for h in ready.values():
        heapq.heapify(h)
    order = []
    current = None
    while len(order) < n:
        if current not in ready or not ready[current]:
            whole = [(remaining[u], h[0], u) for u, h in ready.items()
                     if h and len(h) == remaining[u]]
            if whole:
                current = min(whole)[2]
            else:
                current = min((h[0], u) for u, h in ready.items() if h)[1]
        i = heapq.heappop(ready[current])
        order.append(i)
        remaining[unit_of[i]] -= 1
        for t in adj[i]:
            indeg[t] -= 1
            if indeg[t] == 0:
                heapq.heappush(ready.setdefault(unit_of[t], []), t)
    return order


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(
        description="Group a flat VTracer SVG into semantic <g> elements.")
    ap.add_argument("input")
    ap.add_argument("-o", "--out", help="output grouped SVG path")
    ap.add_argument("--bg-threshold", type=float, default=0.55,
                    help="bbox area fraction of canvas above which a path is background")
    ap.add_argument("--gap", type=int, default=2,
                    help="px dilation bridging gaps between parts of one object")
    ap.add_argument("--split-frac", type=float, default=0.10,
                    help="component share of object pixels above which it is subdivided")
    ap.add_argument("--min-obj-px", type=int, default=60,
                    help="components smaller than this join the 'debris' group")
    ap.add_argument("--min-sub-paths", type=int, default=3,
                    help="subgroups with fewer paths fold into the nearest peer")
    ap.add_argument("--supersample", type=int, default=2,
                    help="rasterize at Nx resolution so sub-pixel edge overlaps "
                         "are also constrained (reduces antialiasing drift)")
    ap.add_argument("--labels", help="JSON {group_id: label} to rename groups")
    ap.add_argument("--regions", help="PNG label map (e.g. from SAM or hand-painted): "
                    "each distinct non-black color becomes its own object group")
    ap.add_argument("--no-overlay", action="store_true")
    ap.add_argument("--no-verify", action="store_true",
                    help="skip the pixel-exact re-render verification pass")
    args = ap.parse_args()

    src = Path(args.input)
    text = src.read_text(encoding="utf-8")
    ss = max(1, args.supersample)
    svg_open, size, paths = parse_svg(text, scale=ss)
    W, H = size
    args.min_obj_px *= ss * ss
    overrides = (json.loads(Path(args.labels).read_text(encoding="utf-8"))
                 if args.labels else {})
    print(f"{len(paths)} paths, rasterizing at {W}x{H} ({ss}x supersampling)...")
    label = label_image(paths, size)  # topmost path idx+1 per pixel

    # -- background: canvas-scale washes
    is_bg = np.zeros(len(paths), dtype=bool)
    for p in paths:
        xs = [pt[0] for poly in p["polys"] for pt in poly]
        ys = [pt[1] for poly in p["polys"] for pt in poly]
        if (max(xs) - min(xs)) * (max(ys) - min(ys)) >= args.bg_threshold * W * H:
            is_bg[p["i"]] = True

    # -- object segmentation on visible, non-background pixels.
    #    Solid pixels (land, rock, castle) connect into landmasses; separator
    #    pixels (water, clouds) get their own component maps so water splits
    #    the main island from the floating ones instead of bridging them.
    cat_of_path = [color_category(p["fill"]) for p in paths]
    obj_mask = (label > 0) & ~is_bg[np.maximum(label - 1, 0)]
    sep_lut = np.zeros(len(paths) + 1, dtype=bool)
    wat_lut = np.zeros(len(paths) + 1, dtype=bool)
    for p in paths:
        sep_lut[p["i"] + 1] = cat_of_path[p["i"]] in SEPARATORS
        wat_lut[p["i"] + 1] = cat_of_path[p["i"]] == "water"

    comp_img = np.zeros_like(label)
    n_comp = 0
    comp_kind = {}  # comp id -> "solid" | "water" | "white" | "region"
    for kind, mask in (("solid", obj_mask & ~sep_lut[label]),
                       ("water", obj_mask & wat_lut[label]),
                       ("white", obj_mask & sep_lut[label] & ~wat_lut[label])):
        sub, n = connected_components(dilate(mask, args.gap * ss))
        sub[~mask] = 0
        comp_img[mask] = sub[mask] + n_comp
        for k in range(1, n + 1):
            comp_kind[n_comp + k] = kind
        n_comp += n

    # optional external region map (e.g. from SAM, or hand-painted): every
    # distinct non-black color becomes a component overriding the above
    if args.regions:
        reg = Image.open(args.regions).convert("RGB").resize((W, H), Image.NEAREST)
        reg = np.asarray(reg, dtype=np.uint32)
        reg_id = (reg[..., 0] << 16) | (reg[..., 1] << 8) | reg[..., 2]
        reg_id[~obj_mask] = 0
        colors = [c for c in np.unique(reg_id) if c != 0]
        remap = {c: n_comp + k + 1 for k, c in enumerate(colors)}
        for c, cid in remap.items():
            comp_img[reg_id == c] = cid
            comp_kind[cid] = "region"
        n_comp += len(colors)
        print(f"regions map: {len(colors)} externally defined regions")

    comp_px = np.bincount(comp_img.ravel(), minlength=n_comp + 1)
    print(f"{n_comp} components "
          f"({sum(1 for v in comp_kind.values() if v == 'solid')} solid landmasses, "
          f"rest water/cloud/region)")
    comp_of_path = {}
    for p in paths:
        if is_bg[p["i"]]:
            continue
        vis = comp_img[label == p["i"] + 1]
        c = majority(vis[vis > 0])
        if c == 0:  # fully hidden path: attach by its own geometry
            under = comp_img[path_mask(p, size)]
            c = majority(under[under > 0])
        comp_of_path[p["i"]] = c if comp_px[c] >= args.min_obj_px else 0

    comp_members = {}
    for i, c in comp_of_path.items():
        comp_members.setdefault(c, []).append(paths[i])

    # -- leaf units (the grouping granularity): whole small components, or
    #    per-category spatial subgroups of large components
    obj_total = int(obj_mask.sum())
    units = {}       # ukey -> member paths (z order)
    comp_units = {}  # comp -> [ukey]
    for c in sorted(comp_members, key=lambda c: min(p["i"] for p in comp_members[c])):
        members = sorted(comp_members[c], key=lambda p: p["i"])
        if c == 0:
            units[("debris", None)] = members
            comp_units["debris"] = [("debris", None)]
            continue
        if comp_px[c] < args.split_frac * obj_total or len(members) <= 20:
            units[(c, None)] = members
            comp_units[c] = [(c, None)]
            continue
        cmask = comp_img == c
        cat_ids = {}   # path i -> (cat, sub cc id)
        for cat in sorted({cat_of_path[p["i"]] for p in members}):
            in_cat = np.zeros(len(paths) + 1, dtype=bool)
            for p in members:
                if cat_of_path[p["i"]] == cat:
                    in_cat[p["i"] + 1] = True
            cat_mask = cmask & in_cat[label]
            if not cat_mask.any():
                for p in members:
                    if cat_of_path[p["i"]] == cat:
                        cat_ids[p["i"]] = (cat, 0)
                continue
            sub_img, _ = connected_components(dilate(cat_mask, args.gap * ss))
            sub_img[~cat_mask] = 0
            for p in members:
                if cat_of_path[p["i"]] != cat:
                    continue
                vis = sub_img[label == p["i"] + 1]
                cat_ids[p["i"]] = (cat, majority(vis[vis > 0]))
        by_sub = {}
        for p in members:
            by_sub.setdefault(cat_ids[p["i"]], []).append(p)

        # tiny subgroups fold into the spatially nearest subgroup of the same
        # category (so e.g. scattered turret roofs coalesce), largest-first
        def centroid(plist):
            pts = [pt for p in plist for poly in p["polys"] for pt in poly]
            return (sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts))

        changed = True
        while changed:
            changed = False
            small = sorted((k for k in by_sub if len(by_sub[k]) < args.min_sub_paths),
                           key=lambda k: len(by_sub[k]))
            for skey in small:
                peers = [k for k in by_sub if k != skey and k[0] == skey[0]]
                if not peers:
                    continue
                cx, cy = centroid(by_sub[skey])
                nearest = min(peers, key=lambda k: (centroid(by_sub[k])[0] - cx) ** 2
                              + (centroid(by_sub[k])[1] - cy) ** 2)
                by_sub[nearest].extend(by_sub.pop(skey))
                changed = True
                break
        comp_units[c] = []
        for k, (skey, plist) in enumerate(
                sorted(by_sub.items(), key=lambda kv: min(p["i"] for p in kv[1]))):
            ukey = (c, f"{skey[0]}_{k:02d}")
            units[ukey] = sorted(plist, key=lambda p: p["i"])
            comp_units[c].append(ukey)
    # -- the castle: the largest top-half royal-blue subgroup seeds a merge
    #    that absorbs nearby blue subgroups (turret roofs, flags) of the same
    #    landmass into one unit, so the whole castle is sliceable at once
    castle_key = None
    blue_keys = [k for k in units if k[1] and k[1].startswith("blue")]
    if blue_keys:
        lut = np.full(len(paths) + 1, -1, dtype=np.int32)
        for n, k in enumerate(blue_keys):
            for p in units[k]:
                lut[p["i"] + 1] = n
        blue_img = lut[label]
        bxs = {}
        for n, k in enumerate(blue_keys):
            ys, xs = np.nonzero(blue_img == n)
            if len(xs):
                bxs[k] = [xs.min(), ys.min(), xs.max(), ys.max()]
        cands = [k for k in bxs if (bxs[k][1] + bxs[k][3]) / 2 < 0.55 * H]
        if cands:
            castle_key = max(cands, key=lambda k: len(units[k]))
            margin = 30 * ss
            changed = True
            while changed:
                changed = False
                cb = bxs[castle_key]
                for k in list(bxs):
                    if k == castle_key or k not in units or k[0] != castle_key[0]:
                        continue
                    b = bxs[k]
                    if (b[0] - margin < cb[2] and cb[0] - margin < b[2]
                            and b[1] - margin < cb[3] and cb[1] - margin < b[3]):
                        units[castle_key] = sorted(units[castle_key] + units.pop(k),
                                                   key=lambda p: p["i"])
                        comp_units[k[0]].remove(k)
                        bxs[castle_key] = [min(cb[0], b[0]), min(cb[1], b[1]),
                                           max(cb[2], b[2]), max(cb[3], b[3])]
                        del bxs[k]
                        changed = True
            print(f"castle: merged blue roof/flag subgroups into {castle_key}")

    n_units = len(units)
    print(f"{n_units} leaf groups; building visibility constraints...")

    # -- constraint graph: u must precede t if u paints under a visible pixel
    #    of t (also keeps originally-hidden paths hidden)
    unit_of = {}
    for ukey, plist in units.items():
        for p in plist:
            unit_of[p["i"]] = ukey
    for p in paths:  # background paths: one unit each, pinned by constraints
        if is_bg[p["i"]]:
            unit_of[p["i"]] = ("bg", p["i"])
    edges = []
    for p in paths:
        above = np.unique(label[path_mask(p, size)])
        edges.extend((p["i"], int(t) - 1) for t in above if t - 1 > p["i"])
    print(f"{len(edges)} ordering constraints; scheduling...")
    order = schedule(paths, unit_of, edges)

    # -- runs: contiguous stretches of one unit in the schedule
    runs = []
    for i in order:
        if runs and runs[-1][0] == unit_of[i]:
            runs[-1][1].append(paths[i])
        else:
            runs.append([unit_of[i], [paths[i]]])
    n_parts = {}
    for ukey, _ in runs:
        n_parts[ukey] = n_parts.get(ukey, 0) + 1
    split_units = sum(1 for v in n_parts.values() if v > 1)
    print(f"{len(runs)} contiguous runs for {n_units} groups "
          f"({split_units} groups needed multiple parts)")

    # -- naming
    def vis_bbox(mask):
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            return None
        return [int(xs.min() // ss), int(ys.min() // ss),
                int(xs.max() // ss) + 1, int(ys.max() // ss) + 1]

    def dom_cat(plist):
        votes = {}
        for p in plist:
            votes[cat_of_path[p["i"]]] = votes.get(cat_of_path[p["i"]], 0) + 1
        return max(votes, key=votes.get)

    solid_px = {c: int(comp_px[c]) for c in comp_units
                if c not in ("debris",) and comp_kind.get(c) == "solid"}
    main_island = max(solid_px, key=solid_px.get) if solid_px else None
    comp_no = {}
    comp_name = {}
    for c in comp_units:
        if c == "debris":
            comp_name[c] = "debris"
            continue
        n = len(comp_no)
        comp_no[c] = n
        gid = f"obj_{n:02d}"
        kind = comp_kind.get(c, "solid")
        if c == main_island:
            auto = "main_island"
        elif kind == "solid":
            auto = ("island" if comp_px[c] >= 800 * ss * ss
                    else dom_cat(comp_members[c]))
        elif kind == "white":
            b = vis_bbox(comp_img == c)
            auto = ("waterfall" if b and (b[3] - b[1]) > 1.3 * (b[2] - b[0])
                    else "cloud")
        elif kind == "water":
            auto = "water"
        else:
            auto = "region"
        comp_name[c] = f"{gid}_{overrides.get(gid, auto)}"
    unit_list = list(units)
    path_unit = np.full(len(paths) + 1, -1, dtype=np.int32)
    for n, ukey in enumerate(unit_list):
        for p in units[ukey]:
            path_unit[p["i"] + 1] = n
    unit_img = path_unit[label]
    unit_bbox = {}
    for n, ukey in enumerate(unit_list):
        unit_bbox[ukey] = vis_bbox(unit_img == n)
    unit_name = {}
    for ukey in units:
        c, sub = ukey
        if sub is None:
            unit_name[ukey] = comp_name[c]
        else:
            auto = sub
            b = unit_bbox.get(ukey)
            # a sandy region snaking over most of the canvas height is the road
            if sub.startswith("sand") and b and (b[3] - b[1]) >= 0.5 * H / ss:
                auto = sub.replace("sand", "road", 1)
            if ukey == castle_key:
                auto = sub.replace("blue", "castle_roofs", 1)
            gid = f"obj_{comp_no[c]:02d}/{sub}"
            unit_name[ukey] = f"{comp_name[c]}__{overrides.get(gid, auto)}"

    # -- emit grouped SVG: nest runs under their component; a component or
    #    unit whose runs are non-contiguous appears as parts (__p2, ...)
    out_lines = [svg_open, '<g id="background">']
    for p in [p for p in paths if is_bg[p["i"]]]:
        gid = f"bg_{p['i']:02d}"
        lab = overrides.get(gid, bg_auto_label(p, cat_of_path[p["i"]], size))
        out_lines += [f'  <g id="{gid}_{lab}" data-label="{lab}">', f"    {p['el']}", "  </g>"]
    out_lines.append("</g>")

    seen_comp, seen_unit = {}, {}
    open_comp = None
    out_lines.append('<g id="objects">')
    for ukey, plist in runs:
        c = ukey[0] if ukey[0] != "bg" else None
        if c is None:
            continue  # bg paths already emitted (constraints keep them first)
        if c != open_comp:
            if open_comp is not None:
                out_lines.append("  </g>")
            seen_comp[c] = seen_comp.get(c, 0) + 1
            part = f"__p{seen_comp[c]}" if seen_comp[c] > 1 else ""
            out_lines.append(f'  <g id="{comp_name[c]}{part}" class="{comp_name[c]}" '
                             f'data-label="{comp_name[c].split("_", 2)[-1]}">')
            open_comp = c
        if ukey[1] is None:
            out_lines.extend(f"    {p['el']}" for p in plist)
        else:
            seen_unit[ukey] = seen_unit.get(ukey, 0) + 1
            part = f"__p{seen_unit[ukey]}" if seen_unit[ukey] > 1 else ""
            out_lines.append(f'    <g id="{unit_name[ukey]}{part}" class="{unit_name[ukey]}" '
                             f'data-label="{unit_name[ukey].split("__")[-1]}">')
            out_lines.extend(f"      {p['el']}" for p in plist)
            out_lines.append("    </g>")
    if open_comp is not None:
        out_lines.append("  </g>")
    out_lines += ["</g>", "</svg>"]

    # -- manifest + overlay boxes
    manifest = {"source": src.name, "canvas": [W // ss, H // ss],
                "background": [], "objects": []}
    overlay_boxes = []
    for p in [p for p in paths if is_bg[p["i"]]]:
        gid = f"bg_{p['i']:02d}"
        lab = overrides.get(gid, bg_auto_label(p, cat_of_path[p["i"]], size))
        manifest["background"].append({
            "id": f"{gid}_{lab}", "label": lab, "fill": p["fill"],
            "visible_px": int((label == p["i"] + 1).sum()) // (ss * ss)})
    for c, ukeys in comp_units.items():
        if c == "debris":
            manifest["objects"].append({
                "id": "debris", "label": "debris",
                "paths": len(units[("debris", None)])})
            continue
        bbox = vis_bbox(comp_img == c)
        entry = {"id": comp_name[c], "label": comp_name[c].split("_", 2)[-1],
                 "bbox": bbox, "visible_px": int(comp_px[c]) // (ss * ss),
                 "paths": sum(len(units[k]) for k in ukeys),
                 "parts_in_svg": seen_comp.get(c, 1), "subgroups": []}
        if bbox:
            overlay_boxes.append((comp_name[c], bbox))
        for ukey in ukeys:
            if ukey[1] is None:
                continue
            plist = units[ukey]
            sbox = unit_bbox[ukey]
            entry["subgroups"].append({
                "id": unit_name[ukey], "label": unit_name[ukey].split("__")[-1],
                "bbox": sbox, "paths": len(plist),
                "parts_in_svg": seen_unit.get(ukey, 1),
                "top_colors": sorted({p["fill"] for p in plist})[:6]})
            if sbox:
                overlay_boxes.append((unit_name[ukey], sbox))
        manifest["objects"].append(entry)

    out = Path(args.out) if args.out else src.with_name(src.stem + "_grouped.svg")
    out.write_text("\n".join(out_lines), encoding="utf-8")
    stem = out.stem.replace("_grouped", "")
    mpath = out.with_name(stem + "_groups.json")
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    if not args.no_overlay:
        ov = out_lines[:-1] + ['<g id="annotations" font-family="monospace" font-size="13">']
        for full_id, b in overlay_boxes:
            ov.append(f'  <rect x="{b[0]}" y="{b[1]}" width="{b[2]-b[0]}" '
                      f'height="{b[3]-b[1]}" fill="none" stroke="#FF00AA" stroke-width="1.5"/>')
            ov.append(f'  <text x="{b[0]}" y="{max(12, b[1]-3)}" fill="#FF00AA" '
                      f'stroke="white" stroke-width="3" paint-order="stroke">{full_id}</text>')
        ov += ["</g>", "</svg>"]
        out.with_name(stem + "_overlay.svg").write_text("\n".join(ov), encoding="utf-8")

    # -- summary
    print(f"\n{sum(is_bg)} background layers:")
    for e in manifest["background"]:
        print(f"  {e['id']:<28} fill={e['fill']}  visible_px={e['visible_px']}")
    print(f"{len(manifest['objects'])} object groups:")
    for e in manifest["objects"]:
        b = e.get("bbox")
        loc = f"bbox=({b[0]},{b[1]})-({b[2]},{b[3]})" if b else ""
        parts = f"  [{e['parts_in_svg']} parts]" if e.get("parts_in_svg", 1) > 1 else ""
        print(f"  {e['id']:<32} {e['paths']:>4} paths  {loc}{parts}")
        for s in e.get("subgroups", []):
            sb = s["bbox"]
            sloc = f"bbox=({sb[0]},{sb[1]})-({sb[2]},{sb[3]})" if sb else ""
            parts = f"  [{s['parts_in_svg']} parts]" if s["parts_in_svg"] > 1 else ""
            print(f"    {s['id']:<34} {s['paths']:>4} paths  {sloc}{parts}")

    # -- pixel-exact verification of the new paint order
    if not args.no_verify:
        print("\nverifying regrouped paint order (as emitted in the document)...")
        doc_order = [p["i"] for p in paths if is_bg[p["i"]]] + [
            p["i"] for ukey, plist in runs if ukey[0] != "bg" for p in plist]
        relabel = label_image(paths, size, order=doc_order)
        pal = np.zeros(len(paths) + 1, dtype=np.int64)
        for p in paths:
            pal[p["i"] + 1] = int(p["fill"].lstrip("#") or "0", 16) + 1
        diff = pal[label] != pal[relabel]
        print(f"pixel diff vs original: {int(diff.sum())} px ({diff.mean():.4%})")
        if diff.any():
            Image.fromarray((diff * 255).astype(np.uint8)).save(
                out.with_name(stem + "_reorder_diff.png"))
            print(f"  changed pixels written to {stem}_reorder_diff.png")

    print(f"\nwrote {out.name}, {mpath.name}" + ("" if args.no_overlay else f", {stem}_overlay.svg"))


if __name__ == "__main__":
    main()
