import type { EventOption, LifeEvent } from "./lifeEvents";

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
}

/** Complete 25-map library, grouped by the meaning of a decision. */
export const DECISION_MAPS: readonly DecisionMap[] = [
  { id: "01_straight", label: "Clear road", kind: "straight", src: new URL("../../../../../tools/svg_ui/route_tile_library/svgs/01_straight.svg", import.meta.url).href },
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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectDecisionMap(event: LifeEvent, age: number): DecisionMap {
  return selectRouteMap(event.routeKind, `${event.id}:${age}`);
}

export function selectRouteMap(kind: DecisionRouteKind, seedKey: string): DecisionMap {
  const family = DECISION_MAPS.filter((map) => map.kind === kind);
  const candidates = family.length > 0 ? family : DECISION_MAPS;
  return candidates[stableHash(seedKey) % candidates.length]!;
}

export function directionsForOptions(
  options: readonly EventOption[],
  kind: DecisionRouteKind,
): RouteDirection[] {
  if (options.length <= 1) return ["straight"];
  if (options.length >= 3) {
    return ["left", "straight", "right", ...Array<RouteDirection>(options.length - 3).fill("winding")];
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
