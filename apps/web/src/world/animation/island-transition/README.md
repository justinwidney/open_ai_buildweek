# Forward island transition

This folder owns deterministic camera-forward travel between island slices. It
does not create, attach, remove, or dispose Three.js objects.

The standard 2.28-second sequence has a continuous trapezoidal velocity curve:
520 ms acceleration, 900 ms cruise, 680 ms deceleration, then a 180 ms settle.
Snapshots expose the integrated `worldOffsetProgress`, `forwardDistance`,
velocity, `blurPx`, and `motionBlurIntensity` for the render loop.

Near and background layers intentionally lag behind the main world during the
fast portion of travel, then catch up to exactly 1 at the destination. Use
`nearLayerProgress` and `backgroundLayerProgress` to interpolate authored start
and end transforms. `nearDepthLag` and `backgroundDepthLag` expose the current
normalized separation for diagnostics or a tuning page. The outgoing island
leads the main motion through `outgoingWorldProgress`, ensuring it is behind the
camera before the completion pulse.

```ts
const travel = createIslandTransitionController({ travelDistance: 28 });
travel.begin(performance.now());

function animate(nowMs: number) {
  const frame = travel.update(nowMs);
  camera.position.z = startZ - frame.forwardDistance;
  outgoing.position.z = lerp(outgoingStartZ, outgoingDiscardZ, frame.outgoingWorldProgress);
  incoming.position.z = lerp(incomingStartZ, incomingRestZ, frame.incomingWorldProgress);
  background.position.z = lerp(backgroundStartZ, backgroundEndZ, frame.backgroundLayerProgress);
  setTransitionBlur(frame.blurPx, frame.motionBlurIntensity);

  if (frame.shouldDisposeOutgoing) outgoingSlice.dispose();
}
```

`completedThisFrame` and `shouldDisposeOutgoing` are one-update pulses. Dispose
or pool the passed island on that update, promote the incoming island, and reset
temporary offsets. `outgoingCanBeDisposed` is the stateless equivalent returned
by `sampleIslandTransition` after the full sequence.

Reduced motion performs only a 140 ms crossfade. It reports no forward distance,
depth lag, velocity, or blur. `setReducedMotion` commits an active transition so
input cannot become trapped.

Primary skills: `.agents/skills/animation-system.md` and
`.agents/skills/threejs.md`.
