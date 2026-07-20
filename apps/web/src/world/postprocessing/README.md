# Postprocessing and quality

Scope: the shared `high | medium | low | off` cost contract and inexpensive
scene grading. This folder deliberately does not create a second render loop or
an effect composer.

Public entry point: `index.ts`.

Dependencies: Three.js only. `background/`, `materials/`, and `shaders/` consume
the quality contract.

Demo: choose a tier with `qualityForDevice()`, call
`configureRendererForQuality(renderer, tier)`, then optionally apply
`applyFantasySceneGrade(scene, tier)`. Call the returned restore function during
scene cleanup.

Acceptance checklist:

- Pixel ratio and shadows scale down predictably.
- `off` adds no atmospheric or texture work.
- Grading is reversible and does not own rendering.
- Reduced motion selects a complete, inexpensive visual state.

Skill used: `.agents/skills/threejs.md`.
