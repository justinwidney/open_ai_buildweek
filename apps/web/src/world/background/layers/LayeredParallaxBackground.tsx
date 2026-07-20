import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import "./LayeredParallaxBackground.css";

export type ParallaxTransitionDirection = -1 | 1;

export interface LayeredParallaxBackgroundHandle {
  /** Pointer coordinates are normalized to -1..1 around the viewport center. */
  setPointer(x: number, y: number): void;
  /** Progress is the full 0..1 forward-travel timeline; depthLag is 0..1. */
  setTravel(progress: number, depthLag?: number): void;
  /** Progress is the full 0..1 turn timeline, not an already-eased pulse. */
  setTurn(progress: number, direction?: ParallaxTransitionDirection): void;
  /** Commits the backdrop to the next left/right sector after a route choice. */
  setSector(direction: ParallaxTransitionDirection): void;
  /** @deprecated Use setTurn(). Retained as a transition-controller alias. */
  setTransition(progress: number, direction?: ParallaxTransitionDirection): void;
  /** Pass null to return to the prop / OS preference. */
  setReducedMotion(reducedMotion: boolean | null): void;
  reset(): void;
}

export interface LayeredParallaxBackgroundProps {
  readonly assetBaseUrl?: string;
  readonly className?: string;
  readonly intensity?: number;
  readonly reducedMotion?: boolean;
  readonly spriteOpacity?: number;
  readonly spriteSaturation?: number;
  readonly spriteWarmth?: number;
  /** Restricts the orbital layer to an explicitly approved set of sprite IDs. */
  readonly visibleSpriteIds?: readonly string[];
  /** Repeats the distant plate into progressively deeper atmospheric ridges. */
  readonly infiniteHorizon?: boolean;
  /** Scales the spacing of the repeated distant ridges. */
  readonly horizonDepth?: number;
}

interface LayerDefinition {
  readonly id: string;
  readonly asset: string;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly transitionX: number;
  readonly transitionY: number;
  readonly transitionRotation: number;
  readonly transitionScale: number;
  readonly transitionBlur: number;
  readonly travelY: number;
  readonly travelScale: number;
  readonly travelBlur: number;
}

export interface OrbitalSpriteDefinition {
  readonly id: string;
  readonly asset: string;
  readonly kind: "floater" | "cloud" | "island";
  /** Polar position around the camera/world pivot, in degrees. */
  readonly angle: number;
  /** Orbit radius in normalized world units. */
  readonly radius: number;
  /** 0 is near and 1 is far; it biases the orbit-derived perspective. */
  readonly depth: number;
  readonly top: string;
  readonly width: string;
  readonly phase: string;
}

interface RuntimeState {
  pointerX: number;
  pointerY: number;
  travelProgress: number;
  travelDepthLag: number;
  turnProgress: number;
  turnDirection: ParallaxTransitionDirection;
  backgroundSector: number;
  targetYaw: number;
  currentYaw: number;
  imperativeReducedMotion: boolean | null;
  systemReducedMotion: boolean;
}

const LAYERS: readonly LayerDefinition[] = [
  {
    id: "backwall",
    asset: "sunrise-backwall-v2.webp",
    pointerX: 2,
    pointerY: 1,
    transitionX: 3,
    transitionY: 1,
    transitionRotation: 0.08,
    transitionScale: 0.002,
    transitionBlur: 0.1,
    travelY: 0.5,
    travelScale: 0.001,
    travelBlur: 0.04,
  },
  {
    id: "horizon",
    asset: "horizon.webp",
    pointerX: 5,
    pointerY: 2.5,
    transitionX: 8,
    transitionY: 2,
    transitionRotation: 0.18,
    transitionScale: 0.004,
    transitionBlur: 0.25,
    travelY: 1.2,
    travelScale: 0.002,
    travelBlur: 0.1,
  },
  {
    id: "islands",
    asset: "distant-islands.webp",
    pointerX: 16,
    pointerY: 8,
    transitionX: 29,
    transitionY: 9,
    transitionRotation: 0.66,
    transitionScale: 0.013,
    transitionBlur: 0.9,
    travelY: 6,
    travelScale: 0.012,
    travelBlur: 0.55,
  },
  {
    id: "foreground",
    asset: "foreground-frame.webp",
    pointerX: 23,
    pointerY: 11,
    transitionX: 42,
    transitionY: 14,
    transitionRotation: 0.95,
    transitionScale: 0.018,
    transitionBlur: 1.25,
    travelY: 10,
    travelScale: 0.02,
    travelBlur: 0.9,
  },
];

