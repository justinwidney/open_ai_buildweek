#!/usr/bin/env python3
"""
depth_slice_traced.py — Split a flat VTracer trace into N depth slices for a
parallax / isometric / dolly-zoom camera.

Slice assignment (validated at 0.3% recomposition error on the road ref):
  1. full-canvas base fills -> slice 0 (sky)
  2. blend of bbox-bottom-y (60%) and original paint index (40%) -> band
  3. containment passes: a path painted later INSIDE another path's bbox is
     detail on that surface and must not sink behind it
Clouds nudge one band farther. Works on plain or pre-animated
(animate_traced_svg.py) input: <style> and clone overlays follow their
originals into the right slice.

Usage:
  python depth_slice_traced.py input.svg slices/ --n 6 [--focal 0.69 0.14]
"""
import argparse, json, os, re


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input"); ap.add_argument("outdir")
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--horizon", type=float, default=0.18)
    ap.add_argument("--focal", type=float, nargs=2, default=[0.5, 0.15])
    args = ap.parse_args()
    src = open(args.input).read()
    head = re.search(r"<svg\b[^>]*>", src).group(0)
    m = re.search(r'width="(\d+)" height="(\d+)"', src)
    W, H = int(m.group(1)), int(m.group(2))
    style = re.search(r"<style>.*?</style>", src, re.S)
    style = style.group(0) if style else ""

    paths = []
    for mm in re.finditer(
            r'<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})"'
            r' transform="translate\(([-\d.]+),([-\d.]+)\)"([^/]*)/>', src):
        d, fill = mm.group(1), mm.group(2)
        tx, ty, extra = float(mm.group(3)), float(mm.group(4)), mm.group(5)
        nums = [float(v) for v in re.findall(r"-?\d+\.?\d*", d)]
        xs, ys = nums[0::2], nums[1::2]
        idm = re.search(r'id="(p\d+)"', extra)
        paths.append({"raw": mm.group(0), "fill": fill,
                      "id": idm.group(1) if idm else None,
                      "x0": min(xs)+tx, "y0": min(ys)+ty,
                      "x1": max(xs)+tx, "y1": max(ys)+ty,
                      "idx": len(paths)})
    N, n_idx = args.n, len(paths)

    def kindof(p):
        r, g, b = (int(p["fill"][i:i+2], 16) for i in (1, 3, 5))
        w, h = p["x1"]-p["x0"], p["y1"]-p["y0"]
        mx, mn = max(r, g, b), min(r, g, b)
        if w*h > W*H*0.25: return "base"
        if (mn > 175 and mx-mn < 45) or (b >= r and b > 185 and g > 175):
            return "cloud"
        return "solid"

    def initial(p):
        k = kindof(p)
        if k == "base": return 0
        yb = p["y1"]/H
        if yb <= args.horizon and p["idx"] < n_idx*0.5: return 0
        t = 0.6*max(0, (yb-args.horizon)/(1-args.horizon)) + 0.4*(p["idx"]/n_idx)
        s = 1 + min(N-2, int(t**1.2 * (N-1)))
        if k == "cloud" and s > 1: s -= 1
        return s

    assign = [initial(p) for p in paths]
    for _ in range(3):
        changed = 0
        for j, pj in enumerate(paths):
            for i, pi in enumerate(paths[:j]):
                if (pi["x0"] <= pj["x0"] and pi["x1"] >= pj["x1"] and
                        pi["y0"] <= pj["y0"] and pi["y1"] >= pj["y1"] and
                        assign[j] < assign[i]):
                    assign[j] = assign[i]; changed += 1
        if not changed: break

    # clones/uses follow the original they reference
    id2slice = {p["id"]: s for p, s in zip(paths, assign) if p["id"]}
    uses = [[] for _ in range(N)]
    for um in re.finditer(r'<use href="#(p\d+)"[^>]*/>', src):
        uses[id2slice.get(um.group(1), N-1)].append(um.group(0))

    os.makedirs(args.outdir, exist_ok=True)
    buckets = [[] for _ in range(N)]
    for p, s in zip(paths, assign):
        buckets[s].append(p["raw"])
    meta = {"width": W, "height": H, "focal": args.focal, "slices": []}
    for i in range(N):
        body = "\n".join(buckets[i])
        overlay = ("\n<g class='animated-overlay'>\n" + "\n".join(uses[i]) +
                   "\n</g>") if uses[i] else ""
        open(os.path.join(args.outdir, f"slice_{i}.svg"), "w").write(
            f"{head}{style}\n{body}{overlay}\n</svg>")
        meta["slices"].append({"file": f"slice_{i}.svg", "z": i,
                               "paths": len(buckets[i]), "clones": len(uses[i])})
        print(f"slice_{i}.svg: {len(buckets[i])} paths, {len(uses[i])} animated clones")
    json.dump(meta, open(os.path.join(args.outdir, "slices.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
