import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import spriteCatalogSource from "../../../../tools/svg/catalog.json";
import spriteStatsSource from "../../../../tools/svg/manifest.json";
import "./lab.css";
import {
  LayeredParallaxBackground,
  type LayeredParallaxBackgroundHandle,
} from "../world/background/layers/LayeredParallaxBackground";
import "./backgroundOnlyLab.css";

const referenceUrl = new URL("../../../../finished/ChatGPT Image Jul 20, 2026, 10_11_35 AM.png", import.meta.url).href;
const SVG_ASSET_MODULES = import.meta.glob<string>("../../../../tools/svg/sprites_svg/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
});
const STREAM_SLOT_COUNT = 26;
const DEFAULT_SEED = 42027;

type SpriteDepth = "far" | "mixed" | "mid" | "near" | "surface" | "foreground";
type SpritePlacement = "horizon" | "sky" | "world" | "edge" | "foreground";
type SpriteOcclusion = "none" | "edge" | "allowed";

interface CatalogGroup {
  readonly id: string;
  readonly label: string;
  readonly itemLabel: string;
  readonly description: string;
  readonly depth: SpriteDepth;
  readonly placement: SpritePlacement;
  readonly occlusion: SpriteOcclusion;
  readonly weight: number;
  readonly includeByDefault: boolean;
  readonly members: readonly string[];
}

interface CatalogFile {
  readonly version: number;
  readonly fallbackGroups: Readonly<Record<string, string>>;
  readonly groups: readonly CatalogGroup[];
  readonly labels: Readonly<Record<string, string>>;
}

interface SpriteStats {
  readonly role?: string;
  readonly w?: number;
  readonly h?: number;
  readonly aspect?: number;
}

interface SvgSprite {
  readonly id: string;
  readonly url: string;
  readonly label: string;
  readonly group: CatalogGroup;
  readonly width: number;
  readonly height: number;
  readonly aspect: number;
}

interface StreamSlot {
  readonly id: number;
  readonly phase: number;
  readonly side: -1 | 1;
  readonly lane: number;
  readonly sprite: SvgSprite;
  readonly occluding: boolean;
}

const CATALOG = spriteCatalogSource as CatalogFile;
const SPRITE_STATS = spriteStatsSource as Readonly<Record<string, SpriteStats>>;
const GROUPS = CATALOG.groups;
const GROUP_BY_ID = new Map(GROUPS.map((group) => [group.id, group]));
const MEMBER_GROUP = new Map(GROUPS.flatMap((group) => group.members.map((id) => [id, group.id] as const)));
const DEFAULT_GROUP_VISIBILITY = Object.fromEntries(GROUPS.map((group) => [group.id, group.includeByDefault])) as Record<string, boolean>;

function groupForSprite(id: string) {
  const stats = SPRITE_STATS[id];
  const groupId = MEMBER_GROUP.get(id) ?? (stats?.role ? CATALOG.fallbackGroups[stats.role] : undefined) ?? "unclassified";
  return GROUP_BY_ID.get(groupId) ?? GROUP_BY_ID.get("unclassified")!;
}

