# Fantasy materials

Scope: a cohesive, low-overhead material family for stone undersides, foliage
tops, gold trim, bridges, parchment signs, and atmospheric forms. Textures are
procedurally drawn at runtime; the reference image is never used as a texture.

Public entry point: `index.ts`.

Dependencies: Three.js and `postprocessing/` for the quality tier. The kit owns
all textures and materials it returns.

Demo: call `createFantasyMaterialKit({ tier, maxAnisotropy })`, assign the named
materials to geometry, then call `kit.dispose()` when the scene slice is
removed. The `off` tier uses color-only fallback materials.

Acceptance checklist:

- Stone, foliage, gold, bridge, and parchment read as one palette.
- Procedural output is deterministic for a given seed.
- Low and off tiers reduce texture memory.
- Manifest records source, license, settings, and ownership.
- Disposal is idempotent and releases every owned texture and material.

Texture-memory ceiling before mipmaps is approximately 4 MiB at high (four
512² RGBA canvases), 1 MiB at medium, 256 KiB at low, and zero at off. Callers
should clamp anisotropy to renderer capability as shown by
`renderer.capabilities.getMaxAnisotropy()`.

Skill used: `.agents/skills/threejs.md`.
