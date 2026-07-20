import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./lab.css";
import {
  LayeredParallaxBackground,
  ORBITAL_SPRITES,
  type LayeredParallaxBackgroundHandle,
  type OrbitalSpriteDefinition,
} from "../world/background/layers/LayeredParallaxBackground";
import "./backgroundOnlyLab.css";

const referenceUrl = new URL("../../../../finished/ChatGPT Image Jul 20, 2026, 10_11_35 AM.png", import.meta.url).href;

type LayerKey = "backwall" | "horizon" | "islands" | "foreground" | "cloud" | "island" | "floater";
const INITIAL_LAYERS: Record<LayerKey, boolean> = {
  backwall: true,
  horizon: false,
  islands: true,
  foreground: false,
  cloud: true,
  island: false,
  floater: false,
};

const ROUTE_SAFE_CLOUD_IDS = [
  "cloud-tower-left",
  "cloud-golden-ribbon",
  "cloud-lavender-puff",
  "cloud-tower-glow",
  "cloud-wing-sunset",
  "cloud-cumulus-right",
] as const;

const ROUTE_SAFE_CLOUDS: readonly OrbitalSpriteDefinition[] = ROUTE_SAFE_CLOUD_IDS.map((id) => {
  const sprite = ORBITAL_SPRITES.find((candidate) => candidate.id === id);
  if (!sprite) throw new Error(`Missing route-safe cloud asset: ${id}`);
  return sprite;
});

interface CloudStreamSlot {
  readonly phase: number;
  readonly side: -1 | 1;
  readonly lane: number;
  readonly width: string;
}

interface IslandStreamSlot {
  readonly phase: number;
  readonly side: -1 | 1;
}

const CLOUD_STREAM_SLOTS: readonly CloudStreamSlot[] = Array.from({ length: 12 }, (_, index) => ({
  phase: (index + .35) / 12,
  side: index % 2 === 0 ? -1 : 1,
  lane: index % 3,
  width: `clamp(${150 + (index % 3) * 28}px, ${20 + (index % 4) * 3}vw, ${390 + (index % 3) * 55}px)`,
}));

const ISLAND_STREAM_SLOTS: readonly IslandStreamSlot[] = [
  { phase: .08, side: -1 },
  { phase: .29, side: 1 },
  { phase: .5, side: -1 },
  { phase: .71, side: 1 },
  { phase: .92, side: -1 },
];

function cloudAt(index: number) {
  return ROUTE_SAFE_CLOUDS[index % ROUTE_SAFE_CLOUDS.length]!;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return progress * progress * (3 - 2 * progress);
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="lab-control"><span>{label} <output>{value.toFixed(2)}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}

