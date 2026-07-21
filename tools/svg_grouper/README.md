# svg_grouper

Turn a flat, ungrouped VTracer SVG (one `<path>` per color region, thousands of
siblings, no structure) into a **semantically grouped SVG** that an LLM -- or a
human, or `querySelectorAll` -- can navigate: background layers, per-object
groups, per-material subgroups, all with ids, classes, labels, and visible
bounding boxes. The output paints **pixel-identically** to the input, and the
tool proves it on every run.

On the reference scene it auto-identifies, among ~160 groups:

| group | what it is |
|---|---|
| `obj_01_main_island` | the main landmass chain -- everything the blue water does NOT separate |
| `obj_01_main_island__road_05` | the sandy zigzag road, castle gate to bottom edge |
| `obj_01_main_island__castle_roofs_34` | the castle: every blue roof, turret cone, and flag |
| `obj_NN_island` | each floating island the water separates from the chain |
| `obj_NN_cloud` / `obj_NN_waterfall` / `obj_NN_water` | clouds, waterfalls, water detail |

```
svg_grouper/
+-- group_svg_objects.py      organize the SVG into semantic groups, in place
+-- export_chunks.py          cut it into reusable island/castle/road ASSETS
+-- debug/
|   +-- slice_group.py        extract / remove / red-tint any group, to verify it
|   +-- render_diff.cjs       real-renderer (librsvg) pixel diff of two SVGs
|   +-- sam_regions.py        Meta Segment-Anything (FastSAM) -> --regions label map
|   +-- compose_chain.py      snap chunks together by road ports into NEW scenes
|   +-- FastSAM-s.pt          auto-downloaded FastSAM weights (23 MB)
+-- examples/reference_06_03/
    +-- *_grouped.svg / *_overlay.svg / *_groups.json   outputs for the reference
    +-- chunks/               26 standalone chunk SVGs + chunks.json manifest
    +-- combo1.png/combo2.png two NEW scenes recombined from chunks
    +-- main_island.png       the main island chain sliced out alone
    +-- castle_tint.png       castle roofs + flags tinted red in place
    +-- road_only / road_red / without_road .png        road verification set
    +-- scene_regions(.png/_preview.png)                FastSAM segment map + preview
    +-- render_diff.png       real-renderer diff of original vs grouped
```

## Requirements

- Python with **numpy** and **Pillow**. On this machine plain `python` is a
  bare 3.12 install -- use the anaconda one:
  `C:\Users\winde\anaconda3\python.exe`
- Optional, `debug/render_diff.cjs`: Node + `npm install sharp` (run inside
  `debug/`; already installed here).
- Optional, `debug/sam_regions.py`: `pip install ultralytics` (already
  installed here; needs torch).

## Usage

```powershell
C:\Users\winde\anaconda3\python.exe group_svg_objects.py path\to\flat.svg
```

Writes, next to the input (or `-o`):

| file | what |
|---|---|
| `<stem>_grouped.svg` | grouped SVG, renders identically to the input |
| `<stem>_groups.json` | manifest for LLM use: ids, labels, visible bboxes, path counts, top colors |
| `<stem>_overlay.svg` | the image with every group's labeled bbox drawn on it -- open this first |

Runtime is a few minutes for ~1000 paths (three rasterization passes at 2x).

### Output structure

```xml
<g id="background">
  <g id="bg_00_sky" data-label="sky">...</g>            <!-- canvas-scale washes -->
</g>
<g id="objects">
  <g id="obj_01_main_island" class="obj_01_main_island" data-bbox="0,15,1040,694">
    <g id="obj_01_main_island__road_05" class="obj_01_main_island__road_05"
       data-label="road_05" data-bbox="407,145,754,694">...</g>
    <g id="obj_01_main_island__castle_roofs_34" ...>...</g>
    <g id="obj_01_main_island__vegetation_09" ...>...</g>
    ...
  </g>
  <g id="obj_02_island" ...>...</g>      <!-- water-separated floating island -->
  <g id="obj_04_cloud" ...>...</g>
  ...
</g>
```

- **Top level** = objects. Solid pixels (land, rock, castle) connect into
  landmasses; **water and cloud pixels act as separators**, so islands split
  exactly where blue water runs between them. The largest landmass is named
  `main_island`, other sizable ones `island`; water/cloud/waterfall regions
  become their own groups.
- **Subgroups** = color-category regions inside a big object: `road`/`sand`,
  `terrain`, `vegetation`, `rock`, `blue` (royal blue: roofs, flags), `water`
  (cyan), `white`, `accent`.
