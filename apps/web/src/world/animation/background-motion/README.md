# Background motion

This folder provides deterministic ambient motion for balloons, clouds,
particles, foliage groups, and other decorative scene elements. Its core rule
is that positions are sampled from an authored rest pose and an absolute clock;
they are never incremented each frame. This prevents the unbounded vertical
drift produced by patterns such as `object.position.y += Math.sin(time) * n`.

## Integration

Create one sampler per animated object so validation and default resolution
happen outside the render loop:

```ts
import {
  applyBackgroundMotion,
  createBackgroundMotionSampler
} from "./animation/background-motion";

const sampleBalloon = createBackgroundMotionSampler({
  anchor: { x: 4, y: 7, z: -18 },
  periodMs: 8_000,
  seed: 42,
  positionAmplitude: { x: 0.18, y: 0.45, z: 0.08 },
  rotationAmplitudeRadians: { x: 0.02, y: 0.08, z: 0.03 },
  scaleAmplitude: 0.015
});

function animate(nowMs: number) {
  const sample = sampleBalloon(nowMs, { reducedMotion });
  applyBackgroundMotion(balloon, sample);
  requestAnimationFrame(animate);
}
```

`seed` produces a stable phase and does not call `Math.random`. To coordinate
several objects precisely, pass `phaseRadians` instead. The three axes use
fixed phase offsets so an object follows a small organic loop instead of moving
all axes in lockstep.

Pass `{ reducedMotion: true }` to return the exact anchor, base rotation, and
base scale. `intensity` can smoothly reduce scene-wide ambient movement and is
clamped to `0..1`.

The helpers use structural target types and therefore work directly with a
Three.js `Object3D` without importing Three.js into this utility. If a consumer
owns custom transforms, use `sampleBackgroundMotion` or the sampler result and
apply the numbers itself.

## Performance and quality checks

- Create samplers during object setup, not inside `requestAnimationFrame`.
- Use the render loop timestamp for every object to keep the scene synchronized.
- Keep amplitudes subtle; ambient motion must support the transition rather
  than compete with it.
- Avoid animated large-area blur and shadows on background objects.
- Verify that sampling the same timestamp twice produces the same transform.
- Verify that long-running and negative timestamps stay bounded around the
  authored anchor.