function BackgroundOnlyLab() {
  const backgroundRef = useRef<LayeredParallaxBackgroundHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cloudStreamRefs = useRef<Array<HTMLDivElement | null>>([]);
  const islandStreamRefs = useRef<Array<HTMLDivElement | null>>([]);
  const forwardPhaseRef = useRef(0);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [spriteOpacity, setSpriteOpacity] = useState(.9);
  const [spriteSaturation, setSpriteSaturation] = useState(.86);
  const [spriteWarmth, setSpriteWarmth] = useState(.12);
  const [parallax, setParallax] = useState(.65);
  const [referenceOpacity, setReferenceOpacity] = useState(.32);
  const [wipe, setWipe] = useState(50);
  const [showReference, setShowReference] = useState(false);
  const [difference, setDifference] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [infiniteHorizon, setInfiniteHorizon] = useState(true);
  const [horizonDepth, setHorizonDepth] = useState(1);
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [sector, setSector] = useState(0);
  const [continuousScroll, setContinuousScroll] = useState(true);
  const [forwardSpeed, setForwardSpeed] = useState(.075);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const previousDepths = CLOUD_STREAM_SLOTS.map((slot) => slot.phase);
    const generations = new Uint16Array(CLOUD_STREAM_SLOTS.length);
    let animationFrame = 0;
    let phase = forwardPhaseRef.current;
    let lastTime = performance.now();

    const renderDepthField = (timestamp: number, advance: boolean) => {
      const elapsed = Math.min(.05, Math.max(0, (timestamp - lastTime) / 1000));
      lastTime = timestamp;
      if (advance) phase = (phase + elapsed * forwardSpeed) % 1;
      forwardPhaseRef.current = phase;

      const backwall = stage.querySelector<HTMLImageElement>('[data-layer="backwall"] .layered-parallax-background__image');
      const distantPlate = stage.querySelector<HTMLImageElement>('[data-layer="islands"] .layered-parallax-background__image');
      const mist = stage.querySelector<HTMLElement>(".layered-parallax-background__vanishing-mist");
      if (backwall) backwall.style.transform = `scale(${(1 + phase * .032).toFixed(4)})`;
      if (distantPlate) distantPlate.style.transform = `translate3d(0, ${(phase * 2.8).toFixed(2)}%, 0) scale(${(1 + phase * .105).toFixed(4)})`;
      if (mist) {
        mist.style.opacity = (.74 + phase * .2).toFixed(3);
        mist.style.transform = `scale(${(1 + phase * .18).toFixed(4)})`;
      }

      stage.querySelectorAll<HTMLElement>(".layered-parallax-background__horizon-ridge").forEach((ridge, index) => {
        const depth = (phase + index / 6) % 1;
        const projection = Math.pow(depth, 1.55);
        const fade = smoothstep(0, .1, depth) * (1 - smoothstep(.78, 1, depth));
        ridge.style.setProperty("--ridge-top", `${Math.min(91, 39.5 + projection * 47 * horizonDepth).toFixed(2)}%`);
        ridge.style.setProperty("--ridge-scale", (.34 + projection * 1.3 * horizonDepth).toFixed(4));
        ridge.style.setProperty("--ridge-opacity", (.035 + fade * .21).toFixed(3));
        ridge.style.setProperty("--ridge-blur", `${mix(2.5, .15, depth).toFixed(2)}px`);
      });

      islandStreamRefs.current.forEach((element, index) => {
        if (!element) return;
        const slot = ISLAND_STREAM_SLOTS[index];
        if (!slot) return;
        const depth = (phase + slot.phase) % 1;
        const projection = Math.pow(depth, 1.48);
        const fade = smoothstep(.015, .12, depth) * (1 - smoothstep(.8, 1, depth));
        const x = mix(slot.side < 0 ? 42 : 58, slot.side < 0 ? 16 : 84, projection);
        const y = mix(40.5, 73, Math.pow(depth, 1.32));
        const scale = .28 + projection * 1.28 * horizonDepth;
        const image = element.querySelector<HTMLImageElement>("img");
        element.style.opacity = layers.islands ? (fade * (.13 + depth * .42)).toFixed(3) : "0";
        element.style.zIndex = `${4 + Math.round(depth * 13)}`;
        element.style.transform = `translate3d(${x.toFixed(2)}vw, ${y.toFixed(2)}vh, 0) translate(-50%, -50%) scale(${scale.toFixed(4)})`;
        if (image) image.style.filter = `blur(${mix(2.8, .2, depth).toFixed(2)}px) saturate(${mix(.48, .83, depth).toFixed(2)}) brightness(${mix(1.14, .9, depth).toFixed(2)})`;
      });

      cloudStreamRefs.current.forEach((element, index) => {
        if (!element) return;
        const slot = CLOUD_STREAM_SLOTS[index];
        if (!slot) return;
        const depth = (phase + slot.phase) % 1;
        const projection = Math.pow(depth, 1.62);
        const fade = smoothstep(.015, .13, depth) * (1 - smoothstep(.82, 1, depth));
        const startX = slot.side < 0 ? 14 - slot.lane * 2 : 86 + slot.lane * 2;
        const endX = slot.side < 0 ? -16 - slot.lane * 3 : 116 + slot.lane * 3;
        const x = mix(startX, endX, projection);
        const y = mix(31 + slot.lane * 4.2, 56 + slot.lane * 5.5, Math.pow(depth, 1.38));
        const scale = .16 + projection * 1.76;
        const image = element.querySelector<HTMLImageElement>("img");

        if (depth < (previousDepths[index] ?? depth)) {
          const nextGeneration = (generations[index] ?? 0) + 1;
          generations[index] = nextGeneration;
          if (image) image.src = cloudAt(index + nextGeneration).asset;
        }
        previousDepths[index] = depth;
        element.style.opacity = layers.cloud ? (fade * spriteOpacity).toFixed(3) : "0";
        element.style.zIndex = `${20 + Math.round(depth * 48)}`;
        element.style.transform = `translate3d(${x.toFixed(2)}vw, ${y.toFixed(2)}vh, 0) translate(-50%, -50%) rotate(${(slot.side * mix(-1.5, 2.5, depth)).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        if (image) image.style.filter = `blur(${mix(2.2, .05, depth).toFixed(2)}px) saturate(${spriteSaturation.toFixed(2)}) sepia(${(spriteWarmth * .28).toFixed(3)}) brightness(${(1 + spriteWarmth * .12).toFixed(3)})`;
      });

      if (advance) animationFrame = window.requestAnimationFrame((nextTimestamp) => renderDepthField(nextTimestamp, true));
    };

    renderDepthField(lastTime, continuousScroll);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [continuousScroll, forwardSpeed, horizonDepth, layers.cloud, spriteOpacity, spriteSaturation, spriteWarmth]);

  const className = [
    "background-only-composition",
    ...Object.entries(layers).filter(([, visible]) => !visible).map(([id]) => `hide-${id}`),
  ].join(" ");
  const toggle = (key: LayerKey) => setLayers((current) => ({ ...current, [key]: !current[key] }));
  const chooseSector = (direction: -1 | 0 | 1) => {
    backgroundRef.current?.reset();
    if (direction !== 0) backgroundRef.current?.setSector(direction);
    setSector(direction);
  };
  return <main className="lab-shell">
    <header className="lab-header">
      <a className="lab-back" href="/labs/index.html">← All labs</a>
      <div className="lab-heading"><span>Issue J · zero-mesh background reconstruction</span><h1>Background-Only Reference Match</h1></div>
      <span className="lab-number">10</span>
    </header>
    <div className="lab-stage background-only-stage" ref={stageRef}>
      <LayeredParallaxBackground
        className={className}
        intensity={parallax}
        ref={backgroundRef}
        spriteOpacity={spriteOpacity}
        spriteSaturation={spriteSaturation}
        spriteWarmth={spriteWarmth}
        visibleSpriteIds={[]}
        infiniteHorizon={infiniteHorizon}
        horizonDepth={horizonDepth}
      />
      <div className="background-only-stream" aria-hidden="true">
        {ISLAND_STREAM_SLOTS.map((slot, index) => (
          <div
            className="background-only-stream__island"
            data-side={slot.side < 0 ? "left" : "right"}
            key={`island-${index}`}
            ref={(element) => { islandStreamRefs.current[index] = element; }}
          >
            <img alt="" decoding="async" draggable={false} src="/world-background/distant-islands.webp" />
          </div>
        ))}
        {CLOUD_STREAM_SLOTS.map((slot, index) => (
          <div
            className="background-only-stream__cloud"
            data-side={slot.side < 0 ? "left" : "right"}
            key={index}
            ref={(element) => { cloudStreamRefs.current[index] = element; }}
            style={{ width: slot.width }}
          >
            <img alt="" decoding="async" draggable={false} src={cloudAt(index).asset} />
          </div>
        ))}
      </div>
      {showReference && <img
        alt="July 20 reference comparison"
        className={`background-only-reference${difference ? " is-difference" : ""}`}
        src={referenceUrl}
        style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)`, opacity: referenceOpacity }}
      />}
      <div className={`background-only-grid${showGrid ? " is-visible" : ""}`} aria-hidden="true" />
      <div className={`background-only-routes${showRoutes ? " is-visible" : ""} is-${sector < 0 ? "left" : sector > 0 ? "right" : "center"}`} aria-hidden="true">
        <i data-route="left" /><i data-route="center" /><i data-route="right" /><span />
      </div>
      {showReference && <div className="background-only-divider" style={{ left: `${wipe}%` }} aria-hidden="true"><span>reference</span><span>rebuild</span></div>}
      <div className="lab-status">{sector < 0 ? "Left" : sector > 0 ? "Right" : "Center"} route · {continuousScroll ? "continuous inward stream" : "stream paused"} · clear corridor</div>
    </div>
    <aside className={`lab-panel background-only-panel${panelCollapsed ? " is-collapsed" : ""}`}>
      <button
        aria-expanded={!panelCollapsed}
        aria-label={panelCollapsed ? "Expand background controls" : "Collapse background controls"}
        className="background-only-panel__toggle"
        onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
        title={panelCollapsed ? "Show background controls" : "Hide background controls"}
        type="button"
      >{panelCollapsed ? "›" : "‹"}</button>
      <div className="background-only-panel__content">
        <p className="lab-panel__lead">The camera now advances forever: distant bands and clouds grow toward the viewer, fade at the edges, then regenerate at the horizon.</p>
        <div className="lab-seam">Core art only: reactive backwall + recycled distant plate + route-safe cloud stream<br />Excluded: balloons, airships, ornate island sprites, foreground mesh cards</div>
        <fieldset className="background-only-layers"><legend>Core background</legend>
          <label className="lab-check"><input type="checkbox" checked={layers.backwall} onChange={() => toggle("backwall")} /><span>Sunrise backwall</span></label>
          <label className="lab-check"><input type="checkbox" checked={layers.islands} onChange={() => toggle("islands")} /><span>Distant island plate</span></label>
          <label className="lab-check"><input type="checkbox" checked={layers.cloud} onChange={() => toggle("cloud")} /><span>Route-safe clouds</span></label>
        </fieldset>
        <label className="lab-check"><input type="checkbox" checked={continuousScroll} onChange={(event) => setContinuousScroll(event.currentTarget.checked)} /><span>Continuous inward scroll</span></label>
        <Range label="Forward speed" value={forwardSpeed} min={.025} max={.18} step={.005} onChange={setForwardSpeed} />
        <label className="lab-check"><input type="checkbox" checked={infiniteHorizon} onChange={(event) => setInfiniteHorizon(event.currentTarget.checked)} /><span>Infinite horizon field</span></label>
        <Range label="Horizon depth" value={horizonDepth} min={.45} max={1.35} step={.05} onChange={setHorizonDepth} />
        <Range label="Parallax depth" value={parallax} min={0} max={1.4} step={.05} onChange={setParallax} />
        <Range label="Cloud opacity" value={spriteOpacity} min={.2} max={1} step={.05} onChange={setSpriteOpacity} />
        <Range label="Cloud saturation" value={spriteSaturation} min={.3} max={1.4} step={.05} onChange={setSpriteSaturation} />
        <Range label="Cloud warmth" value={spriteWarmth} min={0} max={.5} step={.02} onChange={setSpriteWarmth} />
        <Range label="Reference wipe" value={wipe} min={0} max={100} step={1} onChange={setWipe} />
        <Range label="Reference opacity" value={referenceOpacity} min={.05} max={1} step={.05} onChange={setReferenceOpacity} />
        <label className="lab-check"><input type="checkbox" checked={showReference} onChange={(event) => setShowReference(event.currentTarget.checked)} /><span>Reference comparison</span></label>
        <label className="lab-check"><input type="checkbox" checked={difference} onChange={(event) => setDifference(event.currentTarget.checked)} /><span>Difference blend</span></label>
        <label className="lab-check"><input type="checkbox" checked={showRoutes} onChange={(event) => setShowRoutes(event.currentTarget.checked)} /><span>Protected route corridors</span></label>
        <label className="lab-check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.currentTarget.checked)} /><span>Composition grid</span></label>
        <div className="lab-buttons"><button className={`lab-button${sector < 0 ? " is-active" : ""}`} onClick={() => chooseSector(-1)}>45° left</button><button className={`lab-button${sector === 0 ? " is-active" : ""}`} onClick={() => chooseSector(0)}>Straight</button><button className={`lab-button${sector > 0 ? " is-active" : ""}`} onClick={() => chooseSector(1)}>45° right</button><button className="lab-button lab-button--primary" onClick={() => { setLayers(INITIAL_LAYERS); setSpriteOpacity(.9); setSpriteSaturation(.86); setSpriteWarmth(.12); setParallax(.65); setHorizonDepth(1); setInfiniteHorizon(true); setContinuousScroll(true); setForwardSpeed(.075); setShowRoutes(true); chooseSector(0); }}>Reset match</button></div>
        <div className="lab-readout"><div><span>Moving islands</span><b>{layers.islands ? ISLAND_STREAM_SLOTS.length : 0}</b></div><div><span>Cloud instances</span><b>{layers.cloud ? CLOUD_STREAM_SLOTS.length : 0}</b></div><div><span>Horizon</span><b>{continuousScroll && infiniteHorizon ? "moving ∞" : infiniteHorizon ? "paused ∞" : "flat"}</b></div></div>
      </div>
    </aside>
  </main>;
}

createRoot(document.getElementById("background-only-root")!).render(<StrictMode><BackgroundOnlyLab /></StrictMode>);
