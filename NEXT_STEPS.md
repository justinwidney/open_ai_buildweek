# Next steps — finished-quality transformation

This focused visual and motion transformation is now implemented. The images in
`finished/` remain the quality bar. The completed phase deliberately avoids
expanding the world in every direction or building a general world generator.

## Implementation status — complete

- The app renders one camera-facing world slice at rest and preloads only the
  incoming slice during a transition.
- The former Y-axis turnaround has been replaced by a deterministic Z-axis
  upside-down roll with midpoint content reveal, counter-rotation, input lock,
  disposal, and a reduced-motion crossfade.
- Layered platform and modular rope-bridge factories are integrated. Bridges
  expose the same curves used by the animated platform traveler.
- Procedural stone, foliage, trim, parchment, and bridge textures; shader-driven
  sky/mist; quality tiers; transition blur; distant scenery; balloons; motes;
  and absolute-time ambient motion are active.
- Platform travel, milestone spinning, and background motion use the shared
  render loop and stop or settle under reduced motion.
- Every planned source folder has an implementation and a local `README.md`
  naming its scope, acceptance rules, and Three.js/animation skill ownership.
- `npm run test:world`, web typecheck, and the production build pass. Browser
  review covered the flip completion, desktop composition, narrow layout bounds,
  and console output.

## Product direction for this phase

- Author and render only the content in front of the camera. Do not spend time
  on rear-facing scenery, free orbit, or unseen routes.
- Replace the current 180° horizontal turn with an upside-down flip. The first
  implementation should roll a dedicated world pivot 180° around the
  camera-forward axis, not yaw the world around its Y axis.
- Keep the interface layer stationary while the 3D world flips. The incoming
  scene is staged in front, begins to appear around the midpoint of the flip,
  and resolves upright at the end.
- Treat complex-looking platforms and bridges as reusable systems assembled
  from a small number of authored profiles, modular details, and materials—not
  as a unique high-poly mesh for every path.
- Work in isolated quality folders. A focused agent can own one folder, use the
  relevant project skill, and deliver a reviewable experiment without editing
  every part of `WorldExperience.tsx`.

## Target source structure

```text
apps/web/src/world/
  core/                    scene, camera, renderer, clock, resources, cleanup
  content/forward/         the one authored camera-facing scene
  transitions/upside-down flip state machine, midpoint reveal, input lock
  geometry/platforms/      reusable platform profiles and detail sockets
  geometry/bridges/        bridge centerlines, segments, rails, supports
  materials/               PBR presets, texture manifest, loading and fallback
  shaders/                 reveal, atmosphere, wind, shared uniforms/chunks
  postprocessing/          quality tiers, blur/DOF, grade, restrained bloom
  animation/platform-travel/
  animation/world-spin/
  animation/background-motion/
  background/              sky, mist, distant forms, balloons and particles
  testing/                 deterministic, visual, performance and a11y checks
```

Each folder starts with a short `README.md` containing its scope, public entry
point, dependencies, demo instructions, acceptance checklist, and the skill(s)
used. Experimental code stays behind that folder's entry point until it passes
review. Shared contracts are agreed first; agents should not independently
rewrite the current monolithic scene component.

## Shared contracts to establish first

Extract the stable shell from `WorldExperience.tsx` before parallel visual work:

- `WorldSlice`: owns one front-facing scene group and its resources.
- `TransitionController`: exposes transition state and normalized progress.
- `AssetManifest`: records texture/model source, license, settings, and owner.
- `AnimationSystem`: updates registered animations from absolute elapsed time.
- `QualityTier`: `high | medium | low | off` for shaders and postprocessing.

Use one resource registry for geometries, materials, textures, and render targets.
Removing a scene slice must either return shared resources to a pool or dispose
resources it owns. Reconcile the duplicated types in `packages/shared` and
`apps/web/src/world/world.types.ts` before extracting a larger engine; a general
engine package is intentionally deferred.

## Quality tracks

### 1. Forward content and upside-down reveal

Folder: `content/forward/` and `transitions/upside-down/`  
Skills: `.agents/skills/threejs.md` + `.agents/skills/animation-system.md`

