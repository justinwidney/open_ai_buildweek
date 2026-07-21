#!/usr/bin/env python3
"""
build_viewer.py — Emit a self-contained walk-the-path viewer.html from depth
slices + slices.json.

Camera model ("walking up the road", not a straight zoom):
  - progress t in [0,1] (scroll / slider)
  - dolly: camera advances into the layer stack:   z = t * MAXD
  - the convergence point (perspective-origin) TRAVELS ALONG THE ROAD's
    centerline (meta.track, extracted from the dirt pixels) and finishes on
    the castle focal -> the view steers with the road's bends
  - road drop: the world shifts down as t grows so the road sits in the lower
    third and the castle takes the upper-center of the frame
  - pass-through fade: each layer fades out just before the camera reaches
    its depth, so foreground road never smears across the screen
  - click = set the final target (castle);  I = isometric tilt;  mouse = sway

Usage: python build_viewer.py slices/ viewer.html [--spacing 260] [--drop 0.12]
"""
import argparse
import json
import os
import re


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sdir", nargs="?", default="slices")
    ap.add_argument("out", nargs="?", default="viewer.html")
    ap.add_argument("--spacing", type=int, default=260,
                    help="px depth between layers (parallax strength)")
    ap.add_argument("--drop", type=float, default=0.12,
                    help="fraction of height the world sinks by t=1 "
                         "(keeps the road low, castle high)")
    args = ap.parse_args()

    meta = json.load(open(os.path.join(args.sdir, "slices.json")))
    W, H = meta["width"], meta["height"]
    fx, fy = meta["focal"]
    N = len(meta["slices"])
    spacing = args.spacing
    track = meta.get("track") or [[fx, 0.8], [fx, fy]]

    layers = []
    for s in meta["slices"]:
        svg = open(os.path.join(args.sdir, s["file"])).read()
        svg = re.sub(r"^.*?<svg", "<svg", svg, flags=re.S)
        depth = (N - 1 - s["z"]) * spacing
        layers.append(f'<div class="layer" data-depth="{depth}" '
                      f'style="transform:translateZ({-depth}px)">{svg}</div>')

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Walk the Path</title>
<style>
  html,body {{ margin:0; height:100%; background:#0e1420; overflow:hidden;
               font:12px system-ui; color:#cfd8e3; }}
  #stage {{ position:absolute; inset:0; display:flex;
            align-items:center; justify-content:center; }}
  #cam {{ width:{W}px; height:{H}px; perspective:1100px; }}
  #world {{ width:100%; height:100%; position:relative;
            transform-style:preserve-3d; }}
  .layer {{ position:absolute; inset:0; transform-style:preserve-3d;
            backface-visibility:hidden; }}
  .layer svg {{ width:100%; height:100%; display:block; }}
  #hud {{ position:fixed; left:12px; bottom:12px; background:#0009;
          padding:10px 14px; border-radius:8px; line-height:1.8; z-index:9; }}
  #prog {{ width:240px; vertical-align:middle; }}
  #focus {{ position:fixed; width:14px; height:14px; border:2px solid #ffd76a;
            border-radius:50%; margin:-8px 0 0 -8px; pointer-events:none;
            z-index:9; box-shadow:0 0 6px #000a; }}
</style></head><body>
<div id="stage"><div id="cam"><div id="world">
{chr(10).join(layers)}
</div></div></div>
<div id="focus"></div>
<div id="hud">
  walk <input id="prog" type="range" min="0" max="1000" value="0"> <span id="pv">0%</span><br>
  scroll = walk the road &nbsp; click = set castle target &nbsp; <b>I</b> = isometric
</div>
<script>
  const TRACK = {json.dumps(track)};           // road centerline, bottom->castle
  const SPACING = {spacing}, N = {N}, HPX = {H};
  const MAXD = SPACING * (N - 1) - 60;         // stop just before the far slice
  const DROP = {args.drop} * HPX;              // world sink -> road stays low
  const FADE = SPACING * 0.85;                 // fade window before pass-through
  const cam = document.getElementById('cam'),
        world = document.getElementById('world'),
        slider = document.getElementById('prog'),
        pv = document.getElementById('pv'),
        focusEl = document.getElementById('focus'),
        layers = [...document.querySelectorAll('.layer')];
  let t = 0, iso = false, sx = 0, sy = 0;
  let castle = TRACK[TRACK.length - 1].slice();   // click can retarget

  function sampleTrack(u) {{
    // u in [0,1] along the road; blend toward the (possibly re-clicked) castle
    const f = u * (TRACK.length - 1), i = Math.min(TRACK.length - 2, f | 0),
          k = f - i;
    let x = TRACK[i][0] * (1 - k) + TRACK[i + 1][0] * k,
        y = TRACK[i][1] * (1 - k) + TRACK[i + 1][1] * k;
    const w = u * u;                    // ease into the castle at the end
    return [x * (1 - w) + castle[0] * w, y * (1 - w) + castle[1] * w];
  }}

  function apply() {{
    const dolly = t * MAXD;
    const [ox, oy] = sampleTrack(t);
    cam.style.perspectiveOrigin = `${{(ox * 100).toFixed(2)}}% ${{(oy * 100).toFixed(2)}}%`;
    const tilt = iso ? 'rotateX(26deg) rotateZ(-4deg)' : '';
    world.style.transform =
      `${{tilt}} translate3d(${{sx}}px, ${{sy + t * DROP}}px, ${{dolly}}px)`;
    for (const L of layers) {{
      const depth = +L.dataset.depth;
      const gap = depth - dolly;                 // px until pass-through
      L.style.opacity = gap < 0 ? 0 :
        gap > FADE ? 1 : (gap / FADE) ** 1.3;
      L.style.visibility = gap < -10 ? 'hidden' : 'visible';
    }}
    pv.textContent = (t * 100).toFixed(0) + '%';
    slider.value = t * 1000;
    const r = cam.getBoundingClientRect();
    focusEl.style.left = (r.left + castle[0] * r.width) + 'px';
    focusEl.style.top = (r.top + castle[1] * r.height) + 'px';
  }}
  slider.oninput = e => {{ t = e.target.value / 1000; apply(); }};
  addEventListener('wheel', e => {{
    t = Math.max(0, Math.min(1, t + (e.deltaY < 0 ? .02 : -.02)));
    apply();
  }}, {{passive:true}});
  addEventListener('mousemove', e => {{
    sx = (e.clientX / innerWidth - .5) * -24;
    sy = (e.clientY / innerHeight - .5) * -12;
    apply();
  }});
  addEventListener('click', e => {{
    const r = cam.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top || e.clientY > r.bottom) return;
    castle = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    apply();
  }});
  addEventListener('keydown', e => {{
    if (e.key.toLowerCase() === 'i') {{ iso = !iso; apply(); }}
  }});
  function fit() {{
    const s = Math.min(innerWidth / {W}, innerHeight / {H});
    document.getElementById('stage').style.transform = `scale(${{s}})`;
    apply();
  }}
  addEventListener('resize', fit);
  fit();
</script></body></html>"""
    open(args.out, "w").write(html)
    print(f"wrote {args.out} ({os.path.getsize(args.out)//1024} KB, {N} layers, "
          f"track {len(track)} pts -> castle {castle_str(track)})")


def castle_str(track):
    return f"({track[-1][0]:.2f},{track[-1][1]:.2f})"


if __name__ == "__main__":
    main()
