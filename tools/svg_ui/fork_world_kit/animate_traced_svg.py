#!/usr/bin/env python3
"""
animate_traced_svg.py — Take a flat VTracer trace and make it live.

1. Classifies every <path> by fill color + bbox geometry into:
   sky_base | cloud | waterfall | water | dirt | grass | rock | flag | detail
   (adds class= and id= attributes; paint order untouched)
2. Injects animations that DON'T expose stacking holes (vtracer paints
   shapes over each other, so moving an original reveals unpainted gaps):
     - originals stay put; animation happens on semi-transparent CLONES
       layered on top, plus tiny sways on originals
     - clouds: slow drift clones + gentle sway
     - waterfalls: downward-translating flow clones, staggered
     - water: white sheen clones pulsing (glimmer)
     - flags: skew-wave (class supported; none detected in this file)

Usage: python animate_traced_svg.py input.svg animated.svg
"""
import random
import re
import sys


def parse(src):
    out = []
    for m in re.finditer(r'<path d="([^"]+)" fill="(#[0-9A-Fa-f]{6})"'
                         r' transform="translate\(([-\d.]+),([-\d.]+)\)"\s*/>', src):
        d, fill, tx, ty = m.group(1), m.group(2), float(m.group(3)), float(m.group(4))
        nums = [float(v) for v in re.findall(r"-?\d+\.?\d*", d)]
        xs, ys = nums[0::2], nums[1::2]
        out.append({
            "i": len(out), "d": d, "fill": fill, "tx": tx, "ty": ty,
            "x0": min(xs) + tx, "y0": min(ys) + ty,
            "x1": max(xs) + tx, "y1": max(ys) + ty, "raw": m.group(0),
        })
    return out


def classify(p, W, H):
    fill = p["fill"]
    r, g, b = (int(fill[i:i + 2], 16) for i in (1, 3, 5))
    w, h = p["x1"] - p["x0"], p["y1"] - p["y0"]
    area = w * h
    cy = (p["y0"] + p["y1"]) / 2 / H
    mx, mn = max(r, g, b), min(r, g, b)
    if area > W * H * 0.25:
        return "sky_base"
    if (r > 150 and r > g + 55 and r > b + 55) and area < W * H * 0.002:
        return "flag"
    light = mn > 175 and mx - mn < 45
    pale_blue = b >= r and b > 185 and g > 175
    if (light or pale_blue) and cy < 0.6 and area > 60:
        # tall narrow light-blue streak = waterfall, else cloud
        if h > w * 1.5 and b > r + 6 and w < W * 0.06:
            return "waterfall"
        return "cloud"
    if h > w * 1.5 and b > r + 6 and b > 185 and w < W * 0.06:
        return "waterfall"
    if b > r + 20 and b > 130:
        return "water"
    if r > 150 and r > b + 28 and b + 6 < g < r + 10 and b > 80:
        return "dirt"
    if g >= b and g > r * 0.75 and g > 55:
        return "grass"
    if mx - mn < 36:
        return "rock"
    return "detail"


CSS = """
<style>
  @keyframes sway   { from { transform: translateX(-3px);} to { transform: translateX(3px);} }
  @keyframes drift  { from { transform: translateX(-38px);} to { transform: translateX(38px);} }
  @keyframes flow   { 0% { transform: translateY(-10px); opacity: 0;}
                      25% { opacity: .55;} 75% { opacity: .55;}
                      100% { transform: translateY(14px); opacity: 0;} }
  @keyframes glim   { 0%,100% { opacity: .02;} 50% { opacity: .14;} }
  @keyframes wave   { 0%,100% { transform: skewX(-6deg);} 50% { transform: skewX(6deg);} }
  .cloud        { animation: sway 26s ease-in-out infinite alternate; }
  .cloud-clone  { animation: drift 70s ease-in-out infinite alternate; opacity: .5; }
  .fall-clone   { animation: flow 2.6s linear infinite; }
  .water-sheen  { animation: glim 7s ease-in-out infinite; fill: #ffffff; }
  .flag         { animation: wave 1.8s ease-in-out infinite; }
  .cloud, .cloud-clone, .fall-clone, .flag, .water-sheen { will-change: transform, opacity; }
  path { transform-box: fill-box; transform-origin: center; }
</style>
"""


def main():
    inp, outp = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "animated.svg"
    src = open(inp).read()
    m = re.search(r'width="(\d+)" height="(\d+)"', src)
    W, H = int(m.group(1)), int(m.group(2))
    paths = parse(src)
    rng = random.Random(7)

    counts = {}
    clones = []
    for p in paths:
        cls = classify(p, W, H)
        counts[cls] = counts.get(cls, 0) + 1
        p["cls"] = cls
        tagged = p["raw"][:-2] + f' id="p{p["i"]}" class="{cls}"/>'
        src = src.replace(p["raw"], tagged, 1)

    # ---- clone layers (animated copies; originals stay put => no holes) ----
    def clone(p, cls, style=""):
        return (f'<use href="#p{p["i"]}" class="{cls}"'
                + (f' style="{style}"' if style else "") + "/>")

    clouds = sorted((p for p in paths if p["cls"] == "cloud"),
                    key=lambda p: -(p["x1"] - p["x0"]) * (p["y1"] - p["y0"]))
    for p in clouds[:14]:
        clones.append(clone(p, "cloud-clone",
                            f"animation-delay:-{rng.uniform(0, 60):.0f}s"))
    for p in (p for p in paths if p["cls"] == "waterfall"):
        clones.append(clone(p, "fall-clone",
                            f"animation-delay:-{rng.uniform(0, 2.6):.1f}s"))
    waters = sorted((p for p in paths if p["cls"] == "water"),
                    key=lambda p: -(p["x1"] - p["x0"]) * (p["y1"] - p["y0"]))
    for p in waters[:40]:
        clones.append(clone(p, "water-sheen",
                            f"animation-delay:-{rng.uniform(0, 7):.1f}s"))

    overlay = '\n<g id="animated-overlay">\n' + "\n".join(clones) + "\n</g>\n"
    src = src.replace("</svg>", overlay + "</svg>")
    m2 = re.search(r"<svg\b[^>]*>", src)
    src = src[:m2.end()] + CSS + src[m2.end():]
    open(outp, "w").write(src)
    print("classes:", dict(sorted(counts.items(), key=lambda t: -t[1])))
    print(f"animated clones: {len(clones)}  ->  {outp}")


if __name__ == "__main__":
    main()
