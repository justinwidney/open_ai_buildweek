import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./lab.css";
import {
  LayeredParallaxBackground,
  type LayeredParallaxBackgroundHandle,
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

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="lab-control"><span>{label} <output>{value.toFixed(2)}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}

function BackgroundOnlyLab() {
  const backgroundRef = useRef<LayeredParallaxBackgroundHandle>(null);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [spriteOpacity, setSpriteOpacity] = useState(.9);
  const [spriteSaturation, setSpriteSaturation] = useState(.86);
  const [spriteWarmth, setSpriteWarmth] = useState(.12);
  const [parallax, setParallax] = useState(.65);
  const [referenceOpacity, setReferenceOpacity] = useState(.32);
  const [wipe, setWipe] = useState(50);
  const [showReference, setShowReference] = useState(true);
  const [difference, setDifference] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [infiniteHorizon, setInfiniteHorizon] = useState(true);
  const [horizonDepth, setHorizonDepth] = useState(1);
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [sector, setSector] = useState(0);

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
  const visibleCount = (["backwall", "islands", "cloud"] as LayerKey[]).filter((key) => layers[key]).length;

  return <main className="lab-shell">
    <header className="lab-header">
      <a className="lab-back" href="/labs/index.html">← All labs</a>
      <div className="lab-heading"><span>Issue J · zero-mesh background reconstruction</span><h1>Background-Only Reference Match</h1></div>
      <span className="lab-number">10</span>
    </header>
    <div className="lab-stage background-only-stage">
      <LayeredParallaxBackground
        className={className}
        intensity={parallax}
        ref={backgroundRef}
        spriteOpacity={spriteOpacity}
        spriteSaturation={spriteSaturation}
        spriteWarmth={spriteWarmth}
        visibleSpriteIds={layers.cloud ? ROUTE_SAFE_CLOUD_IDS : []}
        infiniteHorizon={infiniteHorizon}
        horizonDepth={horizonDepth}
      />
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
      <div className="lab-status">{sector < 0 ? "Left" : sector > 0 ? "Right" : "Center"} route · {visibleCount} core layers · clear corridor</div>
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
        <p className="lab-panel__lead">Three protected routes share one endless background: straight ahead, 45° left, and 45° right.</p>
        <div className="lab-seam">Core art only: backwall + repeated distant plate + route-safe clouds<br />Excluded: balloons, airships, ornate island sprites, foreground mesh cards</div>
        <fieldset className="background-only-layers"><legend>Core background</legend>
          <label className="lab-check"><input type="checkbox" checked={layers.backwall} onChange={() => toggle("backwall")} /><span>Sunrise backwall</span></label>
          <label className="lab-check"><input type="checkbox" checked={layers.islands} onChange={() => toggle("islands")} /><span>Distant island plate</span></label>
          <label className="lab-check"><input type="checkbox" checked={layers.cloud} onChange={() => toggle("cloud")} /><span>Route-safe clouds</span></label>
        </fieldset>
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
        <div className="lab-buttons"><button className={`lab-button${sector < 0 ? " is-active" : ""}`} onClick={() => chooseSector(-1)}>45° left</button><button className={`lab-button${sector === 0 ? " is-active" : ""}`} onClick={() => chooseSector(0)}>Straight</button><button className={`lab-button${sector > 0 ? " is-active" : ""}`} onClick={() => chooseSector(1)}>45° right</button><button className="lab-button lab-button--primary" onClick={() => { setLayers(INITIAL_LAYERS); setSpriteOpacity(.9); setSpriteSaturation(.86); setSpriteWarmth(.12); setParallax(.65); setHorizonDepth(1); setInfiniteHorizon(true); setShowRoutes(true); chooseSector(0); }}>Reset match</button></div>
        <div className="lab-readout"><div><span>Gameplay sprites</span><b>0</b></div><div><span>Safe clouds</span><b>{layers.cloud ? ROUTE_SAFE_CLOUD_IDS.length : 0}</b></div><div><span>Horizon</span><b>{infiniteHorizon ? "∞" : "flat"}</b></div></div>
      </div>
    </aside>
  </main>;
}

createRoot(document.getElementById("background-only-root")!).render(<StrictMode><BackgroundOnlyLab /></StrictMode>);
