# Pixel toolchain

Compiles hand-authored `.pxl` tile/sprite files into a typed TypeScript
module the game imports, plus a labeled preview image for visual review.
Source of truth lives at `packages/ui/src/sprites/pixel/*.pxl`.

## Commands

```
npm run sprites:build
```

Runs `tools/pixel/compile.mjs`, which:

1. Reads every `packages/ui/src/sprites/pixel/*.pxl` file and parses/
   validates it (see format below).
2. Writes `packages/ui/src/sprites/pixel/generated.ts` — a typed
   `pixelSprites: Record<string, PixelSprite>` map, where
   `PixelSprite = { size: number; palette: string[]; data: number[]; parts:
   Record<string, number[]> }` (`data` is row-major palette indices, `-1` =
   transparent; `parts` maps each declared part name to the row-major pixel
   indices that belong to it, and is `{}` for sprites with no `parts:`
   section). Also writes `pixelFrames: Record<string, string[]>`, mapping
   each animated base sprite name to its ordered frame sprite names (index 0
   = the base sprite itself). Bases with no hand-authored extra frames are
   absent from `pixelFrames`. This file is **generated** — do not hand-edit
   it, it is overwritten on every build.
3. Renders `tools/pixel/preview.png`: every sprite laid out in a labeled
   grid at 8x nearest-neighbor scale on a neutral checker background (so
   transparency is visible), plus `tools/pixel/preview.json` describing the
   grid layout (columns, per-sprite pixel rect) for tooling. Any sprite that
   declares one or more `parts:` gets a **second cell** immediately after
   its normal cell, labeled `<name>:parts` — a "parts debug" render where
   every pixel belonging to a declared part is tinted a distinct saturated
   overlay color (cycled per part, red/cyan/yellow/violet/green/orange/pink)
   and every pixel *not* in any part is dimmed, so you can visually confirm
   a part's mask covers exactly the pixels you intended. `preview.json`'s
   `sprites` entries carry `label` (the text under the cell, e.g.
   `grass_0:parts`) and `debug: true/false` so tooling can tell the two
   cells for a sprite apart; `name` is always the underlying sprite name.

The compiler has exactly one dependency: `pngjs` (pure JS PNG encoder), kept
as a root devDependency.

## Importing a reference image

Use `sprites:import` to turn a PNG crop into a normal `.pxl` sprite. The
importer box-samples the crop, reduces it to a deterministic median-cut
palette, preserves transparent pixels, and writes directly into the sprite
source directory by default:

```sh
npm run sprites:import -- \
  --input "finished/ChatGPT Image Jul 10, 2026, 06_05_56 PM.png" \
  --name reference_mountain \
  --crop 520,230,300,210 \
  --size 32 \
  --colors 18
npm run sprites:build
```

The imported sprite then appears in `generated.ts` and the normal
`tools/pixel/preview.png` sheet. Use `--nearest` when you want hard source
pixels instead of box-averaged downsampling, `--out` for a one-off destination,
or `--alpha-threshold` to control transparent source pixels. For a full scene,
crop individual reusable elements (mountains, houses, flowers, rocks, UI
icons) rather than importing the entire screenshot as one sprite.

## Extracting an AI/reference sprite sheet

`sprites:extract` is the non-destructive first step for a labeled reference
sheet. It reads a versioned JSON crop manifest and writes separate lossless
PNGs under `assets/pixel-source/`; the original sheet remains untouched.

```
npm run sprites:extract -- --manifest tools/pixel/atlases/jul-13-2026.json
```

Edit crop coordinates in the manifest, then rerun the command. Entries may set
`removeBorder` to flood-remove only the edge-connected presentation background
for object art. Do not use it on full terrain tiles. Convert a reviewed crop
to a `.pxl` only after its framing and palette look right; this keeps the
editable PNG and the runtime source cleanly separated.

## The `.pxl` format

```
# name: grass_0
# size: 16
palette:
b #6E9C49
l #8FBC5E
d #567F3A
pixels:
bbbbbbbbbbbbbbbb
bbbllbbbbbbbbbbb
...(16 rows of 16 chars total)...
```

- Lines starting with `#` are comments, except `# name: <name>` and
  `# size: <n>` which are required headers (parsed anywhere before
  `pixels:`).
