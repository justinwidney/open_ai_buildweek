#!/usr/bin/env python3
"""
export_chunks.py — Cut a flat VTracer SVG into reusable, composable chunks.

Where group_svg_objects.py organizes the SVG in place, this tool exports
standalone assets: each island platform of the main landmass (with its grass,
cliff depth, trees, rocks, road segment and attached waterfalls), each
separate floating island, and each cloud, as its own cropped SVG with
transparent surroundings. Recombine them into new scenes.

How chunks are cut:
  1. same visibility rasterization as the grouper (label image, background
     washes peeled off, water/cloud pixels as separators),
  2. the largest landmass is split into platforms by eroding it until it
     falls apart at the narrow necks, then growing the cores back out,
  3. every path whose geometry intersects a chunk is included (original
     paint order, so under-paint and anti-hairline layering stay intact) and
     the whole chunk is clipped to its traced pixel outline,
  4. waterfalls/clouds touching a platform are attached to it.

Each chunk records its ROAD PORTS — points where sandy road pixels cross the
chunk boundary — in chunks.json, so a composer can snap chunks together
road-end to road-end (see debug/compose_chain.py).

Usage:
  python export_chunks.py scene.svg -o chunks_dir [--erode 10] [--min-core 1500]
"""
import argparse
import colorsys
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from group_svg_objects import (SEPARATORS, color_category, connected_components,
                               dilate, label_image, parse_svg, path_mask)


def erode(mask, iters):
    return ~dilate(~mask, iters)


def split_platforms(mask, ss, min_dist, peak_thr):
    """Watershed on the distance transform: splits a connected landmass into
    platform cells at its narrow waists. Falls back to erosion cores if
    scipy/skimage are missing."""
    try:
        from scipy import ndimage
        from skimage.feature import peak_local_max
        from skimage.segmentation import watershed
    except ImportError:
        print("scipy/skimage not available - falling back to erosion split")
        cores, n = connected_components(erode(mask, 10 * ss))
        seeds = np.where(cores > 0, cores, 0).astype(np.int32)
        return spread_labels(seeds, mask), n
    dist = ndimage.distance_transform_edt(mask)
    peaks = peak_local_max(dist, min_distance=min_dist * ss, labels=mask,
                           threshold_abs=peak_thr * ss)
    markers = np.zeros(mask.shape, dtype=np.int32)
    for k, (y, x) in enumerate(peaks, 1):
        markers[y, x] = k
    return watershed(-dist, markers, mask=mask), len(peaks)


def spread_labels(labels, mask):
    """Geodesic dilation: grow nonzero labels into `mask` until it is filled."""
    remaining = int((mask & (labels == 0)).sum())
    while remaining:
        for sy, sx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted = np.zeros_like(labels)
            if sy == 1:
                shifted[1:, :] = labels[:-1, :]
            elif sy == -1:
                shifted[:-1, :] = labels[1:, :]
            elif sx == 1:
                shifted[:, 1:] = labels[:, :-1]
            else:
                shifted[:, :-1] = labels[:, 1:]
            take = mask & (labels == 0) & (shifted > 0)
            labels[take] = shifted[take]
        now = int((mask & (labels == 0)).sum())
        if now == remaining:  # isolated pockets no core can reach
            break
        remaining = now
    return labels