- Keep only the current front slice visible and selectable at rest.
- On input, preload exactly one incoming front slice and lock repeated input.
- Use explicit states: `idle → preparing → flipping → revealing → settling`.
- Drive the flip from elapsed time and an easing curve, never a frame-dependent
  interpolation constant.
- Begin the incoming reveal near 90°. It may combine opacity, scale, dissolve,
  fog, or depth blur, but the geometry must not pop into existence.
- Counter-rotate or stage the incoming slice so it is upright and interactive
  after the world pivot completes its 180° roll.
- Dispose or pool the outgoing slice after settling.
- Reduced motion uses a short crossfade or an immediate state swap; content
  remains available and input never becomes trapped.

Acceptance: no rear content is authored; the scene visibly turns upside down
rather than turning around; the transition cannot overlap itself; the incoming
scene appears during the turn and is stable at the end.

### 2. Complex platforms

Folder: `geometry/platforms/`  
Skill: `.agents/skills/threejs.md`

- Build a parameter-driven platform factory from layered silhouettes: underside,
  rim/trim, walkable top, inset detail, and optional vegetation sockets.
- Use a local origin and predictable up axis so every platform can be placed,
  scaled, animated, and raycast consistently.
- Separate the visual mesh from the simple interaction/collider mesh.
- Reuse cached geometries and materials. Use instancing for repeated flowers,
  stones, posts, and other small details.
- Prefer shape language, bevels, trim sheets, normals, and controlled repetition
  over raw polygon count.
- Define near/mid/far detail behavior and shadow rules. Distant platforms should
  not carry invisible high-detail geometry.
- Include a debug mode for origins, bounds, sockets, and interaction surfaces.

### 3. Complex bridges

Folder: `geometry/bridges/`  
Skill: `.agents/skills/threejs.md`

- Represent each bridge with a `THREE.Curve3` centerline shared by its visible
  deck and platform-travel animation.
- Snap endpoints to named platform sockets; validate width, slope, clearance,
  and overlap at both ends.
- Assemble the bridge from reusable deck segments, edge trim, rails/ropes,
  supports, and a small detail kit. Repetition plus controlled variation should
  provide richness without a bespoke mega-mesh.
- Instance repeated segments where practical and keep a simple hidden selection
  or collision volume.
- Share materials with the platform system and test silhouettes from the real
  camera, not only from a free debug camera.

Acceptance for platforms and bridges: they hold up in desktop and mobile
screenshots, remain readable through the flip, have no visible endpoint gaps,
and stay within the agreed triangle, draw-call, texture-memory, and shadow
budgets.

### 4. Textures and materials

Folder: `materials/` and `assets/textures/`  
Skill: `.agents/skills/threejs.md`

- Import reviewed, reusable textures rather than baking the reference image onto
  scene geometry. Preserve original sources and record source/license metadata.
- Use a manifest for color space, wrap/repeat, anisotropy, mipmaps, compression,
  dimensions, and disposal ownership.
- Establish a small material family for stone/underside, foliage/top, painted
  trim, bridge surface, parchment, and atmospheric elements.
- Use texture atlases or trim sheets for repeated structure details. Provide a
  lightweight fallback material while assets load or on low quality.
- Audit the existing crop pipeline before using it; its output path is not yet
  wired to `apps/web`.

### 5. Shaders, quality, and blur

Folder: `shaders/` and `postprocessing/`  
Skill: `.agents/skills/threejs.md`

- Start with transition reveal/dissolve, atmospheric depth, and subtle wind or
  surface variation. Keep shared uniforms and GLSL chunks centralized.
- Add postprocessing only where it improves hierarchy: restrained color grade,
  vignette/bloom, and depth or transition blur. Do not soften the entire scene
  with global blur.
- Ship `high`, `medium`, `low`, and `off` tiers. Cap device pixel ratio and make
  expensive passes optional.
- Record GPU frame time, draw calls, triangles, texture memory, and render-target
  cost at desktop and mobile sizes before integration.

### 6. Movement between platforms

Folder: `animation/platform-travel/`  
Skills: `.agents/skills/animation-system.md` + `.agents/skills/threejs.md`

- Animate a selected focus/character/camera rig along the bridge's shared curve.
- Use clear start, travel, arrival, and cancel states. Preserve spatial continuity
  and keep selection feedback synchronized with travel.
