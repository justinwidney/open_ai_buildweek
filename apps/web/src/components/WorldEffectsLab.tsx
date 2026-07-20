import type { WorldCommandInput, WorldTuning } from "../world";
import "./WorldEffectsLab.css";

export type WorldEffect = "view" | "backdrop" | "travel" | "turn" | "rocks" | "art";

export interface WorldEffectsLabProps {
  activeEffect: WorldEffect;
  tuning: WorldTuning;
  onActiveEffectChange: (effect: WorldEffect) => void;
  onClose: () => void;
  onCommand: (command: WorldCommandInput) => void;
  onTuningChange: (next: WorldTuning) => void;
}

const EFFECTS: readonly { id: WorldEffect; label: string; eyebrow: string }[] = [
  { id: "view", label: "2.5D view", eyebrow: "01" },
  { id: "backdrop", label: "Sprite match", eyebrow: "02" },
  { id: "travel", label: "Travel", eyebrow: "03" },
  { id: "turn", label: "World turn", eyebrow: "04" },
  { id: "rocks", label: "Silhouette", eyebrow: "05" },
  { id: "art", label: "Art layers", eyebrow: "06" },
];

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="world-lab__range">
      <span><b>{label}</b><output>{value.toFixed(2)}{unit}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

export function WorldEffectsLab({
  activeEffect,
  tuning,
  onActiveEffectChange,
  onClose,
  onCommand,
  onTuningChange,
}: WorldEffectsLabProps) {
  const patch = (values: Partial<WorldTuning>) => onTuningChange({ ...tuning, ...values });

  return (
    <aside className="world-lab" aria-label="World effects lab">
      <header className="world-lab__header">
        <div><span>Live scene workshop</span><h2>World Effects Lab</h2></div>
        <button type="button" onClick={onClose} aria-label="Close world effects lab">×</button>
      </header>

      <nav className="world-lab__tabs" aria-label="Effects">
        {EFFECTS.map((effect) => (
          <button
            type="button"
            key={effect.id}
            className={activeEffect === effect.id ? "is-active" : undefined}
            onClick={() => onActiveEffectChange(effect.id)}
          >
            <span>{effect.eyebrow}</span>{effect.label}
          </button>
        ))}
      </nav>

      <section className="world-lab__body">
        {activeEffect === "view" && <>
          <p>The camera stays locked above the near rim. Height and pitch change the authored 2.5D projection without introducing free orbit controls.</p>
          <RangeControl label="Camera height" value={tuning.cameraHeight} min={0.75} max={1.45} step={0.05} unit="×" onChange={(value) => patch({ cameraHeight: value })} />
          <RangeControl label="Downward tilt" value={tuning.cameraTilt} min={0.7} max={1.5} step={0.05} unit="×" onChange={(value) => patch({ cameraTilt: value })} />
          <label className="world-lab__switch">
            <input type="checkbox" checked={tuning.depthGridEnabled} onChange={(event) => patch({ depthGridEnabled: event.currentTarget.checked })} />
            <span>Show near / mid / far placement grid</span>
          </label>
        </>}

        {activeEffect === "backdrop" && <>
          <p>Separate watercolor plates move at different rates. Global sprite calibration brings cutout color and transparency into the same painted atmosphere.</p>
          <RangeControl label="Parallax depth" value={tuning.parallaxDepth} min={0} max={1.8} step={0.05} onChange={(value) => patch({ parallaxDepth: value })} />
          <RangeControl label="Sprite opacity" value={tuning.spriteOpacity} min={0.2} max={1} step={0.05} unit="×" onChange={(value) => patch({ spriteOpacity: value })} />
          <RangeControl label="Sprite saturation" value={tuning.spriteSaturation} min={0.35} max={1.35} step={0.05} unit="×" onChange={(value) => patch({ spriteSaturation: value })} />
          <RangeControl label="Sprite warmth" value={tuning.spriteWarmth} min={0} max={0.45} step={0.03} unit="×" onChange={(value) => patch({ spriteWarmth: value })} />
          <label className="world-lab__switch">
            <input type="checkbox" checked={tuning.backdropEnabled} onChange={(event) => patch({ backdropEnabled: event.currentTarget.checked })} />
            <span>Use imported watercolor layers</span>
          </label>
        </>}

        {activeEffect === "travel" && <>
          <p>The world advances beneath a fixed camera. Near islands lead, distant art lags, and passed geometry leaves the active scene after arrival.</p>
          <RangeControl label="Travel duration" value={tuning.travelDuration} min={0.55} max={1.15} step={0.05} unit="×" onChange={(value) => patch({ travelDuration: value })} />
          <RangeControl label="Motion blur" value={tuning.motionBlur} min={0} max={1} step={0.05} unit="×" onChange={(value) => patch({ motionBlur: value })} />
          <button className="world-lab__action" type="button" onClick={() => onCommand({ type: "travel-next" })}>Run next island</button>
        </>}

        {activeEffect === "turn" && <>
          <p>A slow 180° roll reads like a sunset arc. The incoming world starts entering at the 90° horizon.</p>
          <RangeControl label="Turn duration" value={tuning.turnDuration} min={0.65} max={1.8} step={0.05} unit="×" onChange={(value) => patch({ turnDuration: value })} />
          <div className="world-lab__actions">
            <button className="world-lab__action" type="button" onClick={() => onCommand({ type: "turn", direction: -1 })}>Turn left</button>
            <button className="world-lab__action" type="button" onClick={() => onCommand({ type: "turn", direction: 1 })}>Turn right</button>
          </div>
        </>}

        {activeEffect === "rocks" && <>
          <p>Compare deterministic platform silhouettes from the same locked high camera. A preset rebuilds only the current scene.</p>
          <div className="world-lab__segments" role="group" aria-label="Rock silhouette">
            {(["soft", "storybook", "shattered"] as const).map((profile) => (
              <button type="button" key={profile} className={tuning.rockProfile === profile ? "is-active" : undefined} onClick={() => patch({ rockProfile: profile })}>{profile}</button>
            ))}
          </div>
        </>}

        {activeEffect === "art" && <>
          <p>Strip the scene back in stages. Flat materials make platform contours easier to match; background-only mode removes every gameplay mesh.</p>
          <label className="world-lab__switch">
            <input type="checkbox" checked={tuning.texturesEnabled} onChange={(event) => patch({ texturesEnabled: event.currentTarget.checked })} />
            <span>Painted surface textures</span>
          </label>
          <label className="world-lab__switch">
            <input type="checkbox" checked={tuning.detailsEnabled} onChange={(event) => patch({ detailsEnabled: event.currentTarget.checked })} />
            <span>Platform purpose details</span>
          </label>
          <label className="world-lab__switch">
            <input type="checkbox" checked={tuning.platformsEnabled} onChange={(event) => patch({ platformsEnabled: event.currentTarget.checked })} />
            <span>Gameplay platforms and bridges</span>
          </label>
        </>}
      </section>

      <footer className="world-lab__footer">
        <span>Press L to toggle this lab</span>
        <div><a href="/labs/index.html">Standalone labs ↗</a><button type="button" onClick={() => onCommand({ type: "reset" })}>Reset scene</button></div>
      </footer>
    </aside>
  );
}
