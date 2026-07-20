# World and object spin

This folder owns absolute-time rotation math. `sampleWorldSpin` handles ambient
milestone rotation. `sampleSunsetWorldTurn` is the shared, slow 180° rotation
profile used by the upside-down world transition.

The sunset turn defaults to 2.6 seconds and uses a sine ease, giving the scene a
long visual pause near both horizons. Its incoming reveal is angle-driven and
begins at exactly 90°. The snapshot also exposes angular velocity and a 0–1
motion-blur intensity. Reduced motion produces the final logical state with no
rotation, counter-rotation, or blur.

Both samplers are deterministic: pass elapsed absolute time from the scene's
single animation frame loop. Neither sampler mutates Three.js objects.

```ts
const turn = sampleSunsetWorldTurn(nowMs - startedAtMs, { direction: -1 });
worldPivot.rotation.z = turn.rotationRadians;
incoming.rotation.z = turn.incomingCounterRotationRadians;
transitionBlur.intensity = turn.motionBlurIntensity;
```

Primary skills: `.agents/skills/animation-system.md` and
`.agents/skills/threejs.md`.