def trace_outline(mask, ss, ox=0, oy=0):
    """Pixel-boundary loops of `mask` as an SVG path d (evenodd-safe)."""
    up = np.zeros_like(mask); up[1:, :] = mask[:-1, :]
    dn = np.zeros_like(mask); dn[:-1, :] = mask[1:, :]
    lf = np.zeros_like(mask); lf[:, 1:] = mask[:, :-1]
    rt = np.zeros_like(mask); rt[:, :-1] = mask[:, 1:]
    edges = {}  # start vertex -> list of end vertices (grid corners)

    def add(y_arr, x_arr, s_off, e_off):
        for y, x in zip(y_arr.tolist(), x_arr.tolist()):
            s = (x + s_off[0], y + s_off[1])
            edges.setdefault(s, []).append((x + e_off[0], y + e_off[1]))

    ys, xs = np.nonzero(mask & ~up); add(ys, xs, (0, 0), (1, 0))      # top
    ys, xs = np.nonzero(mask & ~rt); add(ys, xs, (1, 0), (1, 1))      # right
    ys, xs = np.nonzero(mask & ~dn); add(ys, xs, (1, 1), (0, 1))      # bottom
    ys, xs = np.nonzero(mask & ~lf); add(ys, xs, (0, 1), (0, 0))      # left

    parts = []
    while edges:
        start = next(iter(edges))
        loop = [start]
        cur = start
        while True:
            nxts = edges[cur]
            nxt = nxts.pop()
            if not nxts:
                del edges[cur]
            if nxt == start:
                break
            loop.append(nxt)
            cur = nxt
        pts = []  # drop collinear points
        for p in loop:
            if len(pts) >= 2 and ((pts[-1][0] - pts[-2][0] == 0) == (p[0] - pts[-1][0] == 0)
                                  and (pts[-1][1] - pts[-2][1] == 0) == (p[1] - pts[-1][1] == 0)):
                pts[-1] = p
            else:
                pts.append(p)
        parts.append("M" + "L".join(f"{(x+ox)/ss:g} {(y+oy)/ss:g}" for x, y in pts) + "Z")
    return "".join(parts)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("input")
    ap.add_argument("-o", "--outdir", default=None)
    ap.add_argument("--min-dist", type=int, default=50,
                    help="px minimum distance between platform centers "
                         "(smaller = more, finer chunks)")
    ap.add_argument("--peak-thr", type=int, default=10,
                    help="px minimum platform half-width to seed a chunk")
    ap.add_argument("--min-chunk-px", type=int, default=400,
                    help="skip chunks smaller than this (original px^2)")
    ap.add_argument("--bg-threshold", type=float, default=0.55)
    ap.add_argument("--gap", type=int, default=2)
    ap.add_argument("--supersample", type=int, default=1,
                    help="1 is plenty for chunk cutting (no reordering here); "
                         "raise only if clip edges look coarse")
    args = ap.parse_args()

    src = Path(args.input)
    outdir = Path(args.outdir) if args.outdir else src.with_name(src.stem + "_chunks")
    outdir.mkdir(parents=True, exist_ok=True)
    ss = max(1, args.supersample)
    text = src.read_text(encoding="utf-8")
    svg_open, size, paths = parse_svg(text, scale=ss)
    W, H = size
    print(f"{len(paths)} paths, rasterizing at {W}x{H}...")
    label = label_image(paths, size)

    is_bg = np.zeros(len(paths) + 1, dtype=bool)
    for p in paths:
        xs = [pt[0] for poly in p["polys"] for pt in poly]
        ys = [pt[1] for poly in p["polys"] for pt in poly]
        if (max(xs) - min(xs)) * (max(ys) - min(ys)) >= args.bg_threshold * W * H:
            is_bg[p["i"] + 1] = True
    cat_of = ["bg"] + [color_category(p["fill"]) for p in paths]
    cat_lut = np.array([c in SEPARATORS for c in cat_of])
    sand_lut = np.array([c == "sand" for c in cat_of])
    white_lut = np.array([c == "white" for c in cat_of])

    def saturation(fill):
        m = re.fullmatch(r"#([0-9a-fA-F]{6})", fill or "")
        if not m:
            return 0.0
        v = int(m.group(1), 16)
        return colorsys.rgb_to_hsv((v >> 16) / 255, ((v >> 8) & 255) / 255,
                                   (v & 255) / 255)[1]

    # castle blues are saturated royal blue; cliff-shadow blues are not
    castle_lut = np.array([False] + [
        color_category(p["fill"]) == "blue" and saturation(p["fill"]) >= 0.35
        for p in paths])

    obj_mask = (label > 0) & ~is_bg[label]
    castle_vis = obj_mask & castle_lut[label]
    solid = obj_mask & ~cat_lut[label]
    comp_img, n_comp = connected_components(dilate(solid, args.gap * ss))
    comp_img[~solid] = 0
    px = np.bincount(comp_img.ravel(), minlength=n_comp + 1)

    # split the main landmass into platforms at its narrow waists
    chunks = []  # (mask, kind)
    main_c = int(px[1:].argmax()) + 1
    for c in range(1, n_comp + 1):
        if px[c] < args.min_chunk_px * ss * ss:
            continue
        m = comp_img == c
        if c != main_c:
            chunks.append([m, "island"])
            continue
        # carve the castle out first: saturated royal-blue roofs bbox grown
        # down over the walls, so towers + walls + courtyard stay one asset
        if int(castle_vis.sum()) > 300 * ss * ss:
            ys, xs = np.nonzero(castle_vis)
            cx0, cx1 = int(xs.min()), int(xs.max())
            cy0, cy1 = int(ys.min()), int(ys.max())
            cw, chh = cx1 - cx0, cy1 - cy0
            rect = np.zeros_like(m)
            rect[max(0, cy0 - 5 * ss):min(H, cy1 + int(1.1 * chh)),
                 max(0, cx0 - int(0.15 * cw)):min(W, cx1 + int(0.15 * cw))] = True
            castle_m = m & rect
            if castle_m.sum() >= args.min_chunk_px * ss * ss:
                chunks.append([castle_m, "castle"])
                m = m & ~rect
        part, n_cells = split_platforms(m, ss, args.min_dist, args.peak_thr)
        kept = 0
        for k in range(1, int(part.max()) + 1):
            pm = (part == k) & m
            if pm.sum() >= args.min_chunk_px * ss * ss:
                chunks.append([pm, "platform"])
                kept += 1
        if kept == 0:
            chunks.append([m, "platform"])
        print(f"main landmass split into {kept} platforms "
              f"(--min-dist {args.min_dist}, --peak-thr {args.peak_thr})")

    # attach waterfalls/clouds that touch a platform; free clouds stay chunks
    white_mask = obj_mask & white_lut[label]
    wimg, wn = connected_components(dilate(white_mask, args.gap * ss))
    wimg[~white_mask] = 0
    for k in range(1, wn + 1):
        wm = wimg == k
        if wm.sum() < 40 * ss * ss:
            continue
        wys, wxs = np.nonzero(wm)
        ww, wh = wxs.max() - wxs.min(), wys.max() - wys.min()
        # only waterfall-shaped (tall) or small mist pieces attach to land;
        # wide clouds stay independent so they don't inflate platform chunks
        if not (wh > ww or wm.sum() < 4000 * ss * ss):
            if wm.sum() >= args.min_chunk_px * ss * ss:
                chunks.append([wm, "cloud"])
            continue
        touch = dilate(wm, 3 * ss)
        best, best_ol = None, 0
        for ch in chunks:
            ol = int((touch & ch[0]).sum())
            if ol > best_ol:
                best, best_ol = ch, ol
        if best is not None and best_ol > 0:
            best[0] = best[0] | wm
        else:
            b = wm.sum()
            if b >= args.min_chunk_px * ss * ss:
                chunks.append([wm, "cloud"])

    # the road proper = tall connected sandy regions (winding path segments);
    # wide sandy cliff faces and beaches must not spawn ports
    sand_vis = obj_mask & sand_lut[label]
    rimg, rn = connected_components(dilate(sand_vis, args.gap * ss))
    rimg[~sand_vis] = 0
    road_mask = np.zeros_like(sand_vis)
    for k in range(1, rn + 1):
        ys, xs = np.nonzero(rimg == k)
        if len(xs) < 40 * ss * ss:
            continue
        w_, h_ = xs.max() - xs.min(), ys.max() - ys.min()
        if h_ >= 0.8 * w_ and h_ > 60 * ss:
            road_mask |= rimg == k
    # crop chunk masks to padded bboxes and free the big intermediates
    cropped = []
    pad = 6 * ss
    for m, kind in chunks:
        ys, xs = np.nonzero(m)
        cy0, cy1 = max(0, int(ys.min()) - pad), min(H, int(ys.max()) + 1 + pad)
        cx0, cx1 = max(0, int(xs.min()) - pad), min(W, int(xs.max()) + 1 + pad)
        cropped.append([(cx0, cy0, cx1, cy1), m[cy0:cy1, cx0:cx1].copy(), kind,
                        int((castle_vis & m).sum())])
    solid_all = solid  # kept: distinguishes natural silhouette from interior cuts
    del chunks, comp_img, sand_vis, rimg, wimg, white_mask, obj_mask
    del castle_vis, cat_lut, sand_lut, white_lut

    manifest = {"source": src.name, "canvas": [W // ss, H // ss], "chunks": []}
    for n, ((cx0, cy0, cx1, cy1), mc, kind, castle_px) in enumerate(
            sorted(cropped, key=lambda c: -int(c[1].sum()))):
        mask = dilate(mc, ss)  # 1px bleed so clipping doesn't shave edge pixels
        ys, xs = np.nonzero(mask)
        x0, y0 = cx0 + int(xs.min()), cy0 + int(ys.min())
        x1, y1 = cx0 + int(xs.max()) + 1, cy0 + int(ys.max()) + 1
        lab_crop = label[cy0:cy1, cx0:cx1]
        vis_set = set(int(v) for v in np.unique(lab_crop[mask])
                      if v > 0 and not is_bg[v])
        members = []
        for p in paths:
            if is_bg[p["i"] + 1]:
                continue
            if p["i"] + 1 in vis_set:
                members.append(p)
                continue
            bx = [pt[0] for poly in p["polys"] for pt in poly]
            by = [pt[1] for poly in p["polys"] for pt in poly]
            if max(bx) < x0 or min(bx) > x1 or max(by) < y0 or min(by) > y1:
                continue
            pm = path_mask(p, size)[cy0:cy1, cx0:cx1]
            if (pm & mask).any():  # hidden under-paint
                members.append(p)
        members.sort(key=lambda p: p["i"])

        # road ports: sandy pixels on the chunk's boundary ring
        ring = mask & ~erode(mask, 2 * ss)
        # how much of the outline is a natural silhouette (sky/water beyond)
        # vs a cut through land that only looks right next to its neighbor
        other_solid = solid_all[cy0:cy1, cx0:cx1] & ~mask
        cut = ring & dilate(other_solid, 2 * ss)
        natural = round(1.0 - float(cut.sum()) / max(1, int(ring.sum())), 2)
        road_crop = road_mask[cy0:cy1, cx0:cx1]
        pimg, pn = connected_components(dilate(ring & road_crop, 2 * ss))
        ports = []
        for k in range(1, pn + 1):
            pys, pxs = np.nonzero(pimg == k)
            if len(pxs) >= 3 * ss:
                ports.append([round((cx0 + float(pxs.mean())) / ss, 1),
                              round((cy0 + float(pys.mean())) / ss, 1)])

        has_castle = kind != "castle" and castle_px > 300 * ss * ss
        name = f"chunk_{n:02d}_{kind}" + ("_castle" if has_castle else "") \
            + ("_road" if ports else "")
        d = trace_outline(mask, ss, ox=cx0, oy=cy0)
        vb = (f'{x0/ss:g} {y0/ss:g} {(x1-x0)/ss:g} {(y1-y0)/ss:g}')
        lines = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
                 f'width="{(x1-x0)//ss}" height="{(y1-y0)//ss}">',
                 f'<defs><clipPath id="{name}" clipPathUnits="userSpaceOnUse">'
                 f'<path d="{d}" fill-rule="evenodd"/></clipPath></defs>',
                 f'<g clip-path="url(#{name})">']
        lines += [f"  {p['el']}" for p in members]
        lines += ["</g>", "</svg>"]
        (outdir / f"{name}.svg").write_text("\n".join(lines), encoding="utf-8")
        manifest["chunks"].append({
            "id": name, "file": f"{name}.svg", "kind": kind,
            "bbox": [x0 // ss, y0 // ss, x1 // ss, y1 // ss],
            "area_px": int(mc.sum()) // (ss * ss),
            "paths": len(members), "road_ports": ports,
            "natural_edge": natural})
        print(f"  {name:<28} {len(members):>4} paths  "
              f"bbox=({x0//ss},{y0//ss})-({x1//ss},{y1//ss})  ports={ports}")

    (outdir / "chunks.json").write_text(json.dumps(manifest, indent=2),
                                        encoding="utf-8")
    print(f"\nwrote {len(manifest['chunks'])} chunks + chunks.json to {outdir}")


if __name__ == "__main__":
    main()
