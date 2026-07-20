import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
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

interface RuntimeState {
  pointerX: number;
  pointerY: number;
  travelProgress: number;
  travelDepthLag: number;
  turnProgress: number;
  turnDirection: ParallaxTransitionDirection;
  backgroundSector: number;
  imperativeReducedMotion: boolean | null;
  systemReducedMotion: boolean;
}

const LAYERS: readonly LayerDefinition[] = [
  {
    id: "backwall",
    asset: "sky-backwall.webp",
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

const FLOATERS = [
  { id: "balloon-large", asset: "/lab-assets/floaters/balloon-large-final.png", left: "13%", top: "17%", width: "clamp(72px, 8vw, 132px)", depth: .42, phase: "-2.8s" },
  { id: "spire-small", asset: "/lab-assets/floaters/spire-small-final.png", left: "42%", top: "24%", width: "clamp(54px, 6vw, 94px)", depth: .75, phase: "-5.1s" },
  { id: "balloon-small", asset: "/lab-assets/floaters/balloon-small-final.png", left: "76%", top: "18%", width: "clamp(45px, 5vw, 82px)", depth: .84, phase: "-7.4s" },
  { id: "island-small", asset: "/lab-assets/floaters/island-small-final.png", left: "25%", top: "55%", width: "clamp(92px, 12vw, 190px)", depth: .65, phase: "-1.2s" },
  { id: "island-large", asset: "/lab-assets/floaters/island-large-final.png", left: "70%", top: "54%", width: "clamp(145px, 18vw, 310px)", depth: .38, phase: "-4.4s" },
  { id: "airship-large", asset: "/lab-assets/floaters/airship-large-final.png", left: "84%", top: "34%", width: "clamp(170px, 22vw, 360px)", depth: .3, phase: "-8.1s" },
] as const;

const BASE_SCALE = 1.08;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(minimum, value));
}

function joinAssetPath(base: string, asset: string) {
  const normalizedBase = base.replace(/\/+$/, "");
  return `${normalizedBase}/${asset}`;
}

/**
 * A DOM backwall for the transparent Three canvas. It owns no pointer listeners
 * or animation loop: the world controller drives it through the forwarded ref.
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
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const floaterRefs = useRef<Array<HTMLDivElement | null>>([]);
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
    imperativeReducedMotion: null,
    systemReducedMotion: false,
  });

  intensityRef.current = clamp(intensity, 0, 2);
  reducedMotionPropRef.current = reducedMotion;

  const commitTransforms = () => {
    const root = rootRef.current;
    if (!root) return;

    const runtime = runtimeRef.current;
    const shouldReduceMotion = runtime.imperativeReducedMotion
      ?? reducedMotionPropRef.current
      ?? runtime.systemReducedMotion;
    const motionIntensity = shouldReduceMotion ? 0 : intensityRef.current;
    const travelPulse = Math.sin(clamp(runtime.travelProgress, 0, 1) * Math.PI)
      * runtime.travelDepthLag * motionIntensity;
    const turnPulse = Math.sin(clamp(runtime.turnProgress, 0, 1) * Math.PI)
      * motionIntensity;

    root.dataset.reducedMotion = String(shouldReduceMotion);
    root.dataset.transitioning = String(travelPulse > 0.001 || turnPulse > 0.001);

    LAYERS.forEach((layer, index) => {
      const element = layerRefs.current[index];
      if (!element) return;

      const x = -runtime.pointerX * layer.pointerX * motionIntensity
        + runtime.turnDirection * turnPulse * layer.transitionX
        + runtime.backgroundSector * layer.transitionX * 1.65;
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

    FLOATERS.forEach((floater, index) => {
      const element = floaterRefs.current[index];
      if (!element) return;
      const nearness = 1 - floater.depth;
      const x = -runtime.pointerX * (7 + nearness * 19) * motionIntensity
        + runtime.turnDirection * turnPulse * (18 + nearness * 42)
        + runtime.backgroundSector * (34 + nearness * 88);
      const y = -runtime.pointerY * (4 + nearness * 11) * motionIntensity
        - turnPulse * (4 + nearness * 12)
        + travelPulse * (2 + nearness * 9);
      const scale = 1 + turnPulse * nearness * .035 + travelPulse * nearness * .025;
      const opacity = .58 + nearness * .42;
      element.style.setProperty("--floater-x", `${x.toFixed(3)}px`);
      element.style.setProperty("--floater-y", `${y.toFixed(3)}px`);
      element.style.setProperty("--floater-scale", scale.toFixed(4));
      element.style.setProperty("--floater-opacity", opacity.toFixed(3));
    });
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
      runtimeRef.current.turnProgress = clamp(progress, 0, 1);
      runtimeRef.current.turnDirection = direction < 0 ? -1 : 1;
      commitTransforms();
    },
    setSector: (direction) => {
      const step = direction < 0 ? -1 : 1;
      const next = runtimeRef.current.backgroundSector + step;
      runtimeRef.current.backgroundSector = next > 1 ? -1 : next < -1 ? 1 : next;
      commitTransforms();
    },
    setTransition: (progress, direction = 1) => {
      runtimeRef.current.turnProgress = clamp(progress, 0, 1);
      runtimeRef.current.turnDirection = direction < 0 ? -1 : 1;
      commitTransforms();
    },
    setReducedMotion: (nextReducedMotion) => {
      runtimeRef.current.imperativeReducedMotion = nextReducedMotion;
      commitTransforms();
    },
    reset: () => {
      runtimeRef.current.pointerX = 0;
      runtimeRef.current.pointerY = 0;
      runtimeRef.current.travelProgress = 0;
      runtimeRef.current.travelDepthLag = 1;
      runtimeRef.current.turnProgress = 0;
      runtimeRef.current.turnDirection = 1;
      runtimeRef.current.backgroundSector = 0;
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
    return () => reducedMotionQuery.removeEventListener("change", onPreferenceChange);
  }, []);

  useEffect(() => {
    commitTransforms();
  }, [intensity, reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={`layered-parallax-background${className ? ` ${className}` : ""}`}
      ref={rootRef}
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
      {FLOATERS.map((floater, index) => (
        <div
          className="layered-parallax-background__floater"
          data-depth={floater.depth}
          data-floater={floater.id}
          key={floater.id}
          ref={(element) => { floaterRefs.current[index] = element; }}
          style={{ left: floater.left, top: floater.top, width: floater.width }}
        >
          <img
            alt=""
            decoding="async"
            draggable={false}
            src={floater.asset}
            style={{ animationDelay: floater.phase }}
          />
        </div>
      ))}
    </div>
  );
});