const FLOATERS: readonly OrbitalSpriteDefinition[] = [
  { id: "balloon-large", asset: "/lab-assets/floaters/balloon-large-final.png", kind: "floater", angle: -43, radius: .88, depth: .42, top: "17%", width: "clamp(72px, 8vw, 132px)", phase: "-2.8s" },
  { id: "spire-small", asset: "/lab-assets/floaters/spire-small-final.png", kind: "floater", angle: -10, radius: .78, depth: .75, top: "24%", width: "clamp(54px, 6vw, 94px)", phase: "-5.1s" },
  { id: "balloon-small", asset: "/lab-assets/floaters/balloon-small-final.png", kind: "floater", angle: 38, radius: .84, depth: .84, top: "18%", width: "clamp(45px, 5vw, 82px)", phase: "-7.4s" },
  { id: "island-small", asset: "/lab-assets/floaters/island-small-final.png", kind: "floater", angle: -27, radius: .9, depth: .65, top: "55%", width: "clamp(92px, 12vw, 190px)", phase: "-1.2s" },
  { id: "island-large", asset: "/lab-assets/floaters/island-large-final.png", kind: "floater", angle: 18, radius: 1.02, depth: .38, top: "54%", width: "clamp(145px, 18vw, 310px)", phase: "-4.4s" },
  { id: "airship-large", asset: "/lab-assets/floaters/airship-large-final.png", kind: "floater", angle: 51, radius: 1.05, depth: .3, top: "34%", width: "clamp(170px, 22vw, 360px)", phase: "-8.1s" },
];

const CLOUDS: readonly OrbitalSpriteDefinition[] = [
  { id: "cloud-tower-left", asset: "/lab-assets/clouds/tower-left.png", kind: "cloud", angle: -62, radius: 1.12, depth: .34, top: "7%", width: "clamp(210px, 31vw, 560px)", phase: "-3.2s" },
  { id: "cloud-golden-ribbon", asset: "/lab-assets/clouds/golden-ribbon.png", kind: "cloud", angle: -39, radius: .86, depth: .72, top: "10%", width: "clamp(180px, 25vw, 460px)", phase: "-7.7s" },
  { id: "cloud-lavender-puff", asset: "/lab-assets/clouds/lavender-puff.png", kind: "cloud", angle: -20, radius: .76, depth: .82, top: "31%", width: "clamp(100px, 15vw, 260px)", phase: "-5.4s" },
  { id: "cloud-tower-glow", asset: "/lab-assets/clouds/tower-glow.png", kind: "cloud", angle: 2, radius: .79, depth: .68, top: "8%", width: "clamp(110px, 17vw, 300px)", phase: "-9.1s" },
  { id: "cloud-wing-sunset", asset: "/lab-assets/clouds/wing-sunset.png", kind: "cloud", angle: 31, radius: .9, depth: .76, top: "14%", width: "clamp(170px, 23vw, 420px)", phase: "-1.6s" },
  { id: "cloud-cumulus-right", asset: "/lab-assets/clouds/cumulus-right.png", kind: "cloud", angle: 59, radius: 1.08, depth: .3, top: "20%", width: "clamp(190px, 29vw, 520px)", phase: "-6.3s" },
  { id: "cloud-violet-bank", asset: "/lab-assets/clouds/violet-bank.png", kind: "cloud", angle: -53, radius: 1.03, depth: .58, top: "68%", width: "clamp(210px, 32vw, 590px)", phase: "-4.8s" },
  { id: "cloud-garden-cumulus", asset: "/lab-assets/clouds/garden-cumulus.png", kind: "cloud", angle: -4, radius: .82, depth: .63, top: "65%", width: "clamp(135px, 19vw, 340px)", phase: "-10.2s" },
  { id: "cloud-bottom-cumulus", asset: "/lab-assets/clouds/bottom-cumulus.png", kind: "cloud", angle: 46, radius: 1.14, depth: .43, top: "75%", width: "clamp(220px, 34vw, 620px)", phase: "-2.2s" },
  { id: "cloud-streak-large", asset: "/lab-assets/clouds/streak-large.png", kind: "cloud", angle: 69, radius: 1.2, depth: .57, top: "50%", width: "clamp(230px, 35vw, 650px)", phase: "-8.8s" },
  { id: "cloud-ribbon-middle", asset: "/lab-assets/clouds/ribbon-middle.png", kind: "cloud", angle: 14, radius: .74, depth: .88, top: "45%", width: "clamp(145px, 21vw, 380px)", phase: "-11.3s" },
  { id: "cloud-pink-islet", asset: "/lab-assets/clouds/pink-islet.png", kind: "cloud", angle: -31, radius: .72, depth: .9, top: "48%", width: "clamp(86px, 13vw, 230px)", phase: "-.9s" },
];

