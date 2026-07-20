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
  horizon: true,
  islands: true,
  foreground: true,
  cloud: true,
  island: true,
  floater: true,
};

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
  const [sector, setSector] = useState(0);

  const className = [
    "background-only-composition",
    ...Object.entries(layers).filter(([, visible]) => !visible).map(([id]) => `hide-${id}`),
  ].join(" ");
  const toggle = (key: LayerKey) => setLayers((current) => ({ ...current, [key]: !current[key] }));
  const chooseSector = (direction: -1 | 0 | 1) => {
    if (direction === 0) backgroundRef.current?.reset();
    else backgroundRef.current?.setSector(direction);
    setSector(direction);
  };
  const visibleCount = Object.values(layers).filter(Boolean).length;

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
      />
      {showReference && <img
        alt="July 20 reference comparison"
        className={`background-only-reference${difference ? " is-difference" : ""}`}
        src={referenceUrl}
        style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)`, opacity: referenceOpacity }}
      />}
      <div className={`background-only-grid${showGrid ? " is-visible" : ""}`} aria-hidden="true" />
      <div className="background-only-divider" style={{ left: `${wipe}%` }} aria-hidden="true"><span>reference</span><span>rebuild</span></div>
      <div className="lab-status">{sector < 0 ? "Left" : sector > 0 ? "Right" : "Center"} sector · {visibleCount} layer groups · 0 meshes</div>
    </div>
    <aside className="lab-panel">
      <p className="lab-panel__lead">This page contains no canvas and no 3D scene. Rebuild the supplied frame from independent watercolor plates and cutout sprites, then wipe the original over it to compare landmarks and edges.</p>
      <div className="lab-seam">Renderer: DOM image layers only · WebGL canvases: 0<br />Target: July 20 10:11 frame · foreground gameplay geometry intentionally excluded</div>
      <fieldset className="background-only-layers"><legend>Background groups</legend>
        {(Object.keys(layers) as LayerKey[]).map((key) => <label className="lab-check" key={key}><input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} /><span>{key === "islands" ? "Distant island plate" : key === "island" ? "Ornate island sprites" : key === "floater" ? "Balloons + airships" : key}</span></label>)}
      </fieldset>
      <Range label="Parallax depth" value={parallax} min={0} max={1.4} step={.05} onChange={setParallax} />
      <Range label="Sprite opacity" value={spriteOpacity} min={.2} max={1} step={.05} onChange={setSpriteOpacity} />
      <Range label="Sprite saturation" value={spriteSaturation} min={.3} max={1.4} step={.05} onChange={setSpriteSaturation} />
      <Range label="Sprite warmth" value={spriteWarmth} min={0} max={.5} step={.02} onChange={setSpriteWarmth} />
      <Range label="Reference wipe" value={wipe} min={0} max={100} step={1} onChange={setWipe} />
      <Range label="Reference opacity" value={referenceOpacity} min={.05} max={1} step={.05} onChange={setReferenceOpacity} />
      <label className="lab-check"><input type="checkbox" checked={showReference} onChange={(event) => setShowReference(event.currentTarget.checked)} /><span>Reference comparison</span></label>
      <label className="lab-check"><input type="checkbox" checked={difference} onChange={(event) => setDifference(event.currentTarget.checked)} /><span>Difference blend</span></label>
      <label className="lab-check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.currentTarget.checked)} /><span>Composition grid</span></label>
      <div className="lab-buttons"><button className={`lab-button${sector < 0 ? " is-active" : ""}`} onClick={() => chooseSector(-1)}>Left</button><button className={`lab-button${sector === 0 ? " is-active" : ""}`} onClick={() => chooseSector(0)}>Center</button><button className={`lab-button${sector > 0 ? " is-active" : ""}`} onClick={() => chooseSector(1)}>Right</button><button className="lab-button lab-button--primary" onClick={() => { setLayers(INITIAL_LAYERS); setSpriteOpacity(.9); setSpriteSaturation(.86); setSpriteWarmth(.12); setParallax(.65); chooseSector(0); }}>Reset match</button></div>
      <div className="lab-readout"><div><span>Three meshes</span><b>0</b></div><div><span>Visible groups</span><b>{visibleCount}</b></div><div><span>Comparison</span><b>{difference ? "difference" : "wipe"}</b></div></div>
    </aside>
  </main>;
}

createRoot(document.getElementById("background-only-root")!).render(<StrictMode><BackgroundOnlyLab /></StrictMode>);
