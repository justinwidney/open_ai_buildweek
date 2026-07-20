# Forward content

Contains only the authored, camera-facing scene used by the current experience.
No backside geometry or free-orbit content belongs here.

`signage.ts` creates procedural parchment signs, the foundation inscription,
and route numbers. The text remains app-owned and readable instead of baking a
full reference screenshot into the world.

## Acceptance

- Content is readable from the production camera.
- Every selectable visual assigns `userData.platform`.
- Canvas textures are owned by their slice and disposed with it.
- The next slice is created only while a transition is being prepared.

Primary skill: `.agents/skills/threejs.md`.
