export type DecisionRouteKind =
  | "straight"
  | "curve"
  | "confusing"
  | "fork-left"
  | "fork-right"
  | "fork-both"
  | "network";

export type RouteDirection = "left" | "straight" | "right" | "winding";

export interface DecisionPathAnchor {
  id: string;
  x: number;
  y: number;
  direction: RouteDirection;
  /** Optional rule-branch binding for deliberately curated scenes. */
  branchId?: string;
}

export interface DecisionMap {
  id: string;
  label: string;
  kind: DecisionRouteKind;
  src: string;
  library?: "journey" | "pre-journey";
  pathCount?: number;
  paths?: readonly DecisionPathAnchor[];
}

/** Complete 25-map library, grouped by the meaning of a decision. */
export const DECISION_MAPS: readonly DecisionMap[] = [
  { id: "01_straight", label: "Clear road", kind: "straight", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/01_straight.svg", import.meta.url).href, library: "journey" },
  { id: "02_curve_left", label: "Gentle left curve", kind: "curve", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/02_curve_left.svg", import.meta.url).href },
  { id: "03_curve_right", label: "Gentle right curve", kind: "curve", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/03_curve_right.svg", import.meta.url).href },
  { id: "04_s_left_right", label: "Winding S road", kind: "curve", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/04_s_left_right.svg", import.meta.url).href },
  { id: "05_s_right_left", label: "Reverse winding road", kind: "curve", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/05_s_right_left.svg", import.meta.url).href },
  { id: "06_near_exit_left", label: "Near left fork", kind: "fork-left", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/06_near_exit_left.svg", import.meta.url).href },
  { id: "07_near_exit_right", label: "Near right fork", kind: "fork-right", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/07_near_exit_right.svg", import.meta.url).href },
  { id: "08_near_exits_both", label: "Three-way crossroads", kind: "fork-both", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/08_near_exits_both.svg", import.meta.url).href },
  { id: "09_mid_exit_left", label: "Middle left fork", kind: "fork-left", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/09_mid_exit_left.svg", import.meta.url).href },
  { id: "10_mid_exit_right", label: "Middle right fork", kind: "fork-right", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/10_mid_exit_right.svg", import.meta.url).href },
  { id: "11_far_exit_left", label: "Distant left fork", kind: "fork-left", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/11_far_exit_left.svg", import.meta.url).href },
  { id: "12_far_exit_right", label: "Distant right fork", kind: "fork-right", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/12_far_exit_right.svg", import.meta.url).href },
  { id: "13_near_loop_left", label: "Left loop", kind: "confusing", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/13_near_loop_left.svg", import.meta.url).href },
  { id: "14_near_loop_right", label: "Right loop", kind: "confusing", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/14_near_loop_right.svg", import.meta.url).href },
  { id: "15_mid_loop_left", label: "Distant left loop", kind: "confusing", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/15_mid_loop_left.svg", import.meta.url).href },
  { id: "16_mid_loop_right", label: "Distant right loop", kind: "confusing", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/16_mid_loop_right.svg", import.meta.url).href },
  { id: "17_diamond_rejoin", label: "Diamond route", kind: "confusing", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/17_diamond_rejoin.svg", import.meta.url).href },
  { id: "18_two_loops", label: "Double loop", kind: "confusing", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/18_two_loops.svg", import.meta.url).href },
  { id: "19_left_ingress_merge", label: "Left merge", kind: "fork-left", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/19_left_ingress_merge.svg", import.meta.url).href },
  { id: "20_right_ingress_merge", label: "Right merge", kind: "fork-right", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/20_right_ingress_merge.svg", import.meta.url).href },
  { id: "21_left_to_right_crossroute", label: "Four-way crossing", kind: "fork-both", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/21_left_to_right_crossroute.svg", import.meta.url).href },
  { id: "22_near_left_far_right", label: "Left then right", kind: "fork-left", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/22_near_left_far_right.svg", import.meta.url).href },
  { id: "23_far_crossroute", label: "Distant crossing", kind: "fork-both", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/23_far_crossroute.svg", import.meta.url).href },
  { id: "24_three_stage_network", label: "Crossroads and loop", kind: "network", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/24_three_stage_network.svg", import.meta.url).href },
  { id: "25_full_connector_hub", label: "Route hub", kind: "network", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/25_full_connector_hub.svg", import.meta.url).href },
] as const;

/**
 * Early-life scenes use the dedicated pre-journey library. These scenes are
 * intentionally selected by decision shape, rather than treated as decorative
 * backgrounds, so the rule-engine node controls which SVG is shown.
 */
export const PRE_JOURNEY_MAPS: readonly DecisionMap[] = [
  { id: "01_forest_threshold", label: "Forest threshold", kind: "fork-both", library: "pre-journey", pathCount: 2, paths: [{ id: "left-trail", x: 41, y: 55, direction: "left" }, { id: "right-trail", x: 61, y: 53, direction: "right" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/01_forest_threshold.svg", import.meta.url).href },
  { id: "02_sunlit_clearing", label: "Sunlit clearing", kind: "fork-both", library: "pre-journey", pathCount: 3, paths: [{ id: "left-meadow", x: 28, y: 52, direction: "left" }, { id: "center-meadow", x: 50, y: 51, direction: "straight" }, { id: "right-meadow", x: 72, y: 52, direction: "right" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/02_sunlit_clearing.svg", import.meta.url).href },
  { id: "03_streamside_choice", label: "Streamside choice", kind: "network", library: "pre-journey", pathCount: 3, paths: [{ id: "stepping-stones", x: 38, y: 57, direction: "left" }, { id: "log-crossing", x: 63, y: 50, direction: "straight" }, { id: "bank-trail", x: 78, y: 43, direction: "right" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/03_streamside_choice.svg", import.meta.url).href },
  { id: "04_two_way_fork", label: "Two-way dirt-path fork", kind: "fork-both", library: "pre-journey", pathCount: 2, paths: [{ id: "left-fork", x: 33, y: 47, direction: "left" }, { id: "right-fork", x: 67, y: 47, direction: "right" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/04_two_way_fork.svg", import.meta.url).href },
  { id: "05_path_exits_left", label: "Path exits left", kind: "fork-left", library: "pre-journey", pathCount: 1, paths: [{ id: "left-exit", x: 35, y: 51, direction: "left" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/05_path_exits_left.svg", import.meta.url).href },
  { id: "06_path_exits_right", label: "Path exits right", kind: "fork-right", library: "pre-journey", pathCount: 1, paths: [{ id: "right-exit", x: 65, y: 51, direction: "right" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/06_path_exits_right.svg", import.meta.url).href },
  { id: "07_left_straight_right", label: "Left / straight / right", kind: "fork-both", library: "pre-journey", pathCount: 3, paths: [{ id: "left-route", x: 24, y: 47, direction: "left" }, { id: "straight-route", x: 50, y: 48, direction: "straight" }, { id: "right-route", x: 76, y: 47, direction: "right" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/07_left_straight_right.svg", import.meta.url).href },
  { id: "08_far_left_near_left_straight", label: "Three-path fan", kind: "network", library: "pre-journey", pathCount: 3, paths: [{ id: "far-left", x: 18, y: 43, direction: "left" }, { id: "near-left", x: 40, y: 51, direction: "winding" }, { id: "straight-route", x: 62, y: 44, direction: "straight" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/08_far_left_near_left_straight.svg", import.meta.url).href },
  { id: "09_staged_left_straight_right", label: "Staged three-destination fork", kind: "network", library: "pre-journey", pathCount: 3, paths: [{ id: "left-route", x: 28, y: 53, direction: "left", branchId: "school" }, { id: "straight-route", x: 55, y: 43, direction: "straight", branchId: "work" }, { id: "right-route", x: 73, y: 39, direction: "right", branchId: "military" }], src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/09_staged_left_straight_right.svg", import.meta.url).href },
] as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectRouteMap(kind: DecisionRouteKind, seedKey: string): DecisionMap {
  const family = DECISION_MAPS.filter((map) => map.kind === kind);
  const candidates = family.length > 0 ? family : DECISION_MAPS;
  return candidates[stableHash(seedKey) % candidates.length]!;
}

export function selectDecisionMap(
  kind: DecisionRouteKind,
  seedKey: string,
  options: { preJourney?: boolean; branchCount?: number } = {},
): DecisionMap {
  if (!options.preJourney) {
    const map = selectRouteMap(kind, seedKey);
    const branchCount = Math.min(3, Math.max(1, options.branchCount ?? 2));
    return { ...map, library: "journey", pathCount: branchCount, paths: fallbackPathAnchors(branchCount, kind) };
  }

  const branchCount = options.branchCount ?? 2;
  if (seedKey.startsWith("hs-launch:")) return PRE_JOURNEY_MAPS.find((map) => map.id === "09_staged_left_straight_right")!;

  const desiredPaths = Math.min(3, Math.max(1, branchCount));
  const family = PRE_JOURNEY_MAPS.filter((map) => map.pathCount === desiredPaths);
  const candidates = family.length > 0 ? family : PRE_JOURNEY_MAPS;
  return candidates[stableHash(seedKey) % candidates.length]!;
}

function fallbackPathAnchors(count: number, kind: DecisionRouteKind): readonly DecisionPathAnchor[] {
  if (count === 1) return [{ id: "main-road", x: 50, y: 51, direction: kind === "fork-left" ? "left" : kind === "fork-right" ? "right" : "straight" }];
  if (count === 2) return kind === "fork-left"
    ? [{ id: "left-road", x: 31, y: 48, direction: "left" }, { id: "main-road", x: 57, y: 54, direction: "straight" }]
    : [{ id: "main-road", x: 43, y: 54, direction: "straight" }, { id: "right-road", x: 69, y: 48, direction: "right" }];
  return [
    { id: "left-road", x: 27, y: 45, direction: "left" },
    { id: "main-road", x: 50, y: 54, direction: "straight" },
    { id: "right-road", x: 73, y: 45, direction: "right" },
  ];
}

export function directionsForOptions(
  optionCount: number,
  kind: DecisionRouteKind,
): RouteDirection[] {
  if (optionCount <= 1) return ["straight"];
  if (optionCount >= 3) {
    return ["left", "straight", "right", ...Array<RouteDirection>(optionCount - 3).fill("winding")];
  }
  if (kind === "fork-left") return ["left", "straight"];
  if (kind === "fork-right") return ["straight", "right"];
  if (kind === "fork-both" || kind === "network") return ["left", "right"];
  return kind === "straight" ? ["straight", "straight"] : ["winding", "straight"];
}

export const ROUTE_DIRECTION_LABELS: Record<RouteDirection, string> = {
  left: "Left path",
  straight: "Stay the course",
  right: "Right path",
  winding: "Winding path",
};