- `palette:` introduces palette lines: `<char> #RRGGBB`, one per line. Each
  char must be a single visible, non-`_` character; duplicates are a build
  error.
- `_` is reserved and always means transparent — it must not be declared in
  the palette.
- `pixels:` introduces exactly `size` rows of exactly `size` characters
  each. Every character must either be `_` or a declared palette char;
  anything else is a build error with the file, and where possible the row/
  column, called out.
- Sprite `name`s must be unique across all `.pxl` files in the directory.

Validation errors are fail-fast with a file path (and line number, where the
error is line-local) so a bad edit is easy to locate.

### `parts:` (optional)

Placed after `palette:` and before `pixels:`:

```
parts:
blades l L d D s S t T
windows i
```

Each line is `<partName> <char> [char ...]` — every pixel drawn with one of
the listed chars belongs to that part. A sprite can declare any number of
parts; a char can belong to more than one part if it appears on multiple
lines. Every char referenced must already be declared in `palette:` (`_` is
rejected — transparent pixels can't belong to a part). The compiler resolves
this at build time into `parts: Record<string, number[]>` (row-major pixel
indices) in `generated.ts`.

Parts are how a sprite exposes the sub-regions an animator can move
independently — grass declares `blades` (the sway-able detail clusters,
not the base fill), a packet declares `body` (the whole packet) and `glint`
(its 1-2 highlight pixels), a building declares `lights` (blink candidates)
or `windows`/`door`/`beacon` (accent regions). Any sprite that will animate
at runtime via a part-transform MUST declare the part(s) it needs moved.
Sprites with no `parts:` section compile fine — `parts` is just `{}`.

### Animation frames (optional, file-naming based)

A `.pxl` file named `<base>.f1.pxl`, `<base>.f2.pxl`, etc. is an extra
hand-authored animation frame of the sprite defined in `<base>.pxl`. Rules:

- `<base>.pxl` must exist and is always frame 0 (the base sprite itself).
- Frame files must be the same `size` as the base (mismatches are a build
  error).
- Frame indices must be contiguous starting at 1 (`.f1`, `.f2`, ... — a gap
  like `.f1` + `.f3` with no `.f2` is a build error).
- Frame files' own `# name:` can be anything (by convention, `<base>_f1`
  etc.) — grouping is based on the **file name**, not the sprite name.

The compiler emits `pixelFrames: Record<string, string[]>` in
`generated.ts`, keyed by the base sprite name, valued with the ordered list
of frame sprite names (index 0 = base). Bases with no extra frame files
don't appear in `pixelFrames` at all.

Per the pixel-artist style rules, prefer runtime part-transforms (shifting/
remapping a declared part per frame, e.g. grass `blades` swaying ±1px) over
hand-authored frames — reach for `.f1.pxl`/`.f2.pxl` only when a transform
genuinely can't express the motion.

## How `generated.ts` is consumed

`packages/ui/src/sprites/pixel/fromPixel.ts` exports `fromPixelSprite(name)`,
which looks the sprite up in `pixelSprites`, and blits its indexed pixel
data into a fresh `SPRITE_PX x SPRITE_PX` canvas (`imageSmoothingEnabled =
false`, integer nearest-neighbor scale = `SPRITE_PX / size`). The regular
sprite cache in `packages/ui/src/sprites/index.ts` calls this the same way
it calls the procedural `draw*` functions, and caches the result by a key
that includes the variant name — so pixel sprites are just another sprite
source to the rest of the renderer.

See `packages/ui/src/sprites/pixel/README.md` for the grass palette, the
layering technique, and how terrain variant selection works.

## Editing loop

1. Edit or add a `.pxl` file under `packages/ui/src/sprites/pixel/`.
2. `npm run sprites:build`.
3. Open `tools/pixel/preview.png` and look at it — check contrast,
   readability at a glance, accidental symmetry/streaks, and tile seams
   (mentally tile the sprite against itself). For any sprite with parts,
   also check its `<name>:parts` debug cell right next to it — confirm each
   tinted region matches the part you intended (no stray pixels, no missing
   ones). `preview.json` gives the exact pixel rect of each sprite/debug
   cell in the grid if you want to script a crop/diff.
4. Iterate until it looks right, then `npm run typecheck -w packages/ui` if
   you touched any integration code (variant lists, `fromPixel.ts`, etc).
