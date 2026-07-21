import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createLevelTwoThreeRuntime,
  type LevelTwoDiagnostics,
  type LevelTwoThreeRuntime,
} from "./levelTwoThreeRuntime";
import "./lab.css";
import "./levelTwoWorldLab.css";

const ROUTE_STOPS = 5;
const EMPTY_DIAGNOSTICS: LevelTwoDiagnostics = {
  fps: 0,
  frameMs: 0,
  calls: 0,
  triangles: 0,
  textures: 0,
  geometries: 0,
  stops: [],
};

function LevelTwoWorldLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<LevelTwoThreeRuntime | null>(null);
  const [chapter, setChapter] = useState(1);
  const [step, setStep] = useState(0);
  const [universe, setUniverse] = useState<0 | 1>(0);
  const [inputLocked, setInputLocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [status, setStatus] = useState("06_03 layered view - 45-degree camera ready");
  const [diagnostics, setDiagnostics] = useState<LevelTwoDiagnostics>(EMPTY_DIAGNOSTICS);
  const [showInspector, setShowInspector] = useState(false);
  const [showMarkers, setShowMarkers] = useState(false);
  const castleReady = step >= ROUTE_STOPS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = createLevelTwoThreeRuntime(canvas, {
      onChapter: setChapter,
      onDiagnostics: setDiagnostics,
      onLock: setInputLocked,
      onStatus: setStatus,
      onStep: setStep,
      onUniverse: setUniverse,
    });
    runtimeRef.current = runtime;
    return () => {
      runtimeRef.current = null;
      runtime.dispose();
    };
  }, []);

  const setReduced = (reduced: boolean) => {
    setReducedMotion(reduced);
    runtimeRef.current?.setReducedMotion(reduced);
  };

  const setMarkers = (visible: boolean) => {
    setShowMarkers(visible);
    runtimeRef.current?.setDebugMarkers(visible);
  };

  return <main className="lab-shell level-two-shell">
    <header className="lab-header">
      <a className="lab-back" href="/labs/index.html">&larr; All labs</a>
      <div className="lab-heading"><span>Level 2 - layered watercolor scene + route lifecycle debugger</span><h1>Pathfinder World Run</h1></div>
      <span className="lab-number">L2</span>
    </header>

    <div className="lab-stage level-two-stage">
      <canvas ref={canvasRef} />
      <div className="level-two-progress" aria-label={`Route progress ${step} of ${ROUTE_STOPS}`}>
        {Array.from({ length: ROUTE_STOPS }, (_, index) => <i className={index < step ? "is-complete" : index === step ? "is-current" : ""} key={index}>{index + 1}</i>)}
        <b className={castleReady ? "is-ready" : ""}>Castle</b>
      </div>
      <div className="lab-status">{status}</div>
      <button className="level-two-inspector-toggle" onClick={() => setShowInspector((visible) => !visible)} type="button">{showInspector ? "Hide" : "Show"} visibility tool</button>
    </div>

    <aside className="lab-panel level-two-panel">
      <p className="lab-panel__lead">The 06_03 artwork now covers the viewport at every aspect ratio. Its foreground, side island, generated cloud banks, waterfalls, and castle pennants sit at registered depths under the 45-degree camera.</p>
      <div className="lab-seam">Animation: clouds drift, waterfalls breathe, and castle flags wave inside one render loop<br />Travel: the camera pushes into the registered depth stack without passing through the image<br />Authoring: layer-manifest.json owns each removable asset, anchor, depth, phase, and parallax value</div>
      <label className="lab-check"><input type="checkbox" checked={reducedMotion} disabled={inputLocked} onChange={(event) => setReduced(event.currentTarget.checked)} /><span>Reduced motion override</span></label>
      <div className="level-two-route-buttons">
        <button className="lab-button" disabled={inputLocked || castleReady} onClick={() => runtimeRef.current?.travel(-1)}>Travel left</button>
        <button className="lab-button lab-button--primary" disabled={inputLocked || castleReady} onClick={() => runtimeRef.current?.travel(0)}>Travel straight</button>
        <button className="lab-button" disabled={inputLocked || castleReady} onClick={() => runtimeRef.current?.travel(1)}>Travel right</button>
      </div>
      <div className="lab-buttons">
        <button className="lab-button" disabled={inputLocked} onClick={() => runtimeRef.current?.rotateUniverse()}>{universe === 0 ? "Rotate to parallel" : "Return to primary"}</button>
        <button className="lab-button" disabled={inputLocked || !castleReady} onClick={() => runtimeRef.current?.enterCastle()}>Enter castle</button>
        <button className="lab-button" disabled={inputLocked} onClick={() => runtimeRef.current?.reset()}>Reset run</button>
      </div>
      <div className="lab-readout">
        <div><span>Chapter</span><b>{chapter}</b></div>
        <div><span>Depth stop</span><b>{Math.min(step + 1, ROUTE_STOPS + 1)}</b></div>
        <div><span>Universe</span><b>{universe === 0 ? "A" : "B"}</b></div>
      </div>
    </aside>

    {showInspector && <aside className="level-two-inspector">
      <header><div><span>Three.js visibility</span><h2>Camera + Frustum</h2></div><strong className={diagnostics.fps >= 50 ? "is-good" : diagnostics.fps >= 30 ? "is-warn" : "is-bad"}>{diagnostics.fps.toFixed(0)} FPS</strong></header>
      <div className="level-two-metrics">
        <div><span>Frame</span><b>{diagnostics.frameMs.toFixed(1)}ms</b></div>
        <div><span>Calls</span><b>{diagnostics.calls}</b></div>
        <div><span>Triangles</span><b>{diagnostics.triangles.toLocaleString()}</b></div>
        <div><span>Textures</span><b>{diagnostics.textures}</b></div>
        <div><span>Geometry</span><b>{diagnostics.geometries}</b></div>
      </div>
      <label className="lab-check"><input type="checkbox" checked={showMarkers} onChange={(event) => setMarkers(event.currentTarget.checked)} /><span>Show status rings in world</span></label>
      <div className="level-two-inspector__legend"><i className="is-active" /> active <i className="is-ahead" /> rendered <i className="is-culled" /> culled <i className="is-retired" /> retired</div>
      <div className="level-two-inspector__table">
        <div className="is-heading"><span>Stop</span><span>Camera Z</span><span>Frustum</span><span>Lifecycle</span></div>
        {diagnostics.stops.map((stop) => <div className={`is-${stop.state}`} key={stop.id}>
          <span>{stop.id}</span>
          <span>{stop.cameraZ.toFixed(1)}</span>
          <span>{stop.inFrustum ? "inside" : "outside"}</span>
          <span>{stop.state}</span>
        </div>)}
      </div>
      <p>Passed stops are retired by route ownership, not merely because they leave the frustum. Frustum culling handles future off-screen objects automatically.</p>
    </aside>}
  </main>;
}

createRoot(document.getElementById("level-two-root")!).render(<StrictMode><LevelTwoWorldLab /></StrictMode>);
