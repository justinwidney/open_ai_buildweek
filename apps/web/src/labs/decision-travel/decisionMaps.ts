export type DecisionRouteKind =
  | "straight"
  | "curve"
  | "confusing"
  | "fork-left"
  | "fork-right"
  | "fork-both"
  | "network";

export type RouteDirection = "left" | "straight" | "right" | "winding";

export interface DecisionMap {
  id: string;
  label: string;
  kind: DecisionRouteKind;
  src: string;
  library?: "journey" | "pre-journey";
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
  { id: "01_forest_threshold", label: "Forest threshold", kind: "fork-both", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/01_forest_threshold.svg", import.meta.url).href },
  { id: "02_sunlit_clearing", label: "Sunlit clearing", kind: "fork-both", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/02_sunlit_clearing.svg", import.meta.url).href },
  { id: "03_streamside_choice", label: "Streamside choice", kind: "network", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/03_streamside_choice.svg", import.meta.url).href },
  { id: "04_two_way_fork", label: "Two-way dirt-path fork", kind: "fork-both", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/04_two_way_fork.svg", import.meta.url).href },
  { id: "05_path_exits_left", label: "Path exits left", kind: "fork-left", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/05_path_exits_left.svg", import.meta.url).href },
  { id: "06_path_exits_right", label: "Path exits right", kind: "fork-right", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/06_path_exits_right.svg", import.meta.url).href },
  { id: "07_left_straight_right", label: "Left / straight / right", kind: "fork-both", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/07_left_straight_right.svg", import.meta.url).href },
  { id: "08_far_left_near_left_straight", label: "Three-path fan", kind: "network", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/08_far_left_near_left_straight.svg", import.meta.url).href },
  { id: "09_staged_left_straight_right", label: "Staged three-destination fork", kind: "network", library: "pre-journey", src: new URL("../../../../../tools/svg_ui/pre_journey_library/svgs/09_staged_left_straight_right.svg", import.meta.url).href },
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
  if (!options.preJourney) return selectRouteMap(kind, seedKey);

  const branchCount = options.branchCount ?? 2;
  const family = branchCount >= 4
    ? PRE_JOURNEY_MAPS.filter((map) => map.kind === "network")
    : branchCount === 3
      ? PRE_JOURNEY_MAPS.filter((map) => map.kind === "fork-both" || map.kind === "network")
      : PRE_JOURNEY_MAPS.filter((map) => map.kind === kind || (branchCount === 2 && map.id === "04_two_way_fork"));
  const candidates = family.length > 0 ? family : PRE_JOURNEY_MAPS;
  return candidates[stableHash(seedKey) % candidates.length]!;
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
