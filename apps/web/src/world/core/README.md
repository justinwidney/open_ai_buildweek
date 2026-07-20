# World core

Owns renderer configuration, quality detection, and resource cleanup. Scene
features import this folder through `index.ts`; they do not create additional
render loops or renderers.

## Acceptance

- Device pixel ratio and shadows respond to the selected quality tier.
- ACES tone mapping and sRGB output are configured once.
- Owned geometries, materials, and textures are disposed without duplicate work.
- No feature folder registers a second animation frame loop.

Primary skill: `.agents/skills/threejs.md`.
