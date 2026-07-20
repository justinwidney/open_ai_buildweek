# Control AI World MVP

A pnpm TypeScript workspace with a responsive React interface and a data-driven
Three.js skill world inspired by the supplied July 20 reference image.

## Run

```sh
pnpm install
pnpm dev:web
```

Open the local Vite URL. Select a platform to send the route marker across the
shared path/bridge curve while the camera-locked world advances underneath it.
Use `↑`, `W`, or Space to travel to the next front island. Swipe horizontally
or use `←` / `→` to roll the world 180° while the next camera-facing scene
enters at the 90° horizon.

## World Effects Lab

Press `L`, choose the lightbulb tool, or open `#lab/backdrop` to launch the
in-world tuning surface. Its focused pages are linkable at `#lab/backdrop`,
`#lab/travel`, `#lab/turn`, and `#lab/rocks`. The controls A/B the imported
watercolor layers, replay forward travel and world turns, and switch between
soft, storybook, and shattered rock silhouettes.

For isolated work, open `/labs/index.html`. It links ten independent HTML
experiments for platform art, physical scene rotation, continuous travel,
directional panorama extension, orbital floater/cloud sprites, on-platform
camera stance, alpha-outline depth meshes, additive platform detail, sprite
alignment, and a zero-mesh background match.
Use [`WORLD_LABS_LOD.md`](WORLD_LABS_LOD.md) as the living acceptance contract
and update log for those labs and their promotion into the base world.

## Workspace

- `apps/web` — responsive UI shell, Three.js scene, static path JSON, and asset mapping.
- `packages/shared` — cross-platform contracts intended for a future engine package.
- `tools/pixel` — existing optional pixel-sprite import/compile utilities.

The static level definition lives at `apps/web/src/world/data/paths.json`; use
the reference crop manifest under `apps/web/src/assets/reference/` to turn the
supplied image into reusable source assets without modifying the original.
