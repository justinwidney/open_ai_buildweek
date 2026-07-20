# Fantasy shaders

Scope: centralized, lightweight shader helpers for the atmospheric sky, drifting
mist, and the midpoint scene reveal. They are optional and respect quality
tiers; no helper owns a renderer or clock.

Public entry point: `index.ts`.

Dependencies: Three.js, `materials/palette.ts`, and the shared quality type.

Demo: use `createSkyGradientMaterial()` on an inward-facing sky sphere. Call
`createMistMaterial().update(elapsedSeconds)` from the scene's one animation
loop. Install `installDissolveReveal(material)` on a PBR material and drive its
normalized progress from the transition controller.

Acceptance checklist:

- Sky and mist remain behind interactive content and do not write depth.
- Mist is absolute-time based and cannot drift.
- Reveal progress clamps to `[0, 1]` and does not create a render loop.
- Shader hooks restore the original material hook on disposal.
- Medium and low tiers remove noise octaves rather than losing content.

Skill used: `.agents/skills/threejs.md`.
