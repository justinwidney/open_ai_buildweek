# SVG sprite catalog

`sprites_svg/` is the source library used directly by the Background-Only and
Level 2 labs. Assets are physically grouped into folders named after the
catalog group. Vite discovers every `.svg` recursively, so adding a new file to
any category folder automatically makes it available to the procedural system.

`catalog.json` is the curated inclusion policy:

- `members` corrects and groups the current sheet by visual meaning.
- `placement` controls whether a group enters from the horizon, sky, world
  band, outer edge, or foreground.
- `occlusion` decides whether an item may cross the center view.
- `includeByDefault` keeps surface-only trees, rocks, water, flowers, and large
  ground slabs out of the background until they are explicitly enabled.
- An SVG missing from both the catalog and statistical `manifest.json` enters
  the `New / unclassified` far-depth group. This makes new art visible without
  pretending it has been semantically reviewed.

When adding a sprite, place it in the matching `sprites_svg/<group>/` folder,
then add its ID to the same group in `catalog.json`. If it came from the sheet pipeline, run
`classify_sprites.py` against the generated PNG crops first; its role provides
the automatic fallback until the curated membership is added.

## 06_03 watercolor route

`generate_path_landscape.py` now discovers categorized sprite folders
recursively and can reproduce the broad composition of the 06_03_43 PM
reference: flowing sea washes, branching connected paths, bridge spans,
waterfalls below route islands, and a watercolor castle on the final island.

```powershell
py -3.11 tools/svg/generate_path_landscape.py `
  tools/svg/sprites_svg tools/svg/manifest.json `
  tools/svg/generated/reference_06_03_watercolor.svg `
  --config tools/svg/config_path.json --width 1680 --height 973 `
  --seed 43 --path-overlay
```

Add `--layers` and use `reference_06_03_layers.svg` as the output name to
generate separate sky, water, far, mid, near, and foreground SVGs. The focal
castle source and its chroma-removed/vector-prepared derivatives live under
`generated_sources/`; the runtime-ready vector is
`sprites_svg/distant-landmarks/castle_final_island.svg`.

`generated/reference_06_03_continuous_road.png` is the image-generated route
redesign. Its vector companion, `generated/reference_06_03_continuous_road.svg`,
replaces the floating ribbons and straight bridges with one solid pale-sand
road from the bottom-center start to the castle. The road is supported for its
full length by a connected grassy island spine; blue-gray cliffs and waterfalls
remain above the surrounding water.

The staged Three.js slicing, registered export names, depth-map convention, and
first-travel handoff are documented in `LEVEL_TWO_2_5D_PLAN.md`.

The current runtime-owned slice registry is
`generated/level-two-slices/layer-manifest.json`. It keeps every generated
cloud, waterfall, side island, and castle-flag anchor in the original
1200 x 694 reference coordinate system, so depth, parallax, render order, and
visibility can be tuned without changing the Three.js animation loop.

Validate registration bounds, the far/middle/near crops, monotonic camera
stops, generated asset presence, and final camera clearance with:

```powershell
py -3.11 tools/svg/validate_level_two_layers.py
```

Apple SHARP remains an offline authoring experiment rather than a browser
dependency. After making space on the selected drive, run
`run_sharp_depth.ps1` to create the Python 3.13 environment, download the
official repository, and predict a Gaussian `.ply` from the continuous-road
reference. The resulting scene should be used to calibrate layer depths and
the safe forward camera range; the web lab continues to load only lightweight
registered image/SVG planes.