- **Auto-labels** on top of the categories: a sandy region spanning most of
  the canvas height is the `road`; the largest top-half royal-blue subgroup
  seeds a merge that absorbs nearby blue subgroups (turret roofs, flags) into
  one `castle_roofs` unit; tall narrow white components are `waterfall`, wide
  ones `cloud`.
- A group whose paths genuinely interleave in depth with other groups is
  emitted in several **parts**: ids `...__p2`, `...__p3`, all sharing one
  `class`. **Always select by `class`** (or id prefix), never by exact id:
  `querySelectorAll('[class="obj_01_main_island__road_05"]')` gets all parts.
- `data-bbox="x0,y0,x1,y1"` is the group's *visible* bounding box -- hidden
  under-paint is excluded, so boxes are tight.

### Better segmentation with Meta's Segment Anything

When the color/connectivity heuristics aren't enough (touching same-color
objects, landmasses that physically touch), feed the grouper an external
region map. Each distinct non-black color in the map becomes its own
top-level group, overriding the heuristics wherever the map is painted:

```powershell
cd debug
python sam_regions.py ..\..\svg\generated\reference_06_03_continuous_road.png -o regions.png
python ..\group_svg_objects.py <flat.svg> --regions regions.png
```

`sam_regions.py` runs FastSAM (or the full SAM with `--checkpoint sam_vit_b.pth`)
and writes the label map plus a `_preview.png` sanity overlay. Tune with
`--conf`, `--min-px`, `--max-frac`. The map is just a PNG: open it in any
editor and merge / split / erase regions by painting -- or skip SAM entirely
and paint a few colored blobs by hand over the objects you care about; the
grouper treats hand-painted and SAM maps identically. Verified end-to-end:
130 FastSAM regions -> 0 px render diff.

## Cutting reusable chunks (compose new scenes)

`group_svg_objects.py` organizes; `export_chunks.py` **cuts assets**. Each
island platform -- with its grass, cliff depth, trees, rocks, road segment
and attached waterfalls -- becomes a standalone cropped SVG with transparent
surroundings, clipped to its traced pixel outline (all paths kept in original
paint order, so watercolor layering and anti-hairline under-paint survive).

```powershell
C:\Users\winde\anaconda3\python.exe export_chunks.py scene.svg -o chunks_dir
```

- The main landmass is split into platforms by a **watershed on the distance
  transform** (splits at narrow waists). `--min-dist` (default 50) controls
  granularity: smaller = more, finer chunks.
- The **castle is carved out first** (saturated royal-blue roofs bbox grown
  down over the walls) so towers + walls stay one asset: `chunk_NN_castle_road`.
- Every chunk records **road ports** in `chunks.json` -- points where the
  sandy road crosses its boundary -- plus a `natural_edge` score: 1.00 means
  the outline is all real silhouette (islands), low values mean the chunk was
  cut out of the landmass interior and only looks right next to a neighbor
  (`chunk_20` scores 0.35 -- use those as middle pieces, not scene edges).

Then snap chunks into **new scenes** with `debug/compose_chain.py` -- chains
chunks road-port to road-port (translate only, so quality is untouched),
`--jitter N` randomizes the horizontal offset per link for design variety,
`--at id:x,y` drops in islands and clouds anywhere, and the same chunk id can
be repeated to make longer roads:

```powershell
cd debug
python compose_chain.py ..\examples\reference_06_03\chunks out.svg ^
    chunk_04_castle_road chunk_00_platform_road --jitter 45 --seed 7 ^
    --at chunk_03_island:40,140 --at chunk_21_cloud:820,60
node render_diff.cjs out.svg        # rasterize to PNG to check
```

See `examples/reference_06_03/combo1.png` / `combo2.png` for two variations
generated exactly this way. For custom cuts the heuristics can't make (e.g.
splitting platforms that physically touch), paint a `--regions` map (SAM or
by hand) -- `export_chunks.py` accepts the same watershed override via finer
`--min-dist`, and `group_svg_objects.py --regions` for grouping.

### Renaming groups

Auto-labels are heuristics. To assign real names: open the overlay, then
write a labels JSON keyed by the short ids shown in the manifest and re-run:

```json
{ "obj_02": "east_island", "obj_01/sand_05": "road", "bg_00": "sky" }
```
```powershell
... group_svg_objects.py scene.svg --labels my_labels.json
```

### Options

