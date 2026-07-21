# Animation & Depth-Layer Pipeline — Complete Guide

Turn a single flat SVG trace (VTracer output) into an **animated, depth-layered
scene** with a camera that walks up the road to the castle. Every command, every
knob, and how each stage works internally.

---

## 0. Prerequisites

```bash
pip install vtracer pillow scipy numpy cairosvg
```

Input requirement: a VTracer-traced SVG (flat list of `<path d=... fill=...
transform="translate(x,y)"/>` elements). If you start from a PNG:

```bash
python -c "import vtracer; vtracer.convert_image_to_svg_py('scene.png','scene.svg', \
  colormode='color', hierarchical='stacked', mode='spline', \
  filter_speckle=8, color_precision=7)"
```

---

## 1. Animate the trace

```bash
python animate_traced_svg.py scene.svg animated.svg
```

### What it does
1. **Classifies every path** by fill color + bbox geometry into:
   `sky_base | cloud | waterfall | water | dirt | grass | rock | flag | detail`
   and stamps `id="pN" class="..."` on each (paint order untouched).
2. **Injects CSS keyframes + animated clones.** VTracer's stacked mode paints
   shapes over each other — there is *nothing* behind a cloud, so moving the
   original would reveal an unpainted hole. Instead the originals stay put and
   semi-transparent `<use>` **clones** animate on top:

   | element    | technique                                              | keyframe |
   |------------|--------------------------------------------------------|----------|
   | clouds     | originals sway ±3px; 14 largest get drifting clones    | `sway`, `drift` |
   | waterfalls | clones translate downward on a loop, staggered delays  | `flow`   |
   | water      | 40 largest get white clones pulsing 2–14% opacity      | `glim`   |
   | flags      | skew-wave on the original (small shapes, holes hidden) | `wave`   |

### Detection rules (edit `classify()` to tune)
- `sky_base` — bbox area > 25% of canvas
- `flag` — saturated red/orange (`r > g+55` and `r > b+55`), tiny area
- `cloud` — light & desaturated, or pale blue, upper 60%
- `waterfall` — light blue, **tall** (h > 1.5w) and narrow (w < 6% canvas)
- `water` — blue (`b > r+20`), `dirt` — warm beige, `grass` — olive/green,
  `rock` — low saturation gray

### Customizing motion
All timing lives in the `CSS` string at the top of the script:
- slower clouds → raise `drift 70s`
- faster falls → lower `flow 2.6s`
- stronger glimmer → raise the `50% { opacity: .14 }` peak
- flag flutter → `wave 1.8s` period and `skewX(±6deg)` amplitude

**Adding flags to art that lacks them:** draw small pennants in any saturated
red/orange (e.g. `#D8402A`) — they will auto-classify and wave.

---

## 2. Slice into depth layers

```bash
python depth_slice_traced.py animated.svg slices --n 6 --focal 0.41 0.10
```

Outputs `slices/slice_0.svg` (farthest: sky + base fills) … `slice_5.svg`
(nearest foreground), plus `slices/slices.json` (canvas size, focal, per-slice
z + counts). Animated clones automatically land in the same slice as the path
they reference; the `<style>` block is copied into every slice so animations
keep playing per-layer.

### The assignment algorithm (0.3% recomposition error, validated)
1. Full-canvas fills → slice 0.
2. Everyone else: depth score = **0.6 × bbox-bottom-y + 0.4 × paint index**.
   Bottom edge (not center) so tall trees anchor to the ground they stand on;
   paint index because VTracer paints detail later, and later ≈ nearer.
3. **Containment passes**: a path painted later *inside* another path's bbox is
   surface detail (dirt on grass, highlight on rock) and is promoted so it
   never sinks behind its surface. Repeats until stable.
4. Clouds nudge one slice farther than their y suggests (they float behind
   land at the same height).

### Knobs
- `--n 6` — layer count. More = smoother parallax, more DOM/texture cost.
  4 is fine for subtle parallax; 8 for a deep dolly.
- `--horizon 0.18` — everything whose bbox bottom is above this joins the sky
  slice. Raise if distant land sticks to the sky layer.
- `--focal X Y` — normalized castle position (see step 3 for auto-extraction).

### Verifying a slice job
Stack the slices far→near and diff against the original:
```bash
python - <<'EOF'
import cairosvg, numpy as np
from PIL import Image
cairosvg.svg2png(url='scene.svg', write_to='_o.png', output_width=900)
imgs=[]
for i in range(6):
    cairosvg.svg2png(url=f'slices/slice_{i}.svg', write_to=f'_s{i}.png', output_width=900)
    imgs.append(Image.open(f'_s{i}.png').convert('RGBA'))
c=imgs[0]
for im in imgs[1:]: c=Image.alpha_composite(c,im)
d=np.abs(np.array(c.convert('RGB')).astype(int)-np.array(Image.open('_o.png').convert('RGB')).astype(int)).max(-1)
print(f"err>10 on {(d>10).mean()*100:.1f}% of pixels")
EOF
```
Under ~1% (before animation clones) is good. If higher, raise the paint-index
weight from 0.4 toward 0.5 in `initial()`.

