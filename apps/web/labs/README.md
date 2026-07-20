# Isolated world labs

The maintained quality targets, LOD tiers, promotion checklist, motion tokens,
and dated decisions live in [`../../../WORLD_LABS_LOD.md`](../../../WORLD_LABS_LOD.md).

Each HTML entry owns one question and one TypeScript controller. No lab imports
`WorldExperience.tsx`, so behavior can be approved before it changes the main
world loop.

| Issue | HTML entry | Lab controller | Production seam under test |
| --- | --- | --- | --- |
| A. Reusable base + purpose meshes | `platform-art.html` | `src/labs/platformArtLab.ts` | `src/world/assets/basePlatformMaterials.ts` + `content/forward/` decorations |
| B. Exact mirror world + camera orbit | `rotation-rig.html` | `src/labs/rotationRigLab.ts` | `src/world/WorldExperience.tsx` world-root ownership |
| C. Travel is continuous | `travel-rig.html` | `src/labs/travelRigLab.ts` | `src/world/animation/island-transition/islandTransition.ts` |
| D. Left/right reveal different background sectors | `background-pan.html` | `src/labs/backgroundPanLab.ts` | `src/world/background/layers/LayeredParallaxBackground.tsx` |
| E. Floaters, clouds, and ornate islands orbit independently | `floater-sprites.html` | `src/labs/floaterSpritesLab.ts` | `public/lab-assets/{floaters,clouds,platform-hires}/` + production parallax layer |
| F. Camera stands on the platform | `platform-view.html` | `src/labs/platformViewLab.ts` | `src/world/WorldExperience.tsx` camera/navigation rig |
| G. Art becomes silhouette geometry | `depth-mesh.html` | `src/labs/depthMeshLab.ts` | `public/lab-assets/platform-hires/` + future production mesh importer |
| H. Platform detail is independently authored | `platform-detail.html` | `src/labs/platformDetailLab.ts` | `content/forward/decorations.ts` + `signage.ts` |
| I. Sprites align by view, depth, color, and alpha | `sprite-grid.html` | `src/labs/spriteGridLab.ts` | `LayeredParallaxBackground.tsx` orbital sprite configuration |
| J. Procedural SVG background without gameplay meshes | `background-only.html` | `src/labs/backgroundOnlyLab.tsx` + `tools/svg/catalog.json` | Curated SVG groups, weighted seeded recycling, optional cloud obstruction, and zero WebGL canvases |

Shared lab-only code lives in `src/labs/lab.css`, `threeLab.ts`, and
`labWorldObjects.ts`. The neutral gameplay base is shared through
`src/world/assets/basePlatformMaterials.ts`; ornate HD islands belong to the
background sprite system. Promote only the demonstrated API or transform rule
into the named production seam.
