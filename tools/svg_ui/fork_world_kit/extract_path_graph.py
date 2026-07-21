#!/usr/bin/env python3
"""
extract_path_graph.py — Turn the road pixels of a traced scene into a
junction GRAPH (nodes + branch polylines) instead of one collapsed centerline,
so a camera can walk it and TURN at forks.

Pipeline: render -> beige road mask -> largest component -> skeletonize ->
classify skeleton pixels (endpoint=1 neighbor, junction>=3) -> walk edges
between nodes -> simplify polylines -> tag the start node (bottommost
endpoint) and castle node (topmost endpoint).

Writes the graph into slices.json (meta.graph) and a standalone graph.json.

Usage:
    python extract_path_graph.py animated.svg slices/slices.json
"""
import json
import sys

import cairosvg
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.morphology import skeletonize


def road_mask(svg_path, width=1200):
    cairosvg.svg2png(url=svg_path, write_to="_graph_ref.png", output_width=width)
    a = np.array(Image.open("_graph_ref.png").convert("RGB")).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r > 165) & (r < 250) & (r > b + 30) & (g > b + 10) & (g < r) & (b > 85)
    lab, n = ndimage.label(m)
    if not n:
        raise SystemExit("no road pixels found")
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    main = lab == (np.argmax(sizes) + 1)
    main = ndimage.binary_closing(main, np.ones((5, 5)))
    return main, a.shape[1], a.shape[0]


def build_graph(skel):
    ys, xs = np.where(skel)
    pix = set(zip(xs.tolist(), ys.tolist()))
    NB = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]

    def nbrs(p):
        return [(p[0] + dx, p[1] + dy) for dx, dy in NB
                if (p[0] + dx, p[1] + dy) in pix]

    deg = {p: len(nbrs(p)) for p in pix}
    node_px = {p for p, d in deg.items() if d != 2}
    if not node_px:
        node_px = {next(iter(pix))}

    node_of, nodes = {}, []
    for p in sorted(node_px):
        if p in node_of:
            continue
        stack, blob = [p], []
        while stack:
            q = stack.pop()
            if q in node_of or q not in node_px:
                continue
            node_of[q] = len(nodes)
            blob.append(q)
            stack += [n for n in nbrs(q) if n in node_px]
        cx = sum(q[0] for q in blob) / len(blob)
        cy = sum(q[1] for q in blob) / len(blob)
        nodes.append({"id": len(nodes), "x": cx, "y": cy, "px": blob})

    edges, seen = [], set()
    for ni, node in enumerate(nodes):
        for start in node["px"]:
            for step in nbrs(start):
                if step in node_px or (start, step) in seen:
                    continue
                poly, prev, cur = [start], start, step
                while True:
                    seen.add((prev, cur))
                    poly.append(cur)
                    if cur in node_px:
                        break
                    nxt = [q for q in nbrs(cur) if q != prev]
                    if not nxt:
                        break
                    prev, cur = cur, nxt[0]
                seen.add((cur, prev))
                end = node_of.get(cur, ni)
                if len(poly) > 6:
                    edges.append({"a": ni, "b": end, "pts": poly})
    return nodes, edges


def simplify(pts, keep_every=9):
    out = pts[::keep_every]
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


def main():
    svg = sys.argv[1]
    slices_json = sys.argv[2] if len(sys.argv) > 2 else "slices/slices.json"
    mask, W, H = road_mask(svg)
    skel = skeletonize(mask)
    nodes, edges = build_graph(skel)

    edges = [e for e in edges if len(e["pts"]) > 22 or e["a"] != e["b"]]
    ded, have = [], set()
    for e in edges:
        k = (min(e["a"], e["b"]), max(e["a"], e["b"]), len(e["pts"]) // 10)
        if k in have:
            continue
        have.add(k)
        ded.append(e)
    edges = ded

    used = {e["a"] for e in edges} | {e["b"] for e in edges}
    g_nodes = [{"id": n["id"], "x": round(n["x"] / W, 4), "y": round(n["y"] / H, 4)}
               for n in nodes if n["id"] in used]
    g_edges = [{"a": e["a"], "b": e["b"],
                "pts": [[round(x / W, 4), round(y / H, 4)]
                        for x, y in simplify(e["pts"])]}
               for e in edges]

    # ---- prune skeleton twigs, then merge pass-through chains ----
    def arclen(pts):
        return sum(((pts[i][0]-pts[i-1][0])**2 + (pts[i][1]-pts[i-1][1])**2) ** .5
                   for i in range(1, len(pts)))

    for _ in range(6):
        deg = {}
        for e in g_edges:
            deg[e["a"]] = deg.get(e["a"], 0) + 1
            deg[e["b"]] = deg.get(e["b"], 0) + 1
        pruned = [e for e in g_edges
                  if not ((deg.get(e["a"], 0) == 1 or deg.get(e["b"], 0) == 1)
                          and arclen(e["pts"]) < 0.055)
                  and not (e["a"] == e["b"] and arclen(e["pts"]) < 0.10)]
        if len(pruned) == len(g_edges):
            break
        g_edges = pruned
    # merge chains through degree-2 nodes
    changed = True
    while changed:
        changed = False
        deg = {}
        for e in g_edges:
            deg[e["a"]] = deg.get(e["a"], 0) + 1
            deg[e["b"]] = deg.get(e["b"], 0) + 1
        for nid, dcount in list(deg.items()):
            if dcount != 2:
                continue
            pair = [e for e in g_edges if nid in (e["a"], e["b"])]
            if len(pair) != 2 or pair[0] is pair[1]:
                continue
            e1, e2 = pair
            p1 = e1["pts"] if e1["b"] == nid else e1["pts"][::-1]
            p2 = e2["pts"] if e2["a"] == nid else e2["pts"][::-1]
            merged = {"a": e1["a"] if e1["b"] == nid else e1["b"],
                      "b": e2["b"] if e2["a"] == nid else e2["a"],
                      "pts": p1 + p2[1:]}
            g_edges.remove(e1); g_edges.remove(e2); g_edges.append(merged)
            changed = True
            break
    used = {e["a"] for e in g_edges} | {e["b"] for e in g_edges}
    g_nodes = [n for n in g_nodes if n["id"] in used]

    degree = {}
    for e in g_edges:
        degree[e["a"]] = degree.get(e["a"], 0) + 1
        degree[e["b"]] = degree.get(e["b"], 0) + 1
    ends = [n for n in g_nodes if degree.get(n["id"], 0) == 1]
    start = max(ends or g_nodes, key=lambda n: n["y"])
    castle = min(ends or g_nodes, key=lambda n: n["y"])

    graph = {"nodes": g_nodes, "edges": g_edges,
             "start": start["id"], "castle": castle["id"]}
    json.dump(graph, open("graph.json", "w"), indent=1)
    meta = json.load(open(slices_json))
    meta["graph"] = graph
    json.dump(meta, open(slices_json, "w"), indent=1)

    junctions = [n for n in g_nodes if degree.get(n["id"], 0) >= 3]
    print(f"nodes {len(g_nodes)} (junctions {len(junctions)}, endpoints {len(ends)}), "
          f"edges {len(g_edges)}")
    print(f"start {start['id']} ({start['x']:.2f},{start['y']:.2f})  "
          f"castle {castle['id']} ({castle['x']:.2f},{castle['y']:.2f})")
    for n in junctions[:8]:
        print(f"  junction {n['id']} at ({n['x']:.2f},{n['y']:.2f}) deg {degree[n['id']]}")


if __name__ == "__main__":
    main()
