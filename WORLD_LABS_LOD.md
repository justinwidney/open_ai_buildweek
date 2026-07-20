# 2.5D world labs and level-of-detail contract

This is the living reference for visual quality and motion in the Control AI
world. Update it whenever a lab changes, an asset is promoted, or the base page
adopts a new acceptance threshold.

The target is a camera-authored 2.5D world: the camera stays locked, forward
travel moves the world under the player, left/right choices expose another
background sector, and an upside-down 180° roll reveals the next world. We only
author what is visible from the front or directly below the player.

## Quality bar

The playable-platform references are
`finished/ChatGPT Image Jul 20, 2026, 03_18_38 PM (1).png` and `(2).png`.
Together they define one short cylindrical masonry base, its circular top, and
its wall treatment. Every playable island reuses this base; its purpose comes
from optional physical meshes such as a tree, lantern, sign, flower patch, or
milestone placed on the walkable surface.

The detailed `10_23_53 AM`-directed tree, waterfall, and castle islands are
scenery sprites only. They belong in the nearer orbital background and never
replace the reusable gameplay platform.

The floater reference is
`finished/ChatGPT Image Jul 20, 2026, 12_31_34 PM (3).png`. Each object must be
an independent asset with its own depth, scale, drift, and camera response.

Cloud silhouettes come from
`finished/ChatGPT Image Jul 20, 2026, 02_39_01 PM.png`; the clean backwall comes
from `finished/ChatGPT Image Jul 20, 2026, 02_39_16 PM.png`. A cloud is accepted
only when its connected alpha shape is isolated before the final transparent
trim—rectangular crops are never sprite boundaries.

## Lab map and promotion status

| Issue | Lab URL | Isolated controller | Acceptance bar | Base-world seam | Status |
| --- | --- | --- | --- | --- | --- |
| A. Base + purpose meshes | `/labs/platform-art.html` | `src/labs/platformArtLab.ts` | One approved short masonry cylinder; authored top/wall textures; optional physical mesh groups for foundation, learning, milestone, and quiet-path purposes | `src/world/assets/basePlatformMaterials.ts` and `content/forward/createForwardWorld.ts` | Promoted |
| B. Mirror rotation | `/labs/rotation-rig.html` | `src/labs/rotationRigLab.ts` | Primary world plus exact deep clone at 180°; camera orbit rig owns the turn; every platform, prop, and atmosphere plane follows; crossfade only at the split | `WorldExperience.tsx` and `transitions/upside-down/upsideDownTransition.ts` | Lab verified; production topology pending |
| C. Fast travel | `/labs/travel-rig.html` | `src/labs/travelRigLab.ts` | Default move no longer than 1.00 s; blur no greater than 0.90 px; camera locked; passed islands retire after crossing camera | `animation/island-transition/islandTransition.ts` and `WorldExperience.tsx` | Promoted |
| D. Living panorama | `/labs/background-pan.html` | `src/labs/backgroundPanLab.ts` | Every backwall, plate, near island, floater, and vignette has an independent visibility checkbox; left/right retains depth-linked sectors | `background/layers/LayeredParallaxBackground.tsx` | Lab controls ready; production layers promoted |
| E. Orbital scenery | `/labs/floater-sprites.html` | `src/labs/floaterSpritesLab.ts` | Six floaters, twelve shape-isolated clouds, and three ornate background islands; polar X/Z placement; gradual damped yaw; visible vertical idle bob | `public/lab-assets/{floaters,clouds,platform-hires}/` and `LayeredParallaxBackground.tsx` | Promoted |
| F. Player stance | `/labs/platform-view.html` | `src/labs/platformViewLab.ts` | Tall eye line; camera just inside near rim; destination platform anchors below the fixed camera for every radius | `WorldExperience.tsx` and `world/data/paths.json` | Promoted |
| G. Outline + depth mesh | `/labs/depth-mesh.html` | `src/labs/depthMeshLab.ts` | Alpha-clipped BufferGeometry; luminance depth displacement; recomputed normals; marching-squares outline; SVG outline export | `public/lab-assets/platform-hires/` and future production mesh importer | Isolated lab ready |
| H. Additive detail forge | `/labs/platform-detail.html` | `src/labs/platformDetailLab.ts` | Every platform detail can be independently enabled, placed, scaled, rotated, and judged with texture removed | `content/forward/decorations.ts`, `signage.ts`, and `WorldTuning.detailsEnabled` | Lab ready; main controls promoted |
| I. Sprite depth grid | `/labs/sprite-grid.html` | `src/labs/spriteGridLab.ts` | Reference and Sobel-edge overlays; left/center/right views; per-sprite depth, offset, scale, opacity, saturation, and warmth output | `LayeredParallaxBackground.tsx` calibration props | Lab ready; global calibration promoted |
| J. Background-only match | `/labs/background-only.html` | `src/labs/backgroundOnlyLab.tsx` | Collapsible controls; backwall + repeated distant plate + six route-safe clouds; protected straight/±45° corridors; zero WebGL canvases | `WorldTuning.platformsEnabled` and DOM parallax layer | Infinite-horizon lab ready; main toggle promoted |

