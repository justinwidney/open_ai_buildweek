# svg_grouper — project status (2026-07-20)

Where the tool stands, what problem is being worked on right now, and what is
left. Companion to README.md (which documents *how to use* what exists).

## Done and verified

| capability | tool | verification |
|---|---|---|
| Group flat VTracer SVG into semantic `<g>` hierarchy, pixel-identical render | `group_svg_objects.py` | 0/833k px diff (own simulator), 0.08% AA slivers (librsvg) |
| Auto-identify: main island chain, floating islands, road, castle roofs+flags, clouds, waterfalls, water | same | red-tint / slice renders: `castle_tint.png`, `main_island.png`, `road_red.png` |
| External segmentation override (SAM or hand-painted PNG) | `--regions` + `debug/sam_regions.py` (FastSAM) | 130 SAM regions round-tripped at 0 px diff |
| Cut scene into 26 standalone chunk assets (platform + grass + trees + rocks + cliff depth + road segment + waterfalls) | `export_chunks.py` | all chunks render; `chunks.json` manifest |
| Recombine chunks into NEW scenes, road ports snapped, jitter for variety | `debug/compose_chain.py` | `combo1.png`, `combo2.png` |
| Verify any group slice / any two renders | `debug/slice_group.py`, `debug/render_diff.cjs` | in use throughout |

## Current problem being iterated

**Chunk edge quality for recombination.** Chunks cut where real water/sky
surrounds the land have perfect silhouettes (`natural_edge` 1.00 in
chunks.json — all islands). Chunks cut through the landmass interior show
straight box edges against the sky when placed standalone (worst:
`chunk_20_platform` at 0.35; castle at 0.65 has two straight rect sides).
They look correct only when a neighbor chunk covers the cut.

Mitigations available today: keep low-score chunks as middle pieces in a
chain; compose so cut edges face a neighbor; regenerate with finer
`--min-dist` so cuts land on narrower waists.

## Left to do (in rough priority order)

1. **Organic cut edges** — instead of straight watershed/rect cuts, route the
   cut along low-detail pixels (cost-based seam, like seam carving) and/or
   add a torn-paper / rock-face edge treatment so interior chunks read as
   complete islands on their own.
2. **Castle walls** — cream walls share the sand color family with the road,
   so the castle chunk relies on a grown bbox; a SAM box-prompt around the
   castle (sam_regions.py already supports full-SAM checkpoints) would give a
   pixel-true castle mask, including walls and the gate.
3. **Bottom-edge road port** — the road exiting through the canvas bottom
   edge is not detected as a port (the widening road flare fails the
   tall-aspect road filter), so chains currently end at the last mid-scene
   port. Fix: treat canvas-edge sand crossings as ports regardless of aspect.
4. **Mirroring / scaling in compose_chain.py** — only translation is
   supported; flips would double the variety of layouts from the same chunks
   (needs port coordinates re-mapped under the flip).
5. **Split the top-left island band** — it physically touches the main chain
   (no water gap), so it stays in the main landmass; a hand-painted or SAM
   `--regions` map is the intended path, not yet wired into `export_chunks.py`
   (it currently only feeds `group_svg_objects.py`).
6. **Memory headroom** — this machine had <1.5 GB free virtual memory during
   runs; export_chunks defaults to `--supersample 1` and cropped masks as a
   result. If runs die with `ArrayMemoryError`, close apps or lower
   `--supersample`.

## Environment notes (this machine)

- Run Python tools with `C:\Users\winde\anaconda3\python.exe` (plain
  `python` is a bare 3.12 without numpy/PIL).
- Node renderer (`sharp`) is installed in `debug/`; scripts are `.cjs`
  because the repo root package.json declares `"type": "module"`.
- `ultralytics` (FastSAM) is installed in the anaconda env; weights cached at
  `debug/FastSAM-s.pt`.