---

## 3. Extract the road track (camera path)

The walk camera follows the road's real centerline. Extract it from the
rendered image with the analyzer:

```bash
python -c "import cairosvg; cairosvg.svg2png(url='animated.svg', write_to='ref.png', output_width=1200)"
python analyze_reference.py ref.png road_cfg.json
```

`road_cfg.json` now holds `path_points` (dirt centerline, bottom→top) and
`focal` (where the road converges = the castle). Merge into the slice meta:

```bash
python - <<'EOF'
import json
cfg=json.load(open('road_cfg.json')); meta=json.load(open('slices/slices.json'))
tr=sorted(cfg['path_points'], key=lambda p:-p[1]); tr.append(cfg['focal'])
xs=[p[0] for p in tr]
for i in range(1,len(xs)-1): xs[i]=(xs[i-1]+2*xs[i]+xs[i+1])/4   # smooth bends
meta['track']=[[round(x,3),round(p[1],3)] for x,p in zip(xs,tr)]
meta['focal']=cfg['focal']
json.dump(meta, open('slices/slices.json','w'), indent=1)
EOF
```

How the extraction works: mask warm-beige pixels, keep the largest connected
component (the road network), walk row by row taking the smoothed per-row
centroid. The top of that line **is** the castle's doorstep, which is why the
walk ends exactly there.

---

## 4. Build the walk-the-path viewer

```bash
python build_viewer.py slices viewer.html --spacing 260 --drop 0.12
```

Open `viewer.html` in a browser (self-contained — all slices inlined, works
from `file://`).

### Camera model (why it walks instead of zooming into the road)
For progress `t` (scroll / slider, 0→1):
1. **Dolly** — the world translates `+Z` by `t × MAXD`, moving the camera into
   the layer stack. `MAXD` stops 60px short of the far slice.
2. **Steering** — the CSS `perspective-origin` (the point everything converges
   toward) travels along `meta.track`, so the view leans into each bend of the
   road and eases onto the castle (`u²` blend) for the finish.
3. **Road drop** — the world sinks by `t × drop × height`, pushing the road
   into the lower third while the castle rises to upper-center framing.
4. **Pass-through fade** — each layer's opacity ramps `1→0` over the last
   `0.85 × spacing` px before the camera reaches its depth, then hides. This
   is what stops the foreground road from smearing across the screen.

### Controls
scroll / slider = walk · click = retarget the castle (gold ring) ·
mouse move = parallax sway · **I** = isometric tilt (rotateX 26° + rotateZ −4°)

### Knobs
- `--spacing` (260) — depth between layers. Bigger = stronger parallax and a
  longer walk; smaller = subtler, flatter.
- `--drop` (0.12) — how far the road sinks by the end. 0 = pure zoom;
  0.2 = pronounced "looking up at the castle".
- In the JS: `FADE` window, `u*u` castle-ease, sway strengths.

---

## 5. Porting to Three.js

Two routes (details in THREEJS_NOTES.md):

**A. Texture planes** — rasterize each slice, `PlaneGeometry` at
`z = -(N-1-i) × spacing`, `renderOrder = i`, transparent materials. Recreate
the walk: move the camera along `track` mapped into world space, lerp its
`lookAt` toward the castle, fade each plane's `material.opacity` with the same
gap formula. Caveat: rasterized textures freeze CSS animation — animate cloud/
water layers with `texture.offset` scrolling and an opacity sine instead (the
class tags let you export those groups as separate planes).

**B. CSS3DRenderer** — wrap each slice `<div>` as a `CSS3DObject`; your CSS
keyframes keep running natively, and WebGL objects (characters, particles) can
render among the layers.

Staging tips: rasterize slice_0/1 at 2–3× resolution (they fill the screen at
the end of the walk); keep `fov` low (20–30°) so the flat billboards don't
splay; disable `depthWrite` on the transparent planes to avoid sorting
artifacts.

---

## 6. Full pipeline, one block

```bash
python animate_traced_svg.py scene.svg animated.svg
python depth_slice_traced.py animated.svg slices --n 6
python -c "import cairosvg; cairosvg.svg2png(url='animated.svg', write_to='ref.png', output_width=1200)"
python analyze_reference.py ref.png road_cfg.json
# merge track (step-3 snippet)
python build_viewer.py slices viewer.html --spacing 260 --drop 0.12
```

## Troubleshooting

