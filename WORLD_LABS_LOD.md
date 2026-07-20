# 2.5D world labs and level-of-detail contract

This is the living reference for visual quality and motion in the Control AI
world. Update it whenever a lab changes, an asset is promoted, or the base page
adopts a new acceptance threshold.

The target is a camera-authored 2.5D world: the camera stays locked, forward
travel moves the world under the player, left/right choices expose another
background sector, and an upside-down 180° roll reveals the next world. We only
author what is visible from the front or directly below the player.

## Quality bar

The primary platform-art reference is
`finished/ChatGPT Image Jul 20, 2026, 10_23_53 AM.png`. It defines the required
line density, painted stone variation, botanical detail, edge treatment, and
silhouette quality. Procedural geometry is support/collision unless it reaches
that bar; it is not the final visible art by itself.

The floater reference is
`finished/ChatGPT Image Jul 20, 2026, 12_31_34 PM (3).png`. Each object must be
an independent asset with its own depth, scale, drift, and camera response.

## Lab map and promotion status

| Issue | Lab URL | Isolated controller | Acceptance bar | Base-world seam | Status |
| --- | --- | --- | --- | --- | --- |
| A. Platform art | `/labs/platform-art.html` | `src/labs/platformArtLab.ts` | Exact 10_23_53 atlas art; transparent edges; at least three transformable depth cards; optional support mesh | `src/world/assets/platformDetailCards.ts` and `content/forward/createForwardWorld.ts` | Promoted |
| B. Rotation reveal | `/labs/rotation-rig.html` | `src/labs/rotationRigLab.ts` | One spatial root; outgoing crossfade; incoming art fades, scales, and counter-rotates; final world upright | `WorldExperience.tsx` and `transitions/upside-down/upsideDownTransition.ts` | Promoted |
| C. Fast travel | `/labs/travel-rig.html` | `src/labs/travelRigLab.ts` | Default move no longer than 1.00 s; blur no greater than 0.90 px; camera locked; passed islands retire after crossing camera | `animation/island-transition/islandTransition.ts` and `WorldExperience.tsx` | Promoted |
| D. Living panorama | `/labs/background-pan.html` | `src/labs/backgroundPanLab.ts` | Left/right selects a persistent new sector; depth plates move by different amounts; no exposed backdrop seam | `background/layers/LayeredParallaxBackground.tsx` | Promoted |
| E. Floater sprites | `/labs/floater-sprites.html` | `src/labs/floaterSpritesLab.ts` | Six visible thumbnails; direct selection and drag; individual depth/scale/yaw response; load state is explicit | `public/lab-assets/floaters/manifest.json` and `LayeredParallaxBackground.tsx` | Promoted |
| F. Player stance | `/labs/platform-view.html` | `src/labs/platformViewLab.ts` | Tall eye line; camera just inside near rim; destination platform anchors below the fixed camera for every radius | `WorldExperience.tsx` and `world/data/paths.json` | Promoted |

## Level-of-detail tiers

| Tier | Camera relationship | Visible platform treatment | Prop treatment | Motion treatment |
| --- | --- | --- | --- | --- |
| Near | Current platform / roughly 0–8 m | Full painted island silhouette plus separate foreground cards; support mesh available for ground and selection | Individual flowers, tree, lantern, sign, or flag cards; local Z separation and subtle parallax | Full physical root rotation; crisp travel with ≤0.90 px blur |
| Mid | Next one or two destinations / roughly 8–28 m | One complete painted island card; simplified support mesh | One or two silhouette props; no tiny repeated geometry | Reduced parallax and drift; shadow use limited |
| Far | Backdrop / beyond roughly 28 m | Baked distant-island plate or one low-cost sprite | No micro-props; independent floaters only when silhouette matters | Slow ambient bob; largest depth lag; lowest contrast |

Distance is a composition guide, not a free-camera contract. Judge every tier
from the authored front and below views.

## Art asset contract

- Never overwrite a source image in `finished/`.
- Record every reusable cutout in a manifest with source, role, and public path.
- Prefer deterministic crops from a clean atlas over regenerating a close copy.
- Remove only connected background pixels so pale highlights, waterfall foam,
  and paper-colored details survive.
- A platform's painted card owns its visible silhouette. The Three.js mesh owns
  interaction, ground continuity, optional shadow support, and fallback.
- Detail cards use `THREE.PlaneGeometry` under the platform/world root—not
  `THREE.Sprite`—so they physically rotate with the world.
- Keep full-island cards, surface props, and floaters separate. Do not merge
  them back into a single panorama after extraction.

Current manifests:

- `apps/web/public/lab-assets/platform-details/manifest.json`
- `apps/web/public/lab-assets/floaters/manifest.json`

## Motion tokens

| Motion | Current token | Reason |
| --- | --- | --- |
| Forward travel | 170 ms accelerate + 350 ms cruise + 250 ms decelerate + 70 ms settle | 840 ms total at default tuning; fast but spatially continuous |
| Travel blur | 0.90 px maximum, 0.30 intensity ceiling | Preserves painted line work while retaining a speed cue |
| World roll | 180° about the shared Z pivot | Reads as an upside-down world change instead of a camera yaw |
| Incoming art | Starts at the 90° horizon, then fades from 0→1 while scale resolves 0.78→1 and Y counter-rotation resolves to 0 | Makes the new world arrive physically instead of teleporting |
| Background sector | Three persistent positions: left, center, right | Route choice reveals another portion of the same living world |
| Floater drift | Independent bounded alternate animations | Prevents cumulative drift and preserves camera parallax ownership |

Reduced motion replaces spatial travel/rotation with the existing short
crossfade/state transition and removes ambient floater animation.

## Camera contract

- Desktop rest pose: position `[0, 2.75, 4.72]`, look-at `[0, 0.72, -9.5]`.
- Portrait rest pose: position `[0, 3.15, 4.9]`, look-at `[0, 0.72, -8.5]`.
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

- [ ] Main platform visually reaches the 10_23_53 AM painted-detail bar.
- [ ] No source-atlas paper rectangles or neighboring-sprite slivers are visible.
- [ ] Every incoming platform and decoration follows the 180° world root.
- [ ] Incoming artwork visibly fades and rotates in; it never pops at completion.
- [ ] Default travel completes in one second or less with legible detail.
- [ ] The outgoing island retires only after it clears the camera.
- [ ] Left/right input moves backdrop layers to a distinct persistent sector.
- [ ] All six floaters load, are independently positioned, and move by depth.
- [ ] Camera remains inside the current platform rim at every destination.
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
