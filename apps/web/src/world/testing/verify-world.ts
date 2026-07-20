import assert from "node:assert/strict";
import * as THREE from "three";
import { createBackgroundMotionSampler } from "../animation/background-motion";
import {
  createIslandTransitionController,
  sampleIslandTransition,
} from "../animation/island-transition";
import { sampleSunsetWorldTurn, sampleWorldSpin } from "../animation/world-spin";
import { createLayeredPlatform, createRopeBridge } from "../geometry";
import {
  createUpsideDownTransitionController,
  sampleUpsideDownTransition,
} from "../transitions/upside-down";

function verifyTransition() {
  const start = sampleUpsideDownTransition(0);
  const midpoint = sampleUpsideDownTransition(500);
  const horizon = sampleUpsideDownTransition(1_480);
  const complete = sampleUpsideDownTransition(4_000);
  assert.equal(start.phase, "preparing");
  assert(midpoint.rotationRadians > 0 && midpoint.rotationRadians < Math.PI);
  assert(Math.abs(horizon.rotationRadians - Math.PI / 2) < 1e-10);
  assert.equal(horizon.incomingRevealStarted, true, "incoming world begins at the 90-degree horizon");
  assert.equal(complete.complete, true);
  assert.equal(complete.outgoingCanBeDisposed, true);

  const controller = createUpsideDownTransitionController();
  assert.equal(controller.begin(1_000), true);
  assert.equal(controller.begin(1_001), false, "overlapping input must be rejected");
  const committed = controller.update(5_000);
  assert.equal(committed.completedThisFrame, true);
  assert.equal(committed.shouldDisposeOutgoing, true);
  assert.equal(committed.completedTransitions, 1);
  assert.equal(controller.update(5_001).completedThisFrame, false);

  const reduced = sampleUpsideDownTransition(60, { reducedMotion: true });
  assert.equal(reduced.rotationRadians, 0);
  assert(reduced.incomingOpacity > 0);

  const sunset = sampleSunsetWorldTurn(1_300);
  assert(Math.abs(sunset.rotationRadians - Math.PI / 2) < 1e-10);
  assert.equal(sunset.incomingRevealStarted, true);
  assert(sunset.motionBlurIntensity > .99);
  assert.deepEqual(sunset, sampleSunsetWorldTurn(1_300), "world turn sampling must be deterministic");
}

function verifyIslandTravel() {
  const accelerating = sampleIslandTransition(260);
  const cruising = sampleIslandTransition(700);
  const decelerating = sampleIslandTransition(1_700);
  const complete = sampleIslandTransition(2_500);

  assert.equal(accelerating.phase, "accelerating");
  assert.equal(cruising.phase, "cruising");
  assert.equal(decelerating.phase, "decelerating");
  assert(accelerating.normalizedVelocity < cruising.normalizedVelocity);
  assert(decelerating.normalizedVelocity < cruising.normalizedVelocity);
  assert(cruising.blurPx > 0 && cruising.motionBlurIntensity > 0);
  assert(cruising.backgroundDepthLag > cruising.nearDepthLag);
  assert(cruising.outgoingWorldProgress > cruising.worldOffsetProgress);
  assert.deepEqual(cruising, sampleIslandTransition(700), "travel sampling must be deterministic");
  assert.equal(complete.complete, true);
  assert.equal(complete.outgoingCanBeDisposed, true);

  const reduced = sampleIslandTransition(60, { reducedMotion: true });
  assert.equal(reduced.worldOffsetProgress, 0);
  assert.equal(reduced.forwardDistance, 0);
  assert.equal(reduced.blurPx, 0);
  assert.equal(reduced.backgroundDepthLag, 0);

  const controller = createIslandTransitionController();
  assert.equal(controller.begin(100), true);
  assert.equal(controller.begin(101), false);
  const committed = controller.update(2_500);
  assert.equal(committed.completedThisFrame, true);
  assert.equal(committed.shouldDisposeOutgoing, true);
  assert.equal(controller.update(2_501).shouldDisposeOutgoing, false);
}

function verifyBackgroundMotion() {
  const sample = createBackgroundMotionSampler({
    anchor: { x: 4, y: 7, z: -12 },
    periodMs: 4_000,
    seed: 42,
    positionAmplitude: { x: .4, y: .8, z: .2 },
    rotationAmplitudeRadians: { z: .08 },
  });
  assert.deepEqual(sample(1_500), sample(1_500), "absolute sampling must be deterministic");
  assert.deepEqual(sample(1_500, { reducedMotion: true }).position, { x: 4, y: 7, z: -12 });
  for (const timestamp of [0, 1_000, 2_000, 20_000_000]) {
    const result = sample(timestamp);
    assert(Math.abs(result.position.y - 7) <= .8 + Number.EPSILON, "motion must stay bounded");
  }
  assert.equal(sampleWorldSpin(10, { phaseRadians: .3, reducedMotion: true }), .3);
  assert(sampleWorldSpin(10, { speedRadiansPerSecond: .4 }) > 3.9);
}

function verifyGeometry() {
  const materials = {
    stone: new THREE.MeshBasicMaterial(),
    stoneDark: new THREE.MeshBasicMaterial(),
    rim: new THREE.MeshBasicMaterial(),
    top: new THREE.MeshBasicMaterial(),
    detail: new THREE.MeshBasicMaterial(),
  };
  const platform = createLayeredPlatform({
    id: "verification",
    radius: 3,
    materials,
    sockets: [{ id: "forward", angle: 0 }],
    shadows: false,
  });
  assert(platform.group.children.length >= 7, "platform must be layered rather than one primitive");
  assert(platform.sockets.has("forward"));

  const bridgeMaterials = {
    deck: new THREE.MeshBasicMaterial(),
    rope: new THREE.MeshBasicMaterial(),
  };
  const start = new THREE.Vector3(0, 0, 0);
  const end = new THREE.Vector3(0, 1, -8);
  const bridge = createRopeBridge({ id: "verification", start, end, materials: bridgeMaterials, shadows: false });
  assert(bridge.group.children.length >= 6, "bridge must include deck, ropes, and posts");
  assert(bridge.travelCurve.getPointAt(0).distanceTo(start) < 1e-6);
  assert(bridge.travelCurve.getPointAt(1).distanceTo(end) < 1e-6);

  platform.dispose();
  bridge.dispose();
  Object.values(materials).forEach((material) => material.dispose());
  Object.values(bridgeMaterials).forEach((material) => material.dispose());
}

verifyTransition();
verifyIslandTravel();
verifyBackgroundMotion();
verifyGeometry();
console.log("world verification: transitions, background motion, platforms, and bridges passed");
