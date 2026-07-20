# Fantasy background

Scope: the non-interactive depth layers behind the authored front scene: a
pastel sky dome, distant floating silhouettes, mist, balloons, and motes.

Public entry point: `index.ts`.

## Authored image backwall

`LayeredParallaxBackground` is a DOM backwall assembled from the separated
Jul 20 artwork in `public/world-background/`. The sky is opaque; the other
white-backed source plates use an isolated multiply blend so they remain
independently movable without white rectangles or destructive source edits.
All layers are non-interactive and stay at `z-index: 0`; mount the transparent
Three canvas above them.

```tsx
const parallaxRef = useRef<LayeredParallaxBackgroundHandle>(null);

<LayeredParallaxBackground ref={parallaxRef} />

// Normalized pointer coordinates (-1..1).
parallaxRef.current?.setPointer(pointerX, pointerY);

// Both methods turn full 0..1 progress into a 0 -> 1 -> 0 depth pulse.
parallaxRef.current?.setTravel(travelProgress, depthLag);
parallaxRef.current?.setTurn(snapshot.overallProgress, direction);
```

The component observes `prefers-reduced-motion` itself. A parent that already
owns that preference can pass `reducedMotion` or call `setReducedMotion()`.
`reset()` returns every layer to its authored rest pose after a transition.

The five WebP files total less than 650 KB and preserve the shared 1672x941
coordinate system. `object-fit: cover`, an overscan gutter, and a portrait
crop keep transforms edge-safe at responsive sizes.

Dependencies: Three.js plus the local `materials/`, `shaders/`, and
`postprocessing/` public contracts. It does not own a renderer, event listener,
or animation frame.

Demo: add `createFantasyBackground({ tier }).group` to the scene. From the one
scene clock call `background.update(elapsedSeconds)`. Pass `0` as motion
intensity for reduced motion. Call `setOpacity()` during a crossfade and
`dispose()` on route or scene replacement.

Acceptance checklist:

- Elements stay lower contrast and behind interactive platforms.
- Balloon and mote movement is always `base + wave(elapsedTime)` and never
  accumulates drift.
- Density scales with the shared quality tier; `off` creates an empty group.
- Random placement is deterministic for a given seed.
- Disposal is idempotent and releases every owned geometry and material.

Performance notes: distant islands and spires are instanced. The high tier uses
110 points, seven balloons, and three mist planes; medium uses 64/five/two; low
uses 28/three/one. Distant balloon cords are intentionally implied rather than
modeled as separate draw calls. The expected
background cost is under 25 draw calls at high and under 12 at low, before
platform content. Confirm those budgets with `renderer.info.render` after scene
integration because frustum and shadow settings affect the observed total.

Skill used: `.agents/skills/threejs.md`.