const BACKGROUND_ISLANDS: readonly OrbitalSpriteDefinition[] = [
  { id: "hd-tree-island", asset: "/lab-assets/platform-hires/tree-island-hd.png", kind: "island", angle: -49, radius: 1.08, depth: .2, top: "39%", width: "clamp(210px, 28vw, 510px)", phase: "-4.6s" },
  { id: "hd-waterfall-island", asset: "/lab-assets/platform-hires/waterfall-shrine-hd.png", kind: "island", angle: 5, radius: .94, depth: .3, top: "46%", width: "clamp(180px, 23vw, 420px)", phase: "-8.2s" },
  { id: "hd-castle-island", asset: "/lab-assets/platform-hires/castle-island-hd.png", kind: "island", angle: 52, radius: 1.12, depth: .16, top: "36%", width: "clamp(220px, 30vw, 550px)", phase: "-1.9s" },
];

export const ORBITAL_SPRITES = [...CLOUDS, ...BACKGROUND_ISLANDS, ...FLOATERS] as const;
const BASE_SCALE = 1.08;
const SECTOR_YAW_DEGREES = 28;
const ORBIT_DAMPING = 2.6;
const DEGREES_TO_RADIANS = Math.PI / 180;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(minimum, value));
}

function joinAssetPath(base: string, asset: string) {
  const normalizedBase = base.replace(/\/+$/, "");
  return `${normalizedBase}/${asset}`;
}

function visibleSector(sector: number) {
  const wrapped = ((sector % 3) + 3) % 3;
  return wrapped === 2 ? -1 : wrapped;
}

/**
 * A DOM backwall for the transparent Three canvas. Background plates retain
 * subtle parallax, while every floater/cloud occupies a polar coordinate
 * around one shared camera pivot. Yaw therefore changes both x and z instead
 * of applying an instantaneous 2D offset.
 */
export const LayeredParallaxBackground = forwardRef<
  LayeredParallaxBackgroundHandle,
  LayeredParallaxBackgroundProps
