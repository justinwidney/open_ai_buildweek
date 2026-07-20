import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createIslandTransitionController } from "./animation/island-transition";
import { createPlatformTraveler, type PlatformTraveler } from "./animation/platform-travel";
import {
  createFantasyBackground,
  LayeredParallaxBackground,
  type LayeredParallaxBackgroundHandle,
} from "./background";
import { createForwardWorldSlice, type ForwardWorldSlice } from "./content/forward";
import { createWorldRenderer, detectQualityTier } from "./core";
import pathData from "./data/paths.json";
import { applyFantasySceneGrade } from "./postprocessing";
import { createUpsideDownTransitionController } from "./transitions/upside-down";
import "./WorldExperience.css";
import type {
  Vec3,
  WorldCommand,
  WorldDefinition,
  WorldExperienceProps,
  WorldPlatform,
  WorldTuning,
} from "./world.types";

const definition = pathData as unknown as WorldDefinition;
const HALF_TURN = Math.PI;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const DEFAULT_TUNING: WorldTuning = {
  parallaxDepth: 1,
  travelDuration: 1,
  motionBlur: 1,
  turnDuration: 1,
  rockProfile: "storybook",
  backdropEnabled: true,
};

type PointerState = { x: number; y: number; moved: boolean };
type TravelState = {
  target: WorldPlatform;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  startRotationY: number;
  endRotationY: number;
  retiredBehind: boolean;
};

