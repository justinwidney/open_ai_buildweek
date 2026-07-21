# Level 2 watercolor 2.5D plan

## Current first view

The Level 2 runtime keeps `reference_06_03_continuous_road.svg` as one shared
texture and renders it through registered world-space planes:

1. The complete composition is the registration/fallback plate.
2. Three registered UV crops repeat the far castle, middle route, and near
   route bands at independent depths while sharing the same GPU texture.
3. `sprite_033.svg` is an independent near-side island.
4. Generated alpha sprites provide two cloud banks and three waterfalls.
5. Three registered pennant anchors animate over the castle roofs.

The planes face the initial camera, share the same world hierarchy, and use
progressively stronger pointer parallax. The camera looks down at 45 degrees.
The base plate is recalculated with CSS `cover` semantics whenever the canvas
aspect changes. Forward travel pushes the camera along its view ray by a bounded
amount per stop; it never translates the plate through or behind the camera.

`layer-manifest.json` owns registered source coordinates, depth, parallax,
visibility, phase, render order, the three depth-band crops, and progressive
camera-push stops. Disable or replace a plane there instead of editing the
animation loop.

## Layer export contract

Every future layer should use the same 1200 x 694 canvas and registration. Use
transparent backgrounds except for the sky/base plate, and do not resize or
reframe individual exports.

| Order | Suggested asset | Contents | Initial depth |
| --- | --- | --- | --- |
| 0 | `06_03_sky-base` | Sky gradient and distant haze only | farthest |
| 1 | `06_03_far-islands` | Horizon islands, distant clouds, and castle silhouette | far |
| 2 | `06_03_castle` | Castle and final island, with transparent background | far-mid |
| 3 | `06_03_water` | Turquoise surface and foam; no land or sky | horizontal water plane |
| 4 | `06_03_route-mid` | Middle road, grass, cliffs, waterfalls, trees, and rocks | mid |
| 5 | `06_03_route-near` | Foreground road and connected island edges | near |
| 6 | `06_03_foreground-islands` | Left/right framing islands and vegetation | nearest |

SVG is preferred for clean authored cutouts. Transparent PNG is acceptable for
soft watercolor edges. Keep waterfalls with their owning island layer until a
separate animated waterfall pass exists.

## Depth-map option

Create one registered grayscale image where white is nearest and black is
farthest. Keep sky nearly black, distant islands dark gray, the castle and
middle route mid-gray, and the foreground route/islands light gray. Avoid
painting depth differences inside small brush texture; depth should describe
large forms. The runtime can sample this map in a subdivided plane shader for
subtle displacement while the semantic planes remain available for independent
motion and culling.

## Apple SHARP authoring experiment

SHARP is an offline authoring option, not a browser dependency. The official
model predicts a metric `.ply` Gaussian scene from one image on CPU, CUDA, or
MPS. Its optional trajectory renderer currently requires CUDA. This workstation
has a 12 GB RTX 3060, so both prediction and trajectory rendering are compatible.

Run the checked-in wrapper after freeing enough disk space:

```powershell
powershell -ExecutionPolicy Bypass -File tools/svg/run_sharp_depth.ps1 `
  -InputPath tools/svg/generated/reference_06_03_continuous_road.png `
  -RenderTrajectory
```

The first setup attempt stopped because the C: drive had no free space. Its
three corrupt Conda archives were removed; no SHARP environment or model was
left behind. Once SHARP produces the `.ply` and trajectory frames, use them to
calibrate semantic plate depths and the safe forward camera range. Do not ship
PyTorch, the checkpoint, or the raw splat in the Level 2 bundle unless a web
Gaussian renderer is explicitly selected later.

## First-travel integration

1. Fade the full fallback plate only after all semantic plates are loaded.
2. Move one scene root in the existing requestAnimationFrame loop; do not move
   each SVG independently during travel.
3. Give near, mid, and far groups small depth-relative offsets while the main
   route approaches the camera.
4. Keep the water on its own horizontal plane below the cliffs.
5. Retire the passed near-route plate after arrival, then reveal or recycle the
   next registered route composition ahead of the camera.
6. Preserve the current parallel-world setup: camera rotation owns the turn,
   while a pre-mirrored layered world fades in upright.