## Level-of-detail tiers

| Tier | Camera relationship | Visible platform treatment | Prop treatment | Motion treatment |
| --- | --- | --- | --- | --- |
| Near | Current platform / roughly 0–8 m | Approved textured masonry cylinder with real collision and walkable top | Purpose-specific Three.js meshes only; no full-island foreground card | Full physical root rotation; crisp travel with ≤0.90 px blur |
| Mid | Next one or two destinations / roughly 8–28 m | Same masonry base at reduced geometry quality | One or two purpose-defining meshes; no tiny repeated geometry | Reduced shadow cost and idle detail |
| Far | Backdrop / beyond roughly 28 m | Ornate tree, waterfall, or castle island as a transparent orbital sprite | No gameplay mesh or collision | Slow vertical idle bob; largest depth lag; lowest contrast |

Distance is a composition guide, not a free-camera contract. Judge every tier
from the authored front and below views.

## Art asset contract

- Never overwrite a source image in `finished/`.
- Record every reusable cutout in a manifest with source, role, and public path.
- Prefer deterministic crops from a clean atlas over regenerating a close copy.
- Remove only connected background pixels so pale highlights, waterfall foam,
  and paper-colored details survive.
- The approved masonry Three.js mesh owns the gameplay platform silhouette,
  interaction, ground continuity, and shadows.
- Purpose decorations are independent physical mesh groups above the common
  base; never bake them into a different platform image.
- Ornate full-island art is background-only and follows the same orbital X/Z
  projection as clouds and floaters.

Current manifests:

- `apps/web/public/lab-assets/platform-details/manifest.json`
- `apps/web/public/lab-assets/platform-hires/manifest.json`
- `apps/web/public/lab-assets/floaters/manifest.json`
- `apps/web/public/lab-assets/clouds/manifest.json`
- `apps/web/public/platform-base/manifest.json`

## Motion tokens

| Motion | Current token | Reason |
| --- | --- | --- |
| Forward travel | 170 ms accelerate + 350 ms cruise + 250 ms decelerate + 70 ms settle | 840 ms total at default tuning; fast but spatially continuous |
| Travel blur | 0.90 px maximum, 0.30 intensity ceiling | Preserves painted line work while retaining a speed cue |
| Mirror-world lab orbit | Camera rig rotates 180° about Z between a fixed primary world and its exact 180° clone | Keeps every spatial child in one physical hierarchy and makes either turn end upright |
| Mirror split | Primary→mirror crossfade from 62° to 118°; no visibility pop, translation, or scale reveal | Artwork is already present in the second world and becomes readable as the camera crosses the horizon |
| Background sector | Three persistent positions: left, center, right | Route choice reveals another portion of the same living world |
| Orbital yaw | `theta = baseAngle - currentYaw`; `x = sin(theta) × radius`; `z = cos(theta) × radius`; damping 2.6 s⁻¹ | Produces a visibly gradual pivot instead of a fast positional catch-up |
| Idle bob | Floaters and islands move roughly ±8 px vertically; clouds roughly ±4 px | Keeps the scene alive at rest without replacing the central-pivot motion |

Reduced motion replaces spatial travel/rotation with the existing short
crossfade/state transition and removes ambient floater animation.

## Camera contract

- Desktop rest pose: position `[0, 5.2, 4.55]`, look-at `[0, 0.22, -8.9]`, FOV `48°`.
- Portrait rest pose: position `[0, 5.55, 4.65]`, look-at `[0, 0.18, -8.1]`, FOV `54°`.
- The current platform center is placed behind the camera by an inset derived
  from its radius. The camera therefore stays just inside small and large rims.
- Do not move the camera to the next platform. Move and rotate the world root.
- Do not add orbit controls to production. Use lab-only front/below switches.

## Promotion workflow

1. Change one issue in its standalone HTML lab.
2. Test its acceptance bar without relying on another lab.
3. Name the exact production seam and reduced-motion behavior.
4. Promote only the demonstrated rule or asset API into the base page.
5. Run `npm run test:world` and `npm run build`.
6. Update the status table, tokens, asset manifest, and dated log below.

## Review checklist