- Keep the camera comfortable: no abrupt look-at flips, unbounded acceleration,
  or competing background motion during the primary move.
- Provide a reduced-motion state change or short crossfade.

### 7. World and object spinning

Folder: `animation/world-spin/`  
Skills: `.agents/skills/animation-system.md` + `.agents/skills/threejs.md`

- Own the single hero flip timeline and any small decorative spins separately.
- Define motion tokens for duration, easing, stagger, and settle; keep one strong
  primary movement and subordinate supporting motion.
- Use quaternions or a dedicated pivot for the 180° roll, clamp progress, and
  make forward/reverse outcomes deterministic.
- Pause nonessential spins when hidden and remove them for reduced motion.

### 8. Background motion

Folder: `animation/background-motion/` and `background/`  
Skills: `.agents/skills/animation-system.md` + `.agents/skills/threejs.md`

- Coordinate sky, mist, balloons, particles, and parallax behind one API.
- Animate from `basePosition + amplitude × wave(elapsedTime)` so objects cannot
  drift. The current incremental balloon bobbing should be replaced.
- Give background elements slower timing and lower contrast than interactive
  platforms. Suspend updates when the tab is hidden or the scene is offscreen.
- Keep CSS and Three.js layers synchronized through the flip without rotating
  the fixed application UI.

## Parallel-agent working agreement

1. Assign one quality track and one primary folder per agent.
2. Tell the agent to read the listed skill file before proposing or editing.
3. Agree on the shared contracts above; changes to them require coordination.
4. Each agent supplies a focused demo, before/after capture, performance notes,
   cleanup behavior, and reduced-motion behavior.
5. Integrate through the folder's public entry point. Do not merge competing
   render loops, clocks, input handlers, or postprocessing pipelines.
6. Review at desktop, narrow mobile, low-quality, and reduced-motion settings.

## Recommended order

1. Extract `core/` and define the shared contracts and disposal ownership.
2. Build `content/forward/` plus the upside-down transition with temporary
   materials; this establishes the final interaction before visual polish.
3. Develop platform and bridge systems in parallel against fixed sockets and
   camera views.
4. Import textures and establish the material family.
5. Layer shaders and postprocessing behind quality tiers.
6. Add platform travel, decorative spinning, and background motion using the
   single animation clock.
7. Run visual, performance, lifecycle, input-lock, and reduced-motion checks;
   then integrate only the variants that improve the `finished/` comparison.

## Definition of done for this phase

- At rest, only one authored front scene is rendered and interactive.
- A 180° upside-down roll reveals the next front scene during the transition;
  it does not expose a developed backside or behave like the old Y-axis turn.
- Platforms and bridges look layered and authored while remaining modular,
  reusable, selectable, and budgeted.
- Textures, shaders, postprocessing, blur, travel, spin, and ambient motion can
  each be enabled or disabled through their folder boundary.
- Animation is time-based, cancellable, and drift-free; repeated input is safe.
- Reduced-motion and low-quality modes preserve the complete interaction.
- Scene replacement does not leak geometries, materials, textures, listeners,
  animation frames, or render targets.
- `pnpm typecheck` and `pnpm build` pass, and reviewed screenshots at desktop
  and mobile sizes move materially closer to the references in `finished/`.

## Explicitly deferred

- Rear-facing content, free-orbit exploration, and routes not visible from the
  authored camera.
- Infinite/deterministic world generation and a new `packages/engine`.
- Backend content, authentication, cloud saves, analytics, and collaboration.
- Broad product features that do not improve the current scene transformation.

## Current verification

Verified on July 20, 2026:

- `npm run test:world` passes transition, input-lock, reduced-motion,
  deterministic background-motion, platform, socket, bridge, and travel-curve
  checks.
- `pnpm --filter @control-ai/web typecheck` passes.
- `npm run build` passes. Vite still reports a non-blocking 786.51 kB chunk-size
  warning; lazy-loading the Three.js experience is an engineering follow-up, not
  a visual-quality blocker for this completed phase.
- The local app was rendered in the in-app browser at 1600 × 900 and 390 × 844.
  The narrow layout keeps the detail panel off-canvas until opened and preserves
  the bottom prompt bounds; its camera uses a wider portrait composition.