>(function LayeredParallaxBackground(
  {
    assetBaseUrl = "/world-background",
    className,
    intensity = 1,
    reducedMotion,
    spriteOpacity = 1,
    spriteSaturation = 1,
    spriteWarmth = 0,
    visibleSpriteIds,
    infiniteHorizon = false,
    horizonDepth = 1,
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const orbitalRefs = useRef<Array<HTMLDivElement | null>>([]);
  const animationFrameRef = useRef<number | null>(null);
  const previousFrameTimeRef = useRef<number | null>(null);
  const intensityRef = useRef(clamp(intensity, 0, 2));
  const reducedMotionPropRef = useRef<boolean | undefined>(reducedMotion);
  const runtimeRef = useRef<RuntimeState>({
    pointerX: 0,
    pointerY: 0,
    travelProgress: 0,
    travelDepthLag: 1,
    turnProgress: 0,
    turnDirection: 1,
    backgroundSector: 0,
    targetYaw: 0,
    currentYaw: 0,
    imperativeReducedMotion: null,
    systemReducedMotion: false,
  });

  intensityRef.current = clamp(intensity, 0, 2);
  reducedMotionPropRef.current = reducedMotion;
  const visibleSpriteIdSet = visibleSpriteIds ? new Set(visibleSpriteIds) : undefined;

  const shouldReduceMotion = () => {
    const runtime = runtimeRef.current;
    return runtime.imperativeReducedMotion
      ?? reducedMotionPropRef.current
      ?? runtime.systemReducedMotion;
  };

  const renderOrbitalSprites = () => {
    const runtime = runtimeRef.current;
    const reduced = shouldReduceMotion();
    const motionIntensity = reduced ? 0 : intensityRef.current;
    const travelPulse = Math.sin(clamp(runtime.travelProgress, 0, 1) * Math.PI)
      * runtime.travelDepthLag * motionIntensity;

    ORBITAL_SPRITES.forEach((sprite, index) => {
      const element = orbitalRefs.current[index];
      if (!element) return;

      // A shared polar orbit is the core 2.5D projection:
      // x = sin(angle - yaw) * radius, z = cos(angle - yaw) * radius.
      const theta = (sprite.angle - runtime.currentYaw) * DEGREES_TO_RADIANS;
      const worldX = Math.sin(theta) * sprite.radius;
      const worldZ = Math.cos(theta) * sprite.radius;
      const orbitDepth = clamp((worldZ + 1.2) / 2.4, 0, 1);
      const nearness = clamp((1 - sprite.depth) * .58 + orbitDepth * .42, 0, 1);
      const xViewport = worldX * 48
        - runtime.pointerX * (1.8 + nearness * 5.5) * motionIntensity;
      const y = -runtime.pointerY * (2 + nearness * 8) * motionIntensity
        + travelPulse * (1 + nearness * 8);
      const scale = .58 + nearness * .64 + travelPulse * nearness * .02;
      const opacity = .4 + nearness * .6;

      element.dataset.worldX = worldX.toFixed(4);
      element.dataset.worldZ = worldZ.toFixed(4);
      element.style.zIndex = String(Math.round(2 + nearness * 90));
      element.style.setProperty("--orbit-x", `${xViewport.toFixed(3)}vw`);
      element.style.setProperty("--orbit-y", `${y.toFixed(3)}px`);
      element.style.setProperty("--orbit-scale", scale.toFixed(4));
      element.style.setProperty("--orbit-opacity", opacity.toFixed(3));
    });
  };

  const animateOrbit = (timestamp: number) => {
    animationFrameRef.current = null;
    const runtime = runtimeRef.current;
    const previousTimestamp = previousFrameTimeRef.current ?? timestamp;
    const deltaSeconds = Math.min(.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    previousFrameTimeRef.current = timestamp;

    if (shouldReduceMotion()) {
      runtime.currentYaw = runtime.targetYaw;
    } else {
      // Exponential damping is stable across refresh rates and dropped frames.
      const blend = 1 - Math.exp(-ORBIT_DAMPING * deltaSeconds);
      runtime.currentYaw += (runtime.targetYaw - runtime.currentYaw) * blend;
    }

    renderOrbitalSprites();
    if (Math.abs(runtime.targetYaw - runtime.currentYaw) > .01) {
      animationFrameRef.current = window.requestAnimationFrame(animateOrbit);
    } else {
      runtime.currentYaw = runtime.targetYaw;
      previousFrameTimeRef.current = null;
      renderOrbitalSprites();
    }
  };

  const scheduleOrbitAnimation = () => {
    if (animationFrameRef.current === null) {
      previousFrameTimeRef.current = null;
      animationFrameRef.current = window.requestAnimationFrame(animateOrbit);
    }
  };

  const commitTransforms = () => {
    const root = rootRef.current;
    if (!root) return;

    const runtime = runtimeRef.current;
    const reduced = shouldReduceMotion();
    const motionIntensity = reduced ? 0 : intensityRef.current;
    const travelPulse = Math.sin(clamp(runtime.travelProgress, 0, 1) * Math.PI)
      * runtime.travelDepthLag * motionIntensity;
    const turnPulse = Math.sin(clamp(runtime.turnProgress, 0, 1) * Math.PI)
      * motionIntensity;
    const sector = visibleSector(runtime.backgroundSector);

    root.dataset.reducedMotion = String(reduced);
    root.dataset.transitioning = String(travelPulse > 0.001 || turnPulse > 0.001);

    LAYERS.forEach((layer, index) => {
      const element = layerRefs.current[index];
      if (!element) return;

      const x = -runtime.pointerX * layer.pointerX * motionIntensity
        + runtime.turnDirection * turnPulse * layer.transitionX
        + sector * layer.transitionX * 1.65;
      const y = -runtime.pointerY * layer.pointerY * motionIntensity
        - turnPulse * layer.transitionY
        + travelPulse * layer.travelY;
      const rotation = runtime.turnDirection * turnPulse * layer.transitionRotation;
      const scale = BASE_SCALE
        + turnPulse * layer.transitionScale
        + travelPulse * layer.travelScale;
      const blur = turnPulse * layer.transitionBlur + travelPulse * layer.travelBlur;

      element.style.setProperty("--parallax-x", `${x.toFixed(3)}px`);
      element.style.setProperty("--parallax-y", `${y.toFixed(3)}px`);
      element.style.setProperty("--parallax-rotation", `${rotation.toFixed(3)}deg`);
      element.style.setProperty("--parallax-scale", scale.toFixed(4));
      element.style.setProperty("--parallax-blur", `${blur.toFixed(3)}px`);
    });

    renderOrbitalSprites();
    scheduleOrbitAnimation();
  };

  useImperativeHandle(forwardedRef, () => ({
    setPointer: (x, y) => {
      runtimeRef.current.pointerX = clamp(x, -1, 1);
      runtimeRef.current.pointerY = clamp(y, -1, 1);
      commitTransforms();
    },
    setTravel: (progress, depthLag = 1) => {
      runtimeRef.current.travelProgress = clamp(progress, 0, 1);
      runtimeRef.current.travelDepthLag = clamp(depthLag, 0, 1);
      commitTransforms();
    },
    setTurn: (progress, direction = 1) => {
      const runtime = runtimeRef.current;
      runtime.turnProgress = clamp(progress, 0, 1);
      runtime.turnDirection = direction < 0 ? -1 : 1;
      runtime.targetYaw = (runtime.backgroundSector
        + runtime.turnDirection * runtime.turnProgress) * SECTOR_YAW_DEGREES;
      commitTransforms();
    },
    setSector: (direction) => {
      const runtime = runtimeRef.current;
      const step = direction < 0 ? -1 : 1;
      runtime.backgroundSector += step;
      runtime.turnProgress = 0;
      runtime.turnDirection = step;
      runtime.targetYaw = runtime.backgroundSector * SECTOR_YAW_DEGREES;
      commitTransforms();
    },
    setTransition: (progress, direction = 1) => {
      const runtime = runtimeRef.current;
      runtime.turnProgress = clamp(progress, 0, 1);
      runtime.turnDirection = direction < 0 ? -1 : 1;
      runtime.targetYaw = (runtime.backgroundSector
        + runtime.turnDirection * runtime.turnProgress) * SECTOR_YAW_DEGREES;
      commitTransforms();
    },
    setReducedMotion: (nextReducedMotion) => {
      runtimeRef.current.imperativeReducedMotion = nextReducedMotion;
      commitTransforms();
    },
    reset: () => {
      const runtime = runtimeRef.current;
      runtime.pointerX = 0;
      runtime.pointerY = 0;
      runtime.travelProgress = 0;
      runtime.travelDepthLag = 1;
      runtime.turnProgress = 0;
      runtime.turnDirection = 1;
      runtime.backgroundSector = 0;
      runtime.targetYaw = 0;
      commitTransforms();
    },
  }), []);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      runtimeRef.current.systemReducedMotion = event.matches;
      commitTransforms();
    };

    runtimeRef.current.systemReducedMotion = reducedMotionQuery.matches;
    reducedMotionQuery.addEventListener("change", onPreferenceChange);
    commitTransforms();
    return () => {
      reducedMotionQuery.removeEventListener("change", onPreferenceChange);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    commitTransforms();
  }, [horizonDepth, infiniteHorizon, intensity, reducedMotion, spriteOpacity, spriteSaturation, spriteWarmth, visibleSpriteIds]);

  return (
    <div
      aria-hidden="true"
      className={`layered-parallax-background${className ? ` ${className}` : ""}`}
      ref={rootRef}
      style={{
        "--sprite-opacity": clamp(spriteOpacity, 0, 1),
        "--sprite-saturation": clamp(spriteSaturation, 0, 2),
        "--sprite-warmth": clamp(spriteWarmth, 0, 1),
        "--horizon-depth": clamp(horizonDepth, .25, 2),
      } as CSSProperties}
    >
      {LAYERS.map((layer, index) => (
        <div
          className="layered-parallax-background__layer"
          data-layer={layer.id}
          key={layer.id}
          ref={(element) => { layerRefs.current[index] = element; }}
        >
          <img
            alt=""
            className="layered-parallax-background__image"
            decoding="async"
            draggable={false}
            src={joinAssetPath(assetBaseUrl, layer.asset)}
          />
        </div>
      ))}
      {infiniteHorizon && (
        <div className="layered-parallax-background__infinite-horizon">
          {Array.from({ length: 6 }, (_, index) => {
            const depth = clamp(horizonDepth, .25, 2);
            const progress = index / 5;
            const top = 40.5 + Math.pow(progress, 1.55) * 43 * depth;
            const scale = .42 + progress * 1.08 * depth;
            const opacity = .08 + (1 - Math.abs(progress - .48) * 1.65) * .13;
            return (
              <div
                className="layered-parallax-background__horizon-ridge"
                data-ridge={index}
                key={index}
                style={{
                  "--ridge-blur": `${Math.max(0, 2.2 - index * .34).toFixed(2)}px`,
                  "--ridge-opacity": clamp(opacity, .05, .22),
                  "--ridge-scale": scale,
                  "--ridge-top": `${Math.min(89, top).toFixed(2)}%`,
                } as CSSProperties}
              >
                <img alt="" decoding="async" draggable={false} src={joinAssetPath(assetBaseUrl, "distant-islands.webp")} />
                <img alt="" decoding="async" draggable={false} src={joinAssetPath(assetBaseUrl, "distant-islands.webp")} />
                <img alt="" decoding="async" draggable={false} src={joinAssetPath(assetBaseUrl, "distant-islands.webp")} />
              </div>
            );
          })}
          <div className="layered-parallax-background__vanishing-mist" />
        </div>
      )}
      {ORBITAL_SPRITES.map((sprite, index) => (
        visibleSpriteIdSet && !visibleSpriteIdSet.has(sprite.id) ? null :
        <div
          className="layered-parallax-background__orbital-sprite"
          data-depth={sprite.depth}
          data-kind={sprite.kind}
          data-sprite={sprite.id}
          key={sprite.id}
          ref={(element) => { orbitalRefs.current[index] = element; }}
          style={{ top: sprite.top, width: sprite.width }}
        >
          <img
            alt=""
            decoding="async"
            draggable={false}
            src={sprite.asset}
            style={{ animationDelay: sprite.phase }}
          />
        </div>
      ))}
    </div>
  );
});