- [ ] Every playable stop uses the approved 03_18_38 masonry base.
- [ ] Platform purpose changes only the optional meshes above the base.
- [ ] No source-atlas paper rectangles or neighboring-sprite slivers are visible.
- [ ] Every incoming platform, prop, floater, and atmosphere plane follows the 180° mirror hierarchy.
- [ ] Incoming artwork is present in the exact mirrored world and crossfades through the split; it never pops at completion.
- [ ] Default travel completes in one second or less with legible detail.
- [ ] The outgoing island retires only after it clears the camera.
- [ ] Left/right input moves backdrop layers to a distinct persistent sector.
- [ ] All six floaters, twelve clouds, and three ornate islands load and move in X/Z around the shared pivot.
- [ ] Every floater and ornate island has a visible vertical idle animation.
- [ ] Lab and production UI always stack above scenery sprites.
- [ ] Cloud and platform outputs contain no neighboring connected component.
- [ ] The depth-mesh lab can inspect topology and download a usable SVG outline.
- [ ] Camera remains inside the current platform rim at every destination.
- [ ] High-view height and pitch remain adjustable without enabling free camera orbit.
- [ ] Texture-off mode preserves platform silhouette, hit targets, bridges, and navigation.
- [ ] Sprite alignment lab exports a stable placement record for each left/center/right view.
- [ ] Background-only lab renders no Three.js mesh or WebGL canvas.
- [ ] Reduced-motion, portrait, and low-quality modes preserve navigation.

## Change log

### 2026-07-20 — Lab promotion pass 3

- Replaced the Lab 01 procedural-quality target with exact 10_23_53 AM atlas
  cutouts and a reusable 2.5D platform card stack.
- Reduced default forward travel to 840 ms and capped blur at 0.90 px.
- Added incoming-world opacity, scale, vertical settle, and Y counter-rotation.
- Raised the camera and moved its default stance just inside the near rim.
- Rebuilt the floater lab around a visible thumbnail tray and explicit load state.
- Promoted independent floaters and persistent directional sectors into the
  base parallax background.
- Promoted painted platform stacks into the base world while retaining the
  procedural mesh as spatial support.

### 2026-07-20 — Shape, orbit, and mirror pass 4

- Re-extracted twelve cloud sprites with connected-component masks; bounding
  boxes are now used only after shape isolation for transparent trimming.
- Separated the clean sunrise artwork into `sunrise-backwall-v2.webp` and added
  every cloud as an independently animated production sprite.
- Replaced instantaneous floater offsets with a shared polar X/Z orbit and
  frame-rate-independent yaw damping in both the workbench and base background.
- Rebuilt the rotation lab around a fixed primary world, an exact 180° clone,
  and a camera orbit rig; the full mirrored hierarchy exists before the fade.
- Added the Alpha Outline Depth Mesh lab with luminance displacement,
  recomputed normals, marching-squares contours, and SVG outline export.
- Generated and shape-isolated three higher-resolution platform cards, enabled
  linear mipmapped filtering, and promoted them into the shared platform API.

### 2026-07-20 — Base-platform and composition pass 5

- Extracted the new 03_18_38 geometry reference and top, wall, and ground-strip
  materials by connected component, with no neighboring atlas pieces retained.
- Replaced foreground full-island cards with one short textured masonry
  cylinder and purpose-specific Three.js decoration groups.
- Moved the ornate tree, waterfall, and castle islands into the nearer orbital
  background-sprite layer.
- Added independent visibility checkboxes for every Living Panorama element.
- Slowed orbital damping from 8.5 to 2.6 s⁻¹, restored an explicit vertical idle
  bob, and raised all application and lab UI above dynamic scenery.

### 2026-07-20 — 2.5D matching workbenches pass 6

- Raised and pitched the production camera so platform tops read as an authored
  2.5D composition, with live height and tilt controls rather than free orbit.
- Promoted texture, purpose-detail, gameplay-geometry, placement-grid, and
  sprite color/alpha controls into the main World Effects Lab.
- Added the Platform Detail Forge for independently placing every physical prop.
- Added a 12×8 sprite depth grid with local reference-edge extraction and
  left/center/right calibration records.
- Added a DOM-only background reconstruction lab with reference wipe and
  difference comparison; the page intentionally creates zero gameplay meshes.

### 2026-07-20 — Route-safe infinite background pass 7

- Collapsed the Background-Only Match controls to a single left-edge button by
  default so the art fills the review viewport.
- Reduced the default composition to the sunrise backwall, distant island
  plate, and six upper-edge clouds; balloons, airships, ornate island sprites,
  foreground cards, and low corridor-blocking clouds remain excluded.
- Added straight, 45° left, and 45° right route guides with a shared vanishing
  point and deterministic sector selection.
- Repeated the distant plate across six progressively scaled, horizontally
  tiled atmospheric ridges so the horizon reads as continuous depth instead of
  one terminal back plane.

### 2026-07-20 — Continuous inward background pass 8

- Turned the Background-Only Match into an always-running forward depth field:
  backwall, vanishing mist, base island plate, and six atmospheric ridges now
  grow toward the camera together.
- Added five independent distant-island plates and twelve staggered cloud slots
  that grow above the horizon, fade near the camera, and regenerate at depth;
  cloud slots select the next of six approved cutouts on every cycle.
- Kept every growing cloud in the outer margins so the straight, 45° left, and
  45° right platform corridors remain free of balloons, airships, or sprites.
- Added pause and forward-speed controls; the explicit lab toggle owns motion
  so browser-level reduced-motion settings cannot silently freeze the test.