| flag | default | meaning |
|---|---|---|
| `-o` | `<stem>_grouped.svg` | output path |
| `--bg-threshold` | `0.55` | bbox area fraction of canvas above which a path is a background wash |
| `--gap` | `2` | px dilation bridging gaps when connecting one object's pixels |
| `--split-frac` | `0.10` | component share of object pixels above which it gets category subgroups |
| `--min-obj-px` | `60` | smaller components join the `debris` group |
| `--min-sub-paths` | `3` | smaller subgroups fold into the spatially nearest same-category subgroup |
| `--supersample` | `2` | rasterize at Nx so sub-pixel edge overlaps are also order-constrained |
| `--regions` | -- | PNG label map (SAM or hand-painted) overriding object segmentation |
| `--labels` | -- | JSON renames, see above |
| `--no-overlay` / `--no-verify` | -- | skip the extra outputs/passes |

## How it works (and why the obvious ways fail)

VTracer's stacked mode gives each color region a path that also spans
everything *hidden beneath later paths*. Consequences discovered the hard way:

1. **Bounding-box clustering fails** -- every bbox overlaps every other; the
   whole scene collapses into one cluster.
2. **Color clustering fails** -- nearly all 1062 fills are unique.
3. **Naive regrouping corrupts the render** -- reordering under stacked paint
   order changed 9% of pixels in early attempts.

So the tool works from **visibility**:

1. Rasterize every path in paint order (bezier-flattened polygon fill,
   even-odd across subpaths) -> a label image of *which path is on top* at
   each pixel.
2. Background = canvas-scale washes. Solid visible pixels form landmass
   components; water/cloud pixels form their own components and act as
   separators between landmasses. `--regions` colors override this step.
   Big components are subdivided by color category into subgroups.
3. Build a **visibility constraint graph**: every path painted beneath a
   visible pixel of path `t` must stay before `t`. Preserving these
   constraints provably preserves the topmost path at every pixel -- i.e.
   the render.
4. **Topologically schedule** paths to make each group as contiguous as the
   constraints allow; true interleavings become `__p2` parts.
5. **Verify**: re-simulate the emitted order and diff label images. The run
   prints `pixel diff vs original: 0 px (0.0000%)` -- if it ever doesn't,
   trust that number over everything else and inspect
   `<stem>_reorder_diff.png`.

## Debugging

**Is group X actually the thing I think it is?**
```powershell
cd debug
python slice_group.py <grouped.svg> main_island               # alone on white
python slice_group.py <grouped.svg> castle --mode tint        # red in place
python slice_group.py <grouped.svg> obj_02 --mode remove      # scene without it
node render_diff.cjs <sliced.svg>                             # rasterize to PNG
```
Matching is substring against class/id, so `road` finds all parts of
`obj_01_main_island__road_05`; parent groups are captured whole (balanced-tag
scan, nested subgroups included).

**Does the grouped SVG really render the same?** (independent of the tool's
own verifier -- uses librsvg, a real renderer)
```powershell
node render_diff.cjs original.svg grouped.svg
```
Expected: ~0.08% of pixels differing by >8/255, max delta ~50, all thin edge
slivers (antialiasing over reordered *hidden* geometry). Large patches = real
breakage; raise `--supersample` and check the grouper's own verify pass.

**Common issues**

| symptom | cause / fix |
|---|---|
| `ModuleNotFoundError: numpy` | wrong Python -- use the anaconda path above |
| two islands merged into one group | no water/cloud gap between them -- they physically touch (top-left band on the reference). Paint a `--regions` map (SAM or by hand) to split them |
| castle walls not in the castle group | cream walls share the sand/terrain color family with the road; only roofs+flags auto-detect. Use the castle bbox as an anchor, or a `--regions` map |
| a subgroup contains stray far-away specks | nearest-neighbor fold of tiny fragments; lower `--min-sub-paths` |
| one object split into many groups | raise `--gap`; or it straddles color categories |
| run is slow | `--supersample 1` halves resolution; `--no-verify` skips a pass |
| `require is not defined in ES module scope` | keep the `.cjs` extension (repo root package.json is `"type": "module"`) |
| FastSAM downloads on first run | `FastSAM-s.pt` (23 MB) lands in the working directory; already present in `debug/` |

## Known limitations

- Path data support: `M/L/C/Z` (what VTracer emits). `H/V/A/Q` would need
  `flatten_path` extended.
- Separation follows *visible* gaps: landmasses that physically touch stay
  one group (use `--regions`). Same-color touching objects (castle walls vs
  sandy road) can't be split by color -- `--regions` again.
- Group *parts* (`__p2`) are unavoidable where depth genuinely interleaves;
  the main island needs ~50 parts on the reference. Selection by `class`
  makes this transparent.
- Category HSV thresholds are tuned for this muted watercolor palette; other
  palettes may want `color_category()` adjusted. The royal-blue vs cyan-water
  split is at hue 208.
