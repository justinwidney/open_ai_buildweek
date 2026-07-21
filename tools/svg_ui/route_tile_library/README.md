# Modular watercolor route tiles

This library replaces the procedural fork contact sheet with 25 individually
image-generated route scenes. The route and its supporting land are painted as
one coherent floating-island composition, so forks, exits, and loops retain the
meaning that the procedural overlays lost.

## What is here

- `rasters/`: original full-resolution built-in image-generation results.
- `normalized/`: canonical 1200 x 694 PNGs with deterministic side-socket snaps.
- `svgs/`: full-detail 1200 x 694 VTracer SVGs traced directly from the
  normalized masters without a second resize.
- `tile_recipes.json`: the 25 topologies and shared connector contract.
- `manifest.json`: every PNG/SVG path, socket, compatible socket, trace count,
  and measured seam result.
- `contact_sheet.png`: all 25 accepted route scenes.
- `seams/`: direct R-to-L crop previews for the three connector levels.
- `PROMPTS.md`: built-in generation mode and the final prompt template.

## Connector contract

Side sockets are matched pairs. Connect `R0 -> L0`, `R1 -> L1`, or `R2 -> L2`.

| level | role | normalized center y | cream-road width |
|---|---|---:|---:|
| 0 | near | 0.560 | 0.028 x canvas height |
| 1 | middle | 0.510 | 0.013 x canvas height |
| 2 | far | 0.375 | 0.016 x canvas height |

`B0` is the bottom-center foreground entry and `T0` is the castle destination.
The path mouths align exactly; the complete skies are scene transitions rather
than one giant horizontally tileable panorama, so use a short crossfade/dolly
when changing full scenes.

For each SVG, topology is both machine-readable in `manifest.json` and embedded
inside the file:

```xml
<svg data-route-tile="22_near_left_far_right" ...>
  <metadata id="route-tile">{"sockets":["B0","T0","L0","R2"],...}</metadata>
```

## Composing NEW tiles without an image model

Every master shares the same castle, camera, sky, and palette, so a tile's
route delta (branch road + supporting landmass) can be isolated by diffing it
against `01_straight`, grown geodesically from the socket mouth, and
feather-blended onto another tile. Where deltas overlap, the donor whose
pixels differ most from the base wins (cream road pixels get a large bonus so
thin far branches survive). Composites are seam-snapped and traced exactly
like the masters:

```powershell
py -3.11 compose_route_tiles.py            # 9 recipes incl. validation
py -3.11 compose_route_tiles.py --skip-svg # fast PNG-only iteration
```

Outputs land in `composites/` (normalized PNGs, SVGs with route-tile
metadata, manifest, contact sheet, per-part mask overlays in
`composites/debug/`). Each composite records a `seam_report` (flush socket
proof) and a `connectivity` map (B0-flood proof that every socket mouth is on
one road network). `val_22_reconstruction` rebuilds tile 22 from 06+12 deltas
as a standing accuracy check — compare `val_22_reconstruction_vs_real.png`.
The 8 new tiles cover socket sets absent from the 25 masters: `L0+R1`,
`L1+R0`, `L1+R2`, `L2+R0`, `L2+R1`, same-side `L0+L2`, triple `L0+R0+R2`,
and loop+exit.

## Rebuild

Use Python 3.11 because that environment contains Pillow, NumPy, SciPy, and
VTracer:

```powershell
cd tools/svg_ui/route_tile_library
py -3.11 prepare_tile_library.py --resume
py -3.11 verify_tile_library.py
```

`--skip-svg` rebuilds only normalized PNGs, seams, and the contact sheet.
`--resume` retains already completed SVG traces and continues missing ones.

The seam pass detects the warm cream road at each requested edge, then applies
a feathered local affine correction across only the outer 12% of the image. It
snaps center and perspective width while leaving the interior composition and
the sky corners unchanged.
