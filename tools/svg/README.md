# SVG sprite catalog

`sprites_svg/` is the source library used directly by the Background-Only lab.
Vite discovers every `.svg` file in this directory at build time, so adding a
new file automatically makes it available to the procedural recycler.

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

When adding a sprite, place it in `sprites_svg/`, then add its ID to the most
accurate group in `catalog.json`. If it came from the sheet pipeline, run
`classify_sprites.py` against the generated PNG crops first; its role provides
the automatic fallback until the curated membership is added.
