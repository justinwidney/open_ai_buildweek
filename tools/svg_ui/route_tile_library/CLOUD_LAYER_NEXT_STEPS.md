# Cloud layer — next steps

Status as of this session: [animate_grouped_route_tile.py](../../svg_grouper/animate_grouped_route_tile.py)
gives every object in a route tile independent motion (own delay, own
sway/drift) driven off `group_svg_objects.py`'s segmentation. One test copy
exists: [svgs_animated/01_straight.animated.svg](svgs_animated/01_straight.animated.svg).

New focus: clouds specifically, because they're the one category that's
*reliably* identifiable — light/pale, blue-tinted, upper-canvas, isolated
from every other palette in the scene (trees, by contrast, are muted
olive/gray and get confused with rock/shadow; validated earlier this
session). Two changes:

1. Stop animating clouds as N independently-phased objects; move them as
   one coherent layer drifting left-to-right.
2. Add new cloud sprites from `tools/svg/sprites_svg/horizon-clouds/`
   (12 sprites, same VTracer stacked-path format as the route tiles, sizes
   6-94 paths each) into the sky region instead of only reusing what's
   already painted in each tile.

## Plan

**A. Coherent drift layer**
- Wrap all `obj_NN_cloud` groups for a tile (or a chosen depth-subset of
  them) in a single `<g id="cloud-layer">`.
- Animate `translateX` on that *one* wrapper instead of per-object
  `stable_delay` jitter. Every cloud moves the same direction at the same
  speed — reads as a sky drifting, not a scatter of independently twitching
  puffs.
- Keep the existing per-object `cloud-sway` (tiny ±3px) as a secondary,
  still-independent motion layered on top for texture, since that one is
  subtle enough not to fight the coherent read.

**B. Import new sprites**
- Pick sprites from `horizon-clouds/`, place them into the tile's sky band
  (roughly `y < 0.25 * H` based on the existing cloud auto-label's own
  vertical spread) via `<g transform="translate(x,y) scale(s)">` wrapping
  the sprite's paths, appended into the tile's paint order *after* `sky_base`
  but *before* the foreground islands/castle so they sit correctly.
- Tag the imported group with the same `cloud-obj` class so it rides the
  same drift-layer animation as the native clouds for free.

## Challenges to work through

1. **Loop without exposing a hole.** VTracer's stacked paint means there is
   nothing behind a cloud — translating the layer far enough to fully exit
   one edge reveals raw sky where a cloud used to be, then nothing coming in
   the other side (no wraparound). Options: (a) keep the traversal small
   (a slow, bounded back-and-forth drift, which is what the current
   `cloud-drift` keyframe already does — safe but reads as sway, not a
   directional "spanning" drift); (b) clip the layer with a `<clipPath>` at
   canvas bounds and drive a modulo/looping translate with duplicated clouds
   offset by one tile-width, so as one exits left a duplicate enters right —
   more convincing but needs the cloud layer's total width measured and
   mirrored, plus doubles the cloud path count in the DOM.

2. **Verify the color signature generalizes across all 25 tiles, not just
   `01_straight`.** These tiles are delta-composited from one shared master
   scene (per the route-tile-compositing pipeline), so the cloud palette is
   probably consistent — but that needs to actually be checked (rerun the
   `group_svg_objects.py` cloud auto-label, or the raw color heuristic, on 2-3
   more tiles spanning different topologies before trusting it for a batch
   run).

3. **Palette matching for imported sprites.** The `horizon-clouds/` sprites
   were traced independently — likely close in hue family (same VTracer
   pipeline, same kind of source art) but not guaranteed to match the
   specific muted tones of a given route tile's existing clouds. Need to
   eyeball a composited test before trusting it; a mismatched sprite will
   read as visibly pasted-in.

4. **Placement collisions.** Sky region should be safe from the
   per-tile-varying road/socket geometry (that's all lower in the canvas),
   but the different topologies (loops, forks, crossroutes) may still shift
   where floating islands/foreground silhouettes intrude into the upper
   canvas — a sprite placed at a fixed sky coordinate for `01_straight`
   might clip behind/through foreground geometry on a different tile. Need
   either a per-tile safe-zone check or conservative placement well above
   all islands.

5. **File size / path count.** Each tile is already ~3.8MB after grouping +
   animation tags. Duplicating clouds for seamless looping (challenge 1b)
   and importing sprites (up to 94 extra paths each) compounds that across
   25 files — worth deciding a budget before batching.

## Open questions before building this

- Bounded sway-drift (safe, already working) vs. true looping
  left-to-right traversal (better effect, more moving parts) — which is
  worth the complexity?
- How many sprites to import per tile, and is manual placement (pick
  coordinates by eye per tile) acceptable, or does this need to be
  automatic/scriptable across all 25?