const SVG_LIBRARY: readonly SvgSprite[] = Object.entries(SVG_ASSET_MODULES).map(([path, url]) => {
  const filename = path.split("/").at(-1) ?? path;
  const id = filename.replace(/\.svg$/i, "");
  const stats = SPRITE_STATS[id];
  const group = groupForSprite(id);
  const ordinal = Math.max(1, group.members.indexOf(id) + 1);
  const width = stats?.w ?? 160;
  const height = stats?.h ?? 100;
  return {
    id,
    url,
    group,
    width,
    height,
    aspect: stats?.aspect ?? width / Math.max(1, height),
    label: CATALOG.labels[id] ?? `${group.itemLabel} ${String(ordinal).padStart(2, "0")}`,
  };
}).sort((left, right) => left.id.localeCompare(right.id));
const SVG_BY_ID = new Map(SVG_LIBRARY.map((sprite) => [sprite.id, sprite]));

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function pickSprite(random: () => number, pool: readonly SvgSprite[], previousId?: string) {
  if (pool.length === 0) return undefined;
  const counts = new Map<string, number>();
  pool.forEach((sprite) => counts.set(sprite.group.id, (counts.get(sprite.group.id) ?? 0) + 1));
  const weights = pool.map((sprite) => sprite.group.weight / (counts.get(sprite.group.id) ?? 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let cursor = random() * total;
    for (let index = 0; index < pool.length; index += 1) {
      cursor -= weights[index] ?? 0;
      if (cursor <= 0) {
        const candidate = pool[index];
        if (candidate && (pool.length === 1 || candidate.id !== previousId || attempt === 3)) return candidate;
        break;
      }
    }
  }
  return pool[0];
}

function createStreamSlots(seed: number, pool: readonly SvgSprite[], occlusionChance: number) {
  if (pool.length === 0) return [];
  const random = createRandom(seed);
  return Array.from({ length: STREAM_SLOT_COUNT }, (_, index): StreamSlot => {
    const sprite = pickSprite(random, pool)!;
    return {
      id: index,
      phase: (index + random() * .72) / STREAM_SLOT_COUNT,
      side: random() < .5 ? -1 : 1,
      lane: Math.floor(random() * 3),
      sprite,
      occluding: sprite.group.occlusion === "allowed" && random() < occlusionChance,
    };
  });
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return progress * progress * (3 - 2 * progress);
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function widthForSprite(sprite: SvgSprite) {
  switch (sprite.group.placement) {
    case "sky": return Math.min(46, Math.max(19, 14 + sprite.aspect * 4.2));
    case "horizon": return Math.min(33, Math.max(11, 10 + sprite.aspect * 4));
    case "world": return Math.min(27, Math.max(15, 13 + sprite.aspect * 3));
    case "edge": return Math.min(29, Math.max(16, 14 + sprite.aspect * 3));
    case "foreground": return Math.min(36, Math.max(18, 15 + sprite.aspect * 4));
  }
}

function motionFor(sprite: SvgSprite, side: -1 | 1, lane: number, occluding: boolean, depth: number, depthSpread: number) {
  const projection = Math.pow(depth, 1.52);
  const placement = sprite.group.placement;
  if (placement === "sky" && occluding) {
    return {
      x: mix(50 + side * (5 + lane * 3), 50 + side * (8 + lane * 4), projection),
      y: mix(36 + lane * 2, 55 + lane * 3.5, Math.pow(depth, 1.3)),
      scale: .12 + projection * 2.55 * depthSpread,
      z: 64 + Math.round(depth * 28),
    };
  }
  if (placement === "sky") {
    return {
      x: mix(50 + side * (19 + lane * 5), 50 + side * (57 + lane * 6), projection),
      y: mix(35 + lane * 3, 56 + lane * 5, Math.pow(depth, 1.34)),
      scale: .12 + projection * 2.14 * depthSpread,
      z: 24 + Math.round(depth * 35),
    };
  }
  if (placement === "horizon") {
    return {
      x: mix(50 + side * (9 + lane * 7), 50 + side * (42 + lane * 7), projection),
      y: mix(40.5 + lane, 70 + lane * 4, Math.pow(depth, 1.3)),
      scale: .13 + projection * 1.72 * depthSpread,
      z: 6 + Math.round(depth * 18),
    };
  }
  if (placement === "world") {
    return {
      x: mix(50 + side * (14 + lane * 6), 50 + side * (48 + lane * 8), projection),
      y: mix(40 + lane * 2, 76 + lane * 4, Math.pow(depth, 1.32)),
      scale: .12 + projection * 1.98 * depthSpread,
      z: 15 + Math.round(depth * 38),
    };
  }
  if (placement === "edge") {
    return {
      x: mix(side < 0 ? 18 : 82, side < 0 ? -10 : 110, projection),
      y: mix(44 + lane * 2, 82 + lane * 4, Math.pow(depth, 1.28)),
      scale: .11 + projection * 2.24 * depthSpread,
      z: 30 + Math.round(depth * 38),
    };
  }
  return {
    x: mix(side < 0 ? 30 : 70, side < 0 ? -8 : 108, projection),
    y: mix(49 + lane * 2, 91 + lane * 2, Math.pow(depth, 1.24)),
    scale: .1 + projection * 2.62 * depthSpread,
    z: 42 + Math.round(depth * 45),
  };
}

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="lab-control"><span>{label} <output>{value.toFixed(2)}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}

function BackgroundOnlyLab() {
  const backgroundRef = useRef<LayeredParallaxBackgroundHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRefs = useRef<Array<HTMLDivElement | null>>([]);
  const forwardPhaseRef = useRef(0);
  const recycledCountRef = useRef(0);
  const runtimeSignatureRef = useRef("");
  const runtimeSlotsRef = useRef<Array<{ spriteId: string; side: -1 | 1; lane: number; occluding: boolean }>>([]);
  const [showBackwall, setShowBackwall] = useState(true);
  const [showSvgStream, setShowSvgStream] = useState(true);
  const [enabledGroups, setEnabledGroups] = useState<Record<string, boolean>>({ ...DEFAULT_GROUP_VISIBILITY });
  const [worldSeed, setWorldSeed] = useState(DEFAULT_SEED);
  const [recycledCount, setRecycledCount] = useState(0);
  const [spriteOpacity, setSpriteOpacity] = useState(.88);
  const [spriteSaturation, setSpriteSaturation] = useState(.88);
  const [spriteWarmth, setSpriteWarmth] = useState(.1);
  const [parallax, setParallax] = useState(.65);
  const [referenceOpacity, setReferenceOpacity] = useState(.32);
  const [wipe, setWipe] = useState(50);
  const [showReference, setShowReference] = useState(false);
  const [difference, setDifference] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [depthSpread, setDepthSpread] = useState(1);
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [sector, setSector] = useState(0);
  const [continuousScroll, setContinuousScroll] = useState(true);
  const [forwardSpeed, setForwardSpeed] = useState(.08);
  const [occlusionChance, setOcclusionChance] = useState(.34);

  const activePool = useMemo(
    () => SVG_LIBRARY.filter((sprite) => enabledGroups[sprite.group.id]),
    [enabledGroups],
  );
  const streamSlots = useMemo(
    () => createStreamSlots(worldSeed, activePool, occlusionChance),
    [activePool, occlusionChance, worldSeed],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const signature = `${worldSeed}:${occlusionChance}:${activePool.map((sprite) => sprite.id).join(",")}`;
    if (runtimeSignatureRef.current !== signature) {
      runtimeSignatureRef.current = signature;
      runtimeSlotsRef.current = streamSlots.map((slot) => ({ spriteId: slot.sprite.id, side: slot.side, lane: slot.lane, occluding: slot.occluding }));
    }
    const previousDepths = streamSlots.map((slot) => (forwardPhaseRef.current + slot.phase) % 1);
    const currentSprites = streamSlots.map((slot, index) => SVG_BY_ID.get(runtimeSlotsRef.current[index]?.spriteId ?? "") ?? slot.sprite);
    const sides = streamSlots.map((slot, index) => runtimeSlotsRef.current[index]?.side ?? slot.side);
    const lanes = streamSlots.map((slot, index) => runtimeSlotsRef.current[index]?.lane ?? slot.lane);
    const occluders = streamSlots.map((slot, index) => runtimeSlotsRef.current[index]?.occluding ?? slot.occluding);
    const random = createRandom(worldSeed ^ 0x9e3779b9);
    let animationFrame = 0;
    let phase = forwardPhaseRef.current;
    let lastTime = performance.now();
    let recycleTotal = recycledCountRef.current;
    let lastReportedRecycle = recycleTotal;
    let lastReadoutUpdate = lastTime;

    const syncSpriteIdentity = (element: HTMLDivElement, index: number, sprite: SvgSprite) => {
      element.dataset.group = sprite.group.id;
      element.dataset.label = sprite.label;
      element.className = `background-only-stream__sprite is-${sprite.group.placement}${occluders[index] ? " is-occluding" : ""}`;
      const image = element.querySelector<HTMLImageElement>("img");
      const name = element.querySelector<HTMLElement>("[data-sprite-name]");
      const group = element.querySelector<HTMLElement>("[data-sprite-group]");
      if (image) image.src = sprite.url;
      if (name) name.textContent = sprite.label;
      if (group) group.textContent = `${sprite.group.label} · ${sprite.group.depth}`;
    };

    const assignSprite = (element: HTMLDivElement, index: number, sprite: SvgSprite) => {
      currentSprites[index] = sprite;
      sides[index] = random() < .5 ? -1 : 1;
      lanes[index] = Math.floor(random() * 3);
      occluders[index] = sprite.group.occlusion === "allowed" && random() < occlusionChance;
      runtimeSlotsRef.current[index] = { spriteId: sprite.id, side: sides[index] ?? 1, lane: lanes[index] ?? 0, occluding: occluders[index] ?? false };
      syncSpriteIdentity(element, index, sprite);
    };

    streamRefs.current.forEach((element, index) => {
      const sprite = currentSprites[index];
      if (element && sprite) syncSpriteIdentity(element, index, sprite);
    });

    const renderDepthField = (timestamp: number, advance: boolean) => {
      const elapsed = Math.min(.05, Math.max(0, (timestamp - lastTime) / 1000));
      lastTime = timestamp;
      if (advance) phase = (phase + elapsed * forwardSpeed) % 1;
      forwardPhaseRef.current = phase;

      const backwall = stage.querySelector<HTMLImageElement>('[data-layer="backwall"] .layered-parallax-background__image');
      if (backwall) backwall.style.transform = `scale(${(1 + phase * .036).toFixed(4)})`;

      streamRefs.current.forEach((element, index) => {
        if (!element) return;
        let sprite = currentSprites[index];
        if (!sprite) return;
        const slot = streamSlots[index];
        if (!slot) return;
        const depth = (phase + slot.phase) % 1;
        const fade = smoothstep(.012, .12, depth) * (1 - smoothstep(.84, 1, depth));

        if (depth < (previousDepths[index] ?? depth)) {
          const nextSprite = pickSprite(random, activePool, sprite.id);
          if (nextSprite) {
            assignSprite(element, index, nextSprite);
            sprite = nextSprite;
            recycleTotal += 1;
            recycledCountRef.current = recycleTotal;
          }
        }
        previousDepths[index] = depth;

        const side = sides[index] ?? 1;
        const lane = lanes[index] ?? 0;
        const occluding = occluders[index] ?? false;
        const motion = motionFor(sprite, side, lane, occluding, depth, depthSpread);
        const image = element.querySelector<HTMLImageElement>("img");
        const label = element.querySelector<HTMLElement>(".background-only-stream__label");
        const depthOpacity = sprite.group.depth === "far" ? .7 + depth * .22 : 1;
        element.style.width = `clamp(110px, ${widthForSprite(sprite).toFixed(2)}vw, 760px)`;
        element.style.opacity = showSvgStream ? (fade * spriteOpacity * depthOpacity).toFixed(3) : "0";
        element.style.zIndex = `${motion.z}`;
        element.style.transform = `translate3d(${motion.x.toFixed(2)}vw, ${motion.y.toFixed(2)}vh, 0) translate(-50%, -50%) rotate(${(side * mix(-1.4, 2.2, depth)).toFixed(2)}deg) scale(${motion.scale.toFixed(4)})`;
        if (image) image.style.filter = `blur(${mix(2.35, .03, depth).toFixed(2)}px) saturate(${spriteSaturation.toFixed(2)}) sepia(${(spriteWarmth * .25).toFixed(3)}) brightness(${(1.08 - depth * .08 + spriteWarmth * .1).toFixed(3)})`;
        if (label) {
          label.style.opacity = showLabels && depth > .1 && depth < .9 ? ".96" : "0";
          label.style.transform = `translateX(-50%) scale(${Math.min(2.6, 1 / Math.max(.38, motion.scale)).toFixed(3)})`;
        }
      });

      if (timestamp - lastReadoutUpdate > 1000 && recycleTotal !== lastReportedRecycle) {
        lastReadoutUpdate = timestamp;
        lastReportedRecycle = recycleTotal;
        setRecycledCount(recycleTotal);
      }
      if (advance) animationFrame = window.requestAnimationFrame((nextTimestamp) => renderDepthField(nextTimestamp, true));
    };

    renderDepthField(lastTime, continuousScroll);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activePool, continuousScroll, depthSpread, forwardSpeed, occlusionChance, showLabels, showSvgStream, spriteOpacity, spriteSaturation, spriteWarmth, streamSlots, worldSeed]);

  const chooseSector = (direction: -1 | 0 | 1) => {
    backgroundRef.current?.reset();
    if (direction !== 0) backgroundRef.current?.setSector(direction);
    setSector(direction);
  };
  const toggleGroup = (id: string) => setEnabledGroups((current) => ({ ...current, [id]: !current[id] }));
  const randomizeWorld = () => {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    setWorldSeed(value[0] ?? Date.now());
    setRecycledCount(0);
    recycledCountRef.current = 0;
    runtimeSignatureRef.current = "";
    forwardPhaseRef.current = 0;
  };
  const reset = () => {
    setShowBackwall(true);
    setShowSvgStream(true);
    setEnabledGroups({ ...DEFAULT_GROUP_VISIBILITY });
    setWorldSeed(DEFAULT_SEED);
    setRecycledCount(0);
    recycledCountRef.current = 0;
    runtimeSignatureRef.current = "";
    setSpriteOpacity(.88);
    setSpriteSaturation(.88);
    setSpriteWarmth(.1);
    setParallax(.65);
    setDepthSpread(1);
    setContinuousScroll(true);
    setForwardSpeed(.08);
    setOcclusionChance(.34);
    setShowLabels(false);
    setShowRoutes(true);
    forwardPhaseRef.current = 0;
    chooseSector(0);
  };
  const className = `background-only-composition${showBackwall ? "" : " hide-backwall"} hide-horizon hide-islands hide-foreground hide-cloud hide-island hide-floater`;
  const enabledGroupCount = GROUPS.filter((group) => enabledGroups[group.id]).length;
  const occludingCount = streamSlots.filter((slot) => slot.occluding).length;

  return <main className="lab-shell">
    <header className="lab-header">
      <a className="lab-back" href="/labs/index.html">← All labs</a>
      <div className="lab-heading"><span>Issue J · classified zero-mesh atmosphere</span><h1>Procedural SVG Depth Stream</h1></div>
      <span className="lab-number">10</span>
    </header>
    <div className="lab-stage background-only-stage" ref={stageRef}>
      <LayeredParallaxBackground
        className={className}
        intensity={parallax}
        ref={backgroundRef}
        visibleSpriteIds={[]}
        infiniteHorizon={false}
      />
      <div className="background-only-stream" aria-hidden="true">
        {streamSlots.map((slot, index) => <div
          className={`background-only-stream__sprite is-${slot.sprite.group.placement}${slot.occluding ? " is-occluding" : ""}`}
          data-group={slot.sprite.group.id}
          data-label={slot.sprite.label}
          key={`${worldSeed}-${slot.id}`}
          ref={(element) => { streamRefs.current[index] = element; }}
        >
          <img alt="" decoding="async" draggable={false} src={slot.sprite.url} />
          <span className="background-only-stream__label"><b data-sprite-name>{slot.sprite.label}</b><small data-sprite-group>{slot.sprite.group.label} · {slot.sprite.group.depth}</small></span>
        </div>)}
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
      <div className="lab-status">Seed {worldSeed} · {activePool.length} labeled SVGs · {streamSlots.length} live · {occludingCount} view-crossing clouds</div>
    </div>
    <aside className={`lab-panel background-only-panel${panelCollapsed ? " is-collapsed" : ""}`}>
      <button
        aria-expanded={!panelCollapsed}
        aria-label={panelCollapsed ? "Expand SVG stream controls" : "Collapse SVG stream controls"}
        className="background-only-panel__toggle"
        onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
        title={panelCollapsed ? "Show SVG stream controls" : "Hide SVG stream controls"}
        type="button"
      >{panelCollapsed ? "›" : "‹"}</button>
      <div className="background-only-panel__content">
        <p className="lab-panel__lead">Every recycled slot selects a labeled SVG by group weight, spawns it at depth, grows it toward the camera, then replaces it with a different library asset.</p>
        <div className="lab-seam">Source: tools/svg/sprites_svg/*.svg<br />Catalog: curated group → depth → placement → obstruction policy<br />New uncataloged files enter the conservative far-depth review group</div>
        <fieldset className="background-only-layers"><legend>Scene</legend>
          <label className="lab-check"><input type="checkbox" checked={showBackwall} onChange={(event) => setShowBackwall(event.currentTarget.checked)} /><span>Sunrise backwall</span></label>
          <label className="lab-check"><input type="checkbox" checked={showSvgStream} onChange={(event) => setShowSvgStream(event.currentTarget.checked)} /><span>Procedural SVG stream</span></label>
        </fieldset>
        <fieldset className="background-only-groups"><legend>SVG inclusion groups</legend>
          {GROUPS.map((group) => {
            const count = SVG_LIBRARY.filter((sprite) => sprite.group.id === group.id).length;
            return <label className="background-only-group" key={group.id} title={group.description}>
              <input type="checkbox" checked={Boolean(enabledGroups[group.id])} disabled={count === 0} onChange={() => toggleGroup(group.id)} />
              <span><b>{group.label}</b><small>{count} · {group.depth} · {group.occlusion === "allowed" ? "may obstruct" : group.occlusion}</small></span>
            </label>;
          })}
        </fieldset>
        <label className="lab-check"><input type="checkbox" checked={continuousScroll} onChange={(event) => setContinuousScroll(event.currentTarget.checked)} /><span>Continuous inward scroll</span></label>
        <label className="lab-check"><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.currentTarget.checked)} /><span>Show moving SVG labels</span></label>
        <Range label="Forward speed" value={forwardSpeed} min={.025} max={.2} step={.005} onChange={setForwardSpeed} />
        <Range label="Depth spread" value={depthSpread} min={.55} max={1.4} step={.05} onChange={setDepthSpread} />
        <Range label="Cloud obstruction" value={occlusionChance} min={0} max={.8} step={.05} onChange={setOcclusionChance} />
        <Range label="Parallax depth" value={parallax} min={0} max={1.4} step={.05} onChange={setParallax} />
        <Range label="SVG opacity" value={spriteOpacity} min={.2} max={1} step={.05} onChange={setSpriteOpacity} />
        <Range label="SVG saturation" value={spriteSaturation} min={.3} max={1.4} step={.05} onChange={setSpriteSaturation} />
        <Range label="SVG warmth" value={spriteWarmth} min={0} max={.5} step={.02} onChange={setSpriteWarmth} />
        <Range label="Reference wipe" value={wipe} min={0} max={100} step={1} onChange={setWipe} />
        <Range label="Reference opacity" value={referenceOpacity} min={.05} max={1} step={.05} onChange={setReferenceOpacity} />
        <label className="lab-check"><input type="checkbox" checked={showReference} onChange={(event) => setShowReference(event.currentTarget.checked)} /><span>Reference comparison</span></label>
        <label className="lab-check"><input type="checkbox" checked={difference} onChange={(event) => setDifference(event.currentTarget.checked)} /><span>Difference blend</span></label>
        <label className="lab-check"><input type="checkbox" checked={showRoutes} onChange={(event) => setShowRoutes(event.currentTarget.checked)} /><span>Route corridors</span></label>
        <label className="lab-check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.currentTarget.checked)} /><span>Composition grid</span></label>
        <div className="lab-buttons"><button className={`lab-button${sector < 0 ? " is-active" : ""}`} onClick={() => chooseSector(-1)}>45° left</button><button className={`lab-button${sector === 0 ? " is-active" : ""}`} onClick={() => chooseSector(0)}>Straight</button><button className={`lab-button${sector > 0 ? " is-active" : ""}`} onClick={() => chooseSector(1)}>45° right</button><button className="lab-button lab-button--primary" onClick={randomizeWorld}>New random world</button><button className="lab-button" onClick={reset}>Reset catalog</button></div>
        <div className="lab-readout"><div><span>Library</span><b>{SVG_LIBRARY.length}</b></div><div><span>Groups on</span><b>{enabledGroupCount}</b></div><div><span>Recycled</span><b>{recycledCount}</b></div></div>
      </div>
    </aside>
  </main>;
}

createRoot(document.getElementById("background-only-root")!).render(<StrictMode><BackgroundOnlyLab /></StrictMode>);