| symptom | fix |
|---|---|
| road still fills screen late in the walk | raise `--drop` (0.15–0.2), or widen `FADE` to `spacing × 1.1` |
| walk ends on a cloud, not the castle | click the castle in the viewer, or set `meta.focal` / `--focal` manually |
| gaps/holes flash during parallax | slice count too high for the art — drop `--n`, or raise the paint-index weight |
| clouds pop instead of drift | they were classified `rock/detail` — loosen `light` threshold (`mn > 165`) |
| waterfalls not animating | streaks wider than 6% of canvas — raise the `w < W*0.06` cap in both scripts |
| animations dead in Three.js | textures are static rasters — use CSS3DRenderer or texture-offset animation |

---

## 7. Branching: side paths, forks, and turning

### 7a. Extract the road GRAPH (not just one centerline)

```bash
pip install scikit-image
python extract_path_graph.py animated.svg slices/slices.json
```

Skeletonizes the road mask, classifies skeleton pixels (endpoint = 1 neighbor,
junction >= 3), walks the corridors between them into edge polylines, prunes
skeleton twigs (< 5.5% canvas ending at a dead end), and merges pass-through
chains. Result on the road reference: 16 nodes / 7 junctions / 15 edges.
Written to `graph.json` and into `slices.json` as `meta.graph`:

```json
{ "nodes": [{"id": 28, "x": 0.45, "y": 0.82}, ...],
  "edges": [{"a": 28, "b": 49, "pts": [[x,y], ...]}, ...],
  "start": 170, "castle": 97 }
```

### 7b. Walk it with turns (viewer v3)

```bash
python build_viewer.py slices viewer.html --spacing 260 --drop 0.12
```

The camera now advances along the current EDGE polyline. Dolly is driven by
the walked point's height (the road climbing = moving deeper into the layer
stack), so side branches that wander laterally pan the view without advancing
depth — which is exactly how a turn should feel in 2.5D. Approaching a fork,
arrow glyphs appear over the junction; **←/→ selects, scroll or ↑ commits.**
The pre-selected branch is always the one leading toward the castle
(Dijkstra over edge arc lengths). Scrolling backwards retraces your history
through every turn you took. A small `rotateY` lean follows the local road
heading so turns bank slightly.

### 7c. Generate NEW side-path art for branches that don't exist

```bash
python generate_branch.py sprites/svg manifest.json branch_left.svg \
  --start 0.45 0.82 --heading -0.7 -0.5 --length 0.5 \
  --config config_path.json --seed 3
```

Produces a transparent SVG of connected islands chained along a fresh spline
leaving your chosen junction, using the sprite kit's dirt-alignment (each
island's painted dirt pinned to the spline and mirrored to match direction),
plus `branch_left.json` recording the spline so you can append it to the
graph. Knobs: `--heading` (x right, y down — negative y climbs into the
distance), `--length` (fraction of the canvas diagonal), `--wander`
(0 = straight, 0.35 = winding), `--seed` to reroll.

**Wiring a generated branch into the walkable world:**
1. Composite `branch_left.svg` over the scene (same canvas) or into the
   matching depth slices (its far/mid/near grouping mirrors the slicer bands).
2. Append to `meta.graph`: add an end node at `branch_left.json`'s `end`, and
   an edge `{a: <junction id>, b: <new id>, pts: <spline>}`.
3. Rebuild: `python build_viewer.py slices viewer.html` — the fork now offers
   the new arm, and the walker can turn onto islands the original image never
   contained.

For infinite worlds: generate branches lazily when the walker first looks down
a fork, cache the SVG + graph patch, and stream slices per-branch in Three.js.

---

## 8. Style-matched forks that lead to new scenes

The sprite-based branch generator makes scattered islands; when the scene's
language is ONE continuous painted road, use the fork pipeline instead:

```bash
# 1. harvest the road's exact colors from the tagged trace (road_style.json)
#    (base #B8A45F, light #ECD1A7, dark #988C5D + grass/rock palette)
# 2. draw a fork in that style, snapped onto real road pixels:
python fork_road.py slices/slices.json road_style.json fork_left.svg \
    --attach-y 0.62 --side left --exit-y 0.40 --seed 3 \
    --next scene_left_viewer.html --scene animated.svg
# 3. wire it into graph + depth slice:
python integrate_fork.py fork_left.json fork_left.svg
python build_viewer.py slices viewer.html
```

What fork_road.py draws (all outlines blob-jittered to match the traced look):
land arm (layered grass fills + mottled patches), rocky hanging underside
fringes like the floating islands, the road itself (dark edge / base fill /
light center / speckles — measured within Δ3/255 of the main road), and a few
conifer silhouettes. `--attach-y` picks the split height (snapped to actual
road pixels via `--scene`), `--side` and `--exit-y` set where it leaves the
canvas, `--wander` isn't needed — the smoothstep ease reads as a natural turn.

In the viewer, the fork appears at its junction with a ⇗ arrow. Selecting it
and walking to the canvas edge fades to black and loads `--next` — your next
SVG scene's viewer. Chain worlds by generating each scene, slicing it, and
pointing forks at each other (the next scene's own fork can point back).
