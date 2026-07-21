import { useMemo, type CSSProperties } from "react";
import "./ProceduralRouteWorld.css";

export type RouteDirection = -1 | 0 | 1;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface RouteGeometry {
  readonly landPath: string;
  readonly roadPath: string;
  readonly centerPath: string;
  readonly castle: Point;
  readonly centers: readonly Point[];
  readonly detailPoints: readonly Point[];
  readonly islands: readonly {
    x: number;
    y: number;
    scale: number;
    side: RouteDirection;
  }[];
}

export interface ProceduralRouteWorldProps {
  readonly seed: number;
  readonly choices: readonly RouteDirection[];
  readonly chapter: number;
  readonly destinationReady?: boolean;
  readonly completedStops?: number;
  readonly islandSpriteUrls?: readonly string[];
  readonly groundShelfSpriteUrls?: readonly string[];
  readonly interactive?: boolean;
  readonly motionEnabled?: boolean;
  readonly visible?: boolean;
  readonly onReachDestination?: () => void;
}

const ROUTE_Y = [1025, 865, 720, 590, 485, 405, 350] as const;
const LAND_WIDTHS = [690, 485, 330, 235, 165, 112, 76] as const;
const ROAD_WIDTHS = [340, 236, 156, 104, 70, 46, 30] as const;

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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothOpenPath(points: readonly Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  let path = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const next = points[index + 1]!;
    path += ` Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${((point.x + next.x) / 2).toFixed(1)} ${((point.y + next.y) / 2).toFixed(1)}`;
  }
  const last = points.at(-1)!;
  return `${path} L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
}

function ribbonPath(centers: readonly Point[], widths: readonly number[]) {
  const left = centers.map((point, index) => ({ x: point.x - (widths[index] ?? 0) / 2, y: point.y }));
  const right = centers.map((point, index) => ({ x: point.x + (widths[index] ?? 0) / 2, y: point.y })).reverse();
  const leftPath = smoothOpenPath(left);
  const rightPath = smoothOpenPath(right);
  return `${leftPath} L ${right[0]!.x.toFixed(1)} ${right[0]!.y.toFixed(1)} ${rightPath.replace(/^M [^LQ]+/, "")} Z`;
}

function buildRoute(seed: number): RouteGeometry {
  const random = createRandom(seed ^ 0x85ebca6b);
  const centers: Point[] = [{ x: 500, y: ROUTE_Y[0] }];
  let x = 500;

  for (let index = 1; index < ROUTE_Y.length; index += 1) {
    const directionRoll = random();
    const direction = directionRoll < .34 ? -1 : directionRoll > .66 ? 1 : 0;
    const perspectiveStep = 82 - index * 7;
    const ambientBend = (random() - .5) * (30 - index * 2);
    x = clamp(x + direction * perspectiveStep * .25 + ambientBend, 405 + index * 7, 595 - index * 7);
    centers.push({ x, y: ROUTE_Y[index]! });
  }

  const detailPoints = centers.slice(1, -1).map((point, index) => ({
    x: point.x + (index % 2 === 0 ? -1 : 1) * ((LAND_WIDTHS[index + 1] ?? 100) * .36),
    y: point.y - 10,
  }));
  const islands = Array.from({ length: 7 }, (_, index) => {
    const side: RouteDirection = index % 2 === 0 ? -1 : 1;
    const depth = index / 6;
    return {
      x: clamp(500 + side * (285 + random() * 155), 65, 935),
      y: 380 + depth * 430 + (random() - .5) * 74,
      scale: .34 + depth * .58 + random() * .13,
      side,
    };
  });

  return {
    landPath: ribbonPath(centers, LAND_WIDTHS),
    roadPath: ribbonPath(centers, ROAD_WIDTHS),
    centerPath: smoothOpenPath(centers),
    castle: centers.at(-1)!,
    centers,
    detailPoints,
    islands,
  };
}

function Island({ x, y, scale, url, flip = false }: { x: number; y: number; scale: number; url: string; flip?: boolean }) {
  return <g className="procedural-route-world__island" transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
    <image height="190" href={url} preserveAspectRatio="xMidYMid meet" width="220" x="-110" y="-82" />
  </g>;
}

function CastleMark() {
  return <svg aria-hidden="true" viewBox="-90 -130 180 150">
    <g className="procedural-route-world__castle-art">
      <path className="castle-shadow" d="M -88 10 C -55 -5 48 -8 88 10 L 65 25 L -66 25 Z" />
      <path className="castle-body" d="M -61 8 L -61 -68 L -38 -68 L -38 -91 L -19 -91 L -19 -62 L 18 -62 L 18 -102 L 39 -102 L 39 -67 L 63 -67 L 63 8 Z" />
      <path className="castle-roof" d="M -69 -68 L -49 -96 L -29 -68 Z M 8 -102 L 28 -130 L 49 -102 Z M 44 -67 L 63 -92 L 80 -67 Z" />
      <path className="castle-door" d="M -10 8 L -10 -25 Q 0 -42 10 -25 L 10 8 Z" />
      <path className="castle-window" d="M -50 -46 h 9 v 15 h -9 Z M 25 -78 h 8 v 15 h -8 Z M 53 -45 h 8 v 14 h -8 Z" />
      <path className="castle-flag" d="M 28 -130 v -22 l 25 8 l -25 8" />
    </g>
  </svg>;
}

export function ProceduralRouteWorld({
  seed,
  choices,
  chapter,
  destinationReady = false,
  completedStops = choices.length,
  islandSpriteUrls = [],
  groundShelfSpriteUrls = [],
  interactive = true,
  motionEnabled = true,
  visible = true,
  onReachDestination,
}: ProceduralRouteWorldProps) {
  const geometry = useMemo(() => buildRoute(seed), [seed]);
  const branchSegments = geometry.centers.slice(0, 5).flatMap((start, index) => {
    const end = geometry.centers[index + 1]!;
    return ([-1, 1] as const).map((side) => {
      const midpoint = {
        x: (start.x + end.x) / 2 + side * (150 - index * 16),
        y: (start.y + end.y) / 2 - 8,
      };
      const widths = [LAND_WIDTHS[index]! * .38, LAND_WIDTHS[index + 1]! * .42, LAND_WIDTHS[index + 1]! * .34];
      return {
        d: ribbonPath([start, midpoint, end], widths),
        index,
        midpoint,
        selected: choices[index] === side,
        side,
      };
    });
  });

  return <div
    aria-hidden={!visible}
    className={`procedural-route-world${motionEnabled ? " is-moving" : ""}${visible ? "" : " is-hidden"}`}
    style={{ "--castle-x": `${geometry.castle.x / 10}%`, "--castle-y": `${geometry.castle.y / 10}%` } as CSSProperties}
  >
    <svg className="procedural-route-world__scene" preserveAspectRatio="none" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="route-water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8bd3e5" stopOpacity=".18" />
          <stop offset=".32" stopColor="#56b9d5" stopOpacity=".74" />
          <stop offset="1" stopColor="#238db9" stopOpacity=".96" />
        </linearGradient>
        <linearGradient id="route-cliff" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8797a3" />
          <stop offset=".5" stopColor="#617c91" />
          <stop offset="1" stopColor="#3f617b" />
        </linearGradient>
        <linearGradient id="route-land" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#b7ca7f" />
          <stop offset=".58" stopColor="#9dbd69" />
          <stop offset="1" stopColor="#759c54" />
        </linearGradient>
        <linearGradient id="route-road" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f3db9e" />
          <stop offset="1" stopColor="#d8b875" />
        </linearGradient>
        <filter id="route-shadow" x="-30%" y="-20%" width="160%" height="170%">
          <feDropShadow dx="0" dy="18" floodColor="#174966" floodOpacity=".34" stdDeviation="13" />
        </filter>
        <symbol id="route-tree" viewBox="-18 -55 36 62">
          <path d="M -3 6 h 7 v -24 h -7 Z" fill="#725c3b" />
          <path d="M 0 -54 L -18 -18 H -8 L -17 -2 H 17 L 8 -18 H 18 Z" fill="#426f55" stroke="#315c4b" strokeWidth="3" />
        </symbol>
      </defs>

      <rect className="procedural-route-world__water" fill="url(#route-water)" height="700" width="1000" y="300" />
      <g className="procedural-route-world__waves">
        <path d="M -120 472 C 80 422 180 512 365 468 S 670 418 1120 470" />
        <path d="M -140 630 C 92 566 243 692 445 626 S 790 578 1140 635" />
        <path d="M -180 824 C 88 740 268 888 512 816 S 850 770 1180 826" />
        <path d="M -120 936 C 120 884 344 982 548 928 S 850 888 1120 930" />
      </g>

      <g className="procedural-route-world__side-islands" filter="url(#route-shadow)">
        {islandSpriteUrls.length > 0 && geometry.islands.map((island, index) => <Island
          {...island}
          flip={island.side > 0}
          key={index}
          url={islandSpriteUrls[index % islandSpriteUrls.length]!}
        />)}
      </g>

      <g className="procedural-route-world__branches" filter="url(#route-shadow)">
        {branchSegments.map((branch) => <g
          className={`procedural-route-world__branch is-${branch.side < 0 ? "left" : "right"}${branch.selected ? " is-selected" : ""}${branch.index < completedStops && !branch.selected ? " is-passed" : ""}`}
          key={`${branch.index}-${branch.side}`}
        >
          <path className="procedural-route-world__branch-cliff" d={branch.d} transform="translate(0 22)" />
          <path className="procedural-route-world__branch-land" d={branch.d} />
          <path className="procedural-route-world__branch-road" d={branch.d} />
          {groundShelfSpriteUrls.length > 0 && <image
            className="procedural-route-world__branch-shelf"
            height="150"
            href={groundShelfSpriteUrls[(branch.index * 2 + (branch.side > 0 ? 1 : 0)) % groundShelfSpriteUrls.length]!}
            preserveAspectRatio="xMidYMid meet"
            transform={`translate(${branch.midpoint.x} ${branch.midpoint.y}) scale(${branch.side > 0 ? -1 : 1} 1)`}
            width="210"
            x="-105"
            y="-72"
          />}
        </g>)}
      </g>

      <g className="procedural-route-world__main-land" filter="url(#route-shadow)">
        <path className="procedural-route-world__cliff" d={geometry.landPath} transform="translate(0 32)" />
        <path className="procedural-route-world__land" d={geometry.landPath} />
        <path className="procedural-route-world__road" d={geometry.roadPath} />
        <path className="procedural-route-world__route-stitch" d={geometry.centerPath} />
        {geometry.centers.slice(1, -1).map((point, index) => <g
          className={`procedural-route-world__stop${index < completedStops ? " is-complete" : ""}`}
          key={`stop-${index}`}
          transform={`translate(${point.x} ${point.y}) scale(${.42 + index * .09})`}
        >
          <ellipse cx="0" cy="7" rx="46" ry="17" />
          <circle cx="0" cy="0" r="31" />
          <text dominantBaseline="central" textAnchor="middle" x="0" y="1">{index + 1}</text>
        </g>)}
        {geometry.detailPoints.map((point, index) => index % 2 === 0
          ? <use href="#route-tree" key={index} transform={`translate(${point.x} ${point.y}) scale(${.55 + index * .12})`} />
          : <g className="procedural-route-world__rocks" key={index} transform={`translate(${point.x} ${point.y}) scale(${.55 + index * .1})`}><circle cx="-10" cy="0" r="12" /><circle cx="7" cy="3" r="9" /></g>)}
      </g>
    </svg>

    <button
      aria-label={interactive && destinationReady ? `Reach the chapter ${chapter} town and generate the next route` : `Chapter ${chapter} town unlocks after the route choices`}
      className="procedural-route-world__castle"
      disabled={!interactive || !destinationReady}
      onClick={onReachDestination}
      tabIndex={interactive ? 0 : -1}
      title={interactive && destinationReady ? "Reach town · generate the next route" : "Choose the route to reach this town"}
      type="button"
    >
      <CastleMark />
      <span>{destinationReady ? `Enter chapter ${chapter} town` : `Chapter ${chapter} town`}</span>
    </button>
  </div>;
}
