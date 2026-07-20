# Upside-down content transition

This folder owns the deterministic choreography for replacing the content in
front of the camera with the next authored content set. It does not create
worlds, listen for input, or mutate Three.js objects directly.

## Choreography

The standard 3.36-second sequence has a slow, sunset-like pace:

1. `preparing` (180 ms) stages the incoming content and locks navigation.
2. `flipping` (2.6 s) rolls the shared scene root 180 degrees around its Z
   axis. The outgoing world clears the horizon and the incoming world starts
   rotating into view when the pivot reaches exactly 90 degrees.
3. `revealing` (360 ms) completes the incoming fade.
4. `settling` (220 ms) holds the finished composition before input unlocks.
5. `idle` commits the incoming content as current and resets temporary
   transition transforms.

The incoming group should receive `incomingContentRotationRadians` while both
content groups are under the rotating root. Its -180-degree counter-rotation
makes it upright when the shared root finishes its +180-degree roll.

## Integration

```ts
import { createUpsideDownTransitionController } from "./transitions/upside-down";

const transition = createUpsideDownTransitionController({
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
});

function requestNextContent(nowMs: number) {
  if (!transition.begin(nowMs)) return; // input is already owned by a transition
  stageNextFrontContent();
}

function animate(nowMs: number) {
  const frame = transition.update(nowMs);
  transitionRoot.rotation.z = frame.rotationRadians;
  incomingRoot.rotation.z = frame.incomingContentRotationRadians;
  setOpacity(outgoingRoot, frame.outgoingOpacity);
  setOpacity(incomingRoot, frame.incomingOpacity);
  outgoingRoot.visible = frame.shouldRenderOutgoing;
  incomingRoot.visible = frame.shouldRenderIncoming;

  if (frame.completedThisFrame) {
    disposeOutgoingSlice(); // same one-frame pulse as shouldDisposeOutgoing
    commitStagedContentAndResetRoots();
  }
  requestAnimationFrame(animate);
}
```

Use the same monotonic clock—normally the timestamp supplied by
`requestAnimationFrame`—for `begin` and `update`. The sampler derives every
frame from elapsed absolute time, so dropped frames do not alter duration or
end state. `begin` returns `false` while active, which is the input-lock
boundary for pointer, keyboard, and programmatic navigation.

`motionBlurIntensity` follows angular velocity, reaching its maximum around the
90-degree horizon and returning to zero at rest. `incomingRevealStarted` is
angle-derived, so missed frames cannot make the incoming world appear early.

`completedThisFrame` and `shouldDisposeOutgoing` are true together for one
controller update. That is the ownership boundary for removing and disposing
the passed slice. The pure sampler instead leaves `outgoingCanBeDisposed` true
after completion.

`setReducedMotion` immediately commits an active transition when the preference
changes. Reduced motion uses only a 140 ms crossfade: it never rotates,
counter-rotates, desynchronizes layers, or adds blur. Keep both content groups visible to assistive
technology according to the app's existing visibility policy; these render
flags are visual hints, not ARIA state.

For isolated tests or story controls, use `sampleUpsideDownTransition(elapsedMs,
options)` without constructing a controller.

## Integration checks

- Only the current and staged front-content groups exist during a transition.
- No second navigation request is accepted while `inputLocked` is true.
- The outgoing content is gone before the incoming content appears.
- Incoming content is upright after commit and temporary rotations reset.
- The outgoing slice is disposed only on the one-frame completion pulse.
- Reduced-motion mode performs no spatial movement.
- Transition results are identical at the same elapsed timestamp, regardless
  of frame rate.
