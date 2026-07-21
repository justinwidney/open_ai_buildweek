# Pre-journey landscape generation brief

Generate a new onboarding background from these style/composition references:

1. `tools/svg/generated/reference_06_03_continuous_road.png`
2. `finished/v2/ChatGPT Image Jul 20, 2026, 06_03_43 PM.png`
3. `tools/svg_ui/route_tile_library/normalized/08_near_exits_both.png`

## Production prompt

```text
Use case: stylized-concept
Asset type: wide game onboarding environment background
Input images: Image 1 is the primary visual-style and castle/path-world
reference; Image 2 is the secondary watercolor texture and branching-route
reference; Image 3 establishes the canonical crop and normalized route visual
language.

Primary request: create an earlier location in the same fantasy journey,
before the player has stepped onto any formal route. The viewer stands at the
back edge of a peaceful highland forest clearing, looking outward toward
several possible paths and floating-island routes in the distance. The
immediate foreground is an unmarked natural clearing with moss, wildflowers,
stones, roots, low ferns, and framing pine trees; no path begins directly under
the viewer. Farther ahead, three to five distinct pale trails become visible
between forested floating landforms and bridges, representing possible lives
not yet chosen. All distant routes ultimately draw the eye toward one small
luminous blue-roofed castle on the far horizon.

Scene/backdrop: airy floating-island world above turquoise cloud-filled water,
layered forest depth, waterfalls, mist, large soft clouds, distant castle.

Style/medium: polished hand-painted watercolor and gouache fantasy game
environment, matching the references' cream paths, blue sky/water, mossy olive
greens, gray stone cliffs, delicate flowers, soft paper texture, and clean
readable shapes.

Composition/framing: wide 16:9 establishing view; grounded low-to-mid viewpoint
from within the forest rather than already above a road; foreground trees and
foliage frame the sides; quiet left-middle tonal area usable behind translucent
onboarding UI; multiple paths become legible mainly in the middle distance;
castle small but unmistakable near the upper-center horizon. Keep the castle
and central trailhead within the center third so the mobile crop retains them.

Lighting/mood: gentle hopeful dawn, soft gold light through mist, calm
anticipation, open possibility, no danger.

Constraints: preserve the visual language but create a new scene; no numbered
platforms; no signboards; no character; no active chosen road in the immediate
foreground; no UI; no text; no symbols; no logos; no watermark; no frame; no
photorealism; no dark ominous mood.

Avoid: a single dominant foreground road, a crossroads directly under the
camera, busy foreground details behind the UI-safe space, giant castle,
top-down map view, duplicated buildings, modern objects.
```

## Output contract

- Final path: `apps/web/public/onboarding/pre-journey-landscape.png`
- Final dimensions: `1200 × 694`, matching the normalized route library.
- Castle center: approximately `x=.50`, `y=.12–.18`.
- UI-safe region: approximately `x=.04–.38`, `y=.18–.68`.
- Forest framing: outer 18% and lower 22–28% of the image.
- Do not imply that a route has already been selected.

Two built-in reference-image generation attempts on 2026-07-21 failed at the
same network request. Do not silently switch to the CLI/API path: it requires a
locally configured `OPENAI_API_KEY` and explicit user approval. The onboarding
CSS retains the existing background until this asset exists and is visually
approved.