function vector(tuple: Vec3) {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function routeToPlatform(slice: ForwardWorldSlice, platformId: string) {
  const path = definition.paths.find((candidate) => candidate.platformIds.includes(platformId));
  if (!path) return [];
  const targetIndex = path.platformIds.indexOf(platformId);
  const curves: THREE.Curve<THREE.Vector3>[] = [];
  for (let index = 1; index <= targetIndex; index += 1) {
    const key = `${path.platformIds[index - 1]}:${path.platformIds[index]}`;
    const curve = slice.travelCurves.get(key);
    if (curve) curves.push(curve);
  }
  return curves;
}

function destinationFor(platform: WorldPlatform) {
  const target = vector(platform.position);
  const heading = platform.kind === "front" || platform.kind === "start"
    ? 0
    : Math.atan2(target.x, -target.z);
  const rotatedTarget = target.clone().applyAxisAngle(WORLD_UP, heading);
  return {
    position: rotatedTarget.multiplyScalar(-1),
    rotationY: heading,
  };
}

function addLighting(scene: THREE.Scene, quality: ReturnType<typeof detectQualityTier>) {
  scene.add(new THREE.HemisphereLight(0xffefd1, 0x274754, 2.1));
  const sun = new THREE.DirectionalLight(0xffd79a, 3.5);
  sun.name = "warm-key-light";
  sun.position.set(-10, 22, 9);
  sun.castShadow = quality !== "off" && quality !== "low";
  sun.shadow.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -.00025;
  scene.add(sun);

  const horizonGlow = new THREE.PointLight(0xffc681, 1.2, 60, 2);
  horizonGlow.position.set(0, 8, -30);
  scene.add(horizonGlow);
}

/**
 * One camera, one render loop, and one active front-facing world. Forward
 * progression moves the world beneath the locked camera; 180° turns stage only
 * the next front-facing slice and dispose the old one after the reveal.
 */
export function WorldExperience({
  className,
  command,
  onPlatformSelect,
  onWorldChange,
  tuning = DEFAULT_TUNING,
}: WorldExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<LayeredParallaxBackgroundHandle>(null);
  const commandHandlerRef = useRef<((nextCommand: WorldCommand) => void) | undefined>(undefined);
  const tuningRef = useRef<WorldTuning>({ ...DEFAULT_TUNING, ...tuning });
  tuningRef.current = { ...DEFAULT_TUNING, ...tuning };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;
    parallaxRef.current?.setReducedMotion(reducedMotion);
    const quality = detectQualityTier();
    const scene = new THREE.Scene();
    const restoreGrade = applyFantasySceneGrade(scene, quality, {
      fogColor: 0xa8bac8,
      fogDensity: quality === "high" ? .014 : .01,
      background: null,
    });
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 180);
    const desktopCameraPosition = vector(definition.startingCamera.position);
    const desktopLookAt = vector(definition.startingCamera.lookAt);
    camera.position.copy(desktopCameraPosition);
    camera.lookAt(desktopLookAt);
    const renderer = createWorldRenderer(quality);
    container.appendChild(renderer.domElement);
    addLighting(scene, quality);

    const background = createFantasyBackground({ tier: quality, seed: 20260720, radius: 82, skyDome: false });
    scene.add(background.group);
    const worldPivot = new THREE.Group();
    worldPivot.name = "upside-down-world-pivot";
    scene.add(worldPivot);

    let worldIndex = 0;
    let current = createForwardWorldSlice(definition, worldIndex, quality, tuningRef.current.rockProfile);
    let incoming: ForwardWorldSlice | undefined;
    let pendingWorldIndex = worldIndex;
    let transitionDirection: 1 | -1 = 1;
    let activePlatformId = "foundation";
    let activeTravel: TravelState | undefined;
    worldPivot.add(current.group);
    let traveler: PlatformTraveler = createPlatformTraveler();
    current.group.add(traveler.group);

    const turnScale = tuningRef.current.turnDuration;
    const transition = createUpsideDownTransitionController({
      reducedMotion,
      incomingRevealAngleRadians: Math.PI / 2,
      durations: {
        preparingMs: 180 * turnScale,
        flippingMs: 2_600 * turnScale,
        revealingMs: 360 * turnScale,
        settlingMs: 220 * turnScale,
      },
    });
    const travelScale = tuningRef.current.travelDuration;
    const islandTransition = createIslandTransitionController({
      reducedMotion,
      maxBlurPx: 7,
      durations: {
        accelerationMs: 520 * travelScale,
        cruiseMs: 900 * travelScale,
        decelerationMs: 680 * travelScale,
        settlingMs: 180 * travelScale,
      },
    });
    const raycaster = new THREE.Raycaster();
    const pointerPosition = new THREE.Vector2();
    const animationStartedAt = performance.now();
    let frameId = 0;
    let pointer: PointerState | undefined;
    let lastFrameTimestamp = performance.now();

    const inputLocked = () => transition.inputLocked || islandTransition.inputLocked;

    const resetTravelPresentation = () => {
      container.dataset.traveling = "false";
      container.dataset.travelPhase = "idle";
      container.style.setProperty("--world-travel-blur", "0px");
      container.style.setProperty("--world-travel-intensity", "0");
      parallaxRef.current?.setTravel(0, 0);
    };

    const finishTravel = () => {
      if (!activeTravel) return;
      current.group.position.copy(activeTravel.endPosition);
      current.group.rotation.y = activeTravel.endRotationY;
      if (!activeTravel.retiredBehind) current.retireBehind(activeTravel.target.id);
      activePlatformId = activeTravel.target.id;
      activeTravel = undefined;
      resetTravelPresentation();
    };

    const beginPlatformTravel = (platform: WorldPlatform, nowMs = lastFrameTimestamp) => {
      if (inputLocked()) return false;
      const curves = routeToPlatform(current, platform.id);
      if (curves.length === 0) {
        onPlatformSelect?.(platform);
        return false;
      }
      const destination = destinationFor(platform);
      activeTravel = {
        target: platform,
        startPosition: current.group.position.clone(),
        endPosition: destination.position,
        startRotationY: current.group.rotation.y,
        endRotationY: destination.rotationY,
        retiredBehind: false,
      };
      if (!islandTransition.begin(nowMs)) {
        activeTravel = undefined;
        return false;
      }
      traveler.travel(curves, nowMs, reducedMotion);
      onPlatformSelect?.(platform);
      container.dataset.traveling = "true";
      container.dataset.targetPlatform = platform.id;
      return true;
    };

    const travelToNext = () => {
      const frontPath = definition.paths.find((path) => path.id === "front");
      if (!frontPath) return false;
      const activeIndex = frontPath.platformIds.indexOf(activePlatformId);
      const nextId = frontPath.platformIds[Math.max(1, activeIndex + 1)];
      const platform = definition.platforms.find((candidate) => candidate.id === nextId);
      return platform ? beginPlatformTravel(platform) : false;
    };

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      if (camera.aspect < .72) {
        camera.fov = 54;
        camera.position.set(0, 9.8, 23);
        camera.lookAt(0, .35, -10.5);
      } else {
        camera.fov = 45;
        camera.position.copy(desktopCameraPosition);
        camera.lookAt(desktopLookAt);
      }
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const beginWorldFlip = (direction: 1 | -1, nowMs = performance.now()) => {
      if (inputLocked()) return false;
      const nextIndex = worldIndex + direction;
      pendingWorldIndex = nextIndex;
      transitionDirection = direction;
      incoming = createForwardWorldSlice(definition, nextIndex, quality, tuningRef.current.rockProfile);
      incoming.group.rotation.z = -HALF_TURN * direction;
      incoming.setOpacity(0);
      worldPivot.add(incoming.group);
      if (!transition.begin(nowMs)) {
        incoming.dispose();
        incoming = undefined;
        return false;
      }
      container.dataset.turning = "true";
      return true;
    };

    const commitIncoming = () => {
      if (!incoming) return;
      traveler.cancel();
      traveler.dispose();
      current.group.removeFromParent();
      current.dispose();
      current = incoming;
      incoming = undefined;
      worldIndex = pendingWorldIndex;
      activePlatformId = "foundation";
      activeTravel = undefined;
      worldPivot.rotation.z = 0;
      current.group.rotation.set(0, 0, 0);
      current.group.position.set(0, 0, 0);
      current.setOpacity(1);
      traveler = createPlatformTraveler();
      current.group.add(traveler.group);
      container.dataset.turning = "false";
      container.dataset.phase = "idle";
      container.dataset.world = String(worldIndex + 1);
      container.style.setProperty("--world-transition", "0");
      parallaxRef.current?.setTurn(0, transitionDirection);
      resetTravelPresentation();
      onWorldChange?.(worldIndex);
    };

    const animate = (timestamp: number) => {
      lastFrameTimestamp = timestamp;
      const elapsed = Math.max(0, (timestamp - animationStartedAt) / 1000);
      const turnSnapshot = transition.update(timestamp);
      if (turnSnapshot.completedThisFrame) {
        commitIncoming();
      } else if (transition.isActive && incoming) {
        worldPivot.rotation.z = turnSnapshot.rotationRadians * transitionDirection;
        incoming.group.rotation.z = turnSnapshot.incomingContentRotationRadians * transitionDirection;
        current.setOpacity(turnSnapshot.outgoingOpacity);
        incoming.setOpacity(turnSnapshot.incomingOpacity);
        current.group.visible = turnSnapshot.shouldRenderOutgoing;
        incoming.group.visible = turnSnapshot.shouldRenderIncoming;
        container.dataset.phase = turnSnapshot.phase;
        container.style.setProperty("--world-transition", String(turnSnapshot.motionBlurIntensity));
        parallaxRef.current?.setTurn(Math.abs(turnSnapshot.rotationRadians) / HALF_TURN, transitionDirection);
      }

      const travelSnapshot = islandTransition.update(timestamp);
      if (activeTravel && travelSnapshot.completedThisFrame) {
        finishTravel();
      } else if (activeTravel && islandTransition.isActive) {
        current.group.position.lerpVectors(
          activeTravel.startPosition,
          activeTravel.endPosition,
          travelSnapshot.worldOffsetProgress,
        );
        current.group.rotation.y = THREE.MathUtils.lerp(
          activeTravel.startRotationY,
          activeTravel.endRotationY,
          travelSnapshot.nearLayerProgress,
        );
        if (travelSnapshot.outgoingBehindCamera && !activeTravel.retiredBehind) {
          current.retireBehind(activeTravel.target.id);
          activeTravel.retiredBehind = true;
        }
        const blurPx = travelSnapshot.blurPx * tuningRef.current.motionBlur;
        container.dataset.travelPhase = travelSnapshot.phase;
        container.style.setProperty("--world-travel-blur", `${blurPx.toFixed(2)}px`);
        container.style.setProperty("--world-travel-intensity", String(travelSnapshot.motionBlurIntensity));
        parallaxRef.current?.setTravel(
          travelSnapshot.worldOffsetProgress,
          Math.max(0, 1 - travelSnapshot.backgroundDepthLag),
        );
      }

      const primaryMotionActive = transition.isActive || islandTransition.isActive;
      const motionIntensity = reducedMotion ? 0 : primaryMotionActive ? .28 : 1;
      background.update(elapsed, motionIntensity);
      current.update(elapsed, motionIntensity);
      incoming?.update(elapsed, motionIntensity);
      traveler.update(timestamp);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    const updateParallax = (event: PointerEvent) => {
      if (reducedMotion || inputLocked()) return;
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      parallaxRef.current?.setPointer(x * 2, y * 2);
    };

    const selectAtPointer = (event: PointerEvent) => {
      if (inputLocked()) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerPosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerPosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerPosition, camera);
      const hit = raycaster.intersectObject(current.group, true).find(({ object }) => object.userData.platform);
      const platform = hit?.object.userData.platform as WorldPlatform | undefined;
      if (platform) beginPlatformTravel(platform);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!inputLocked()) pointer = { x: event.clientX, y: event.clientY, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      updateParallax(event);
      if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 16) pointer.moved = true;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointer) return;
      const deltaX = event.clientX - pointer.x;
      if (Math.abs(deltaX) > 52) beginWorldFlip(deltaX < 0 ? 1 : -1);
      else if (!pointer.moved) selectAtPointer(event);
      pointer = undefined;
    };
    const onPointerCancel = () => { pointer = undefined; };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w" || event.key === " ") {
        event.preventDefault();
        travelToNext();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        beginWorldFlip(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        beginWorldFlip(-1);
      }
    };
    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      parallaxRef.current?.setReducedMotion(reducedMotion);
      const turnPreference = transition.setReducedMotion(reducedMotion);
      if (turnPreference.completedThisFrame) commitIncoming();
      const travelPreference = islandTransition.setReducedMotion(reducedMotion);
      if (travelPreference.completedThisFrame) finishTravel();
    };

    commandHandlerRef.current = (nextCommand) => {
      if (nextCommand.type === "travel-next") travelToNext();
      else if (nextCommand.type === "turn") beginWorldFlip(nextCommand.direction ?? 1);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    reducedMotionQuery.addEventListener("change", onReducedMotionChange);
    container.dataset.world = "1";
    container.dataset.turning = "false";
    resetTravelPresentation();
    resize();
    frameId = requestAnimationFrame(animate);

    return () => {
      commandHandlerRef.current = undefined;
      cancelAnimationFrame(frameId);
      transition.cancel();
      islandTransition.cancel();
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      traveler.dispose();
      current.dispose();
      incoming?.dispose();
      background.dispose();
      restoreGrade();
      renderer.dispose();
      parallaxRef.current?.reset();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [onPlatformSelect, onWorldChange]);

  useEffect(() => {
    if (command) commandHandlerRef.current?.(command);
  }, [command]);

  return (
    <div
      className={`world-experience${className ? ` ${className}` : ""}`}
      ref={containerRef}
      aria-label="Interactive skill world"
    >
      <LayeredParallaxBackground
        className={tuning.backdropEnabled ? undefined : "layered-parallax-background--disabled"}
        intensity={tuning.parallaxDepth}
        ref={parallaxRef}
      />
      <div className="world-experience__transition-wash" />
      <div className="world-experience__hint">↑ or W: travel · ← →: turn world · select an island · L: effects lab</div>
    </div>
  );
}
