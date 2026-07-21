#!/usr/bin/env python3
"""Label traced SVG features without disturbing paint order.

VTracer writes one long, flat list of paths.  Reordering those paths into
feature buckets changes the picture, so this module provides two compatible
forms of grouping:

* every drawable gets stable ``id``, ``class``, ``data-feature`` and
  ``data-bbox`` attributes;
* the complete traced scene is wrapped once as ``#scene-base`` while generated
  forks remain explicit semantic groups next to it.

Road-coloured paths near a known spline also receive ``data-path-id`` and
``data-route-role``.  The JSON manifest is the authoritative mapping used by
the depth viewer and inspector.

Usage:
  python semantic_svg.py input.svg output.svg output.json \
      --track-json slices/slices.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable


NUMBER_RE = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")
DRAWABLE_RE = re.compile(r"<(?:path|circle|ellipse|rect|polygon|polyline)\b[^>]*>", re.I)
ATTR_RE = re.compile(r"([:\w-]+)\s*=\s*([\"'])(.*?)\2", re.S)


def attributes(tag: str) -> dict[str, str]:
    return {match.group(1): match.group(3) for match in ATTR_RE.finditer(tag)}


def replace_attributes(tag: str, updates: dict[str, str]) -> str:
    """Set attributes while retaining the original element and draw order."""
    result = tag
    for name, value in updates.items():
        pattern = re.compile(rf"\s{re.escape(name)}\s*=\s*([\"']).*?\1", re.S)
        escaped = value.replace("&", "&amp;").replace('"', "&quot;")
        if pattern.search(result):
            result = pattern.sub(f' {name}="{escaped}"', result, count=1)
        else:
            insert_at = result.rfind("/>")
            if insert_at < 0:
                insert_at = result.rfind(">")
            result = result[:insert_at] + f' {name}="{escaped}"' + result[insert_at:]
    return result


def canvas_size(source: str) -> tuple[int, int]:
    root = re.search(r"<svg\b[^>]*>", source, re.I)
    if not root:
        raise ValueError("input has no <svg> root")
    attrs = attributes(root.group(0))
    try:
        return int(float(attrs["width"])), int(float(attrs["height"]))
    except (KeyError, ValueError) as exc:
        view_box = [float(n) for n in NUMBER_RE.findall(attrs.get("viewBox", ""))]
        if len(view_box) == 4:
            return int(view_box[2]), int(view_box[3])
        raise ValueError("SVG needs numeric width/height or viewBox") from exc


def _translate(transform: str) -> tuple[float, float]:
    match = re.search(r"translate\(\s*([-+\d.eE]+)(?:[ ,]+([-+\d.eE]+))?\s*\)", transform or "")
    if not match:
        return 0.0, 0.0
    return float(match.group(1)), float(match.group(2) or 0.0)


def element_bbox(tag: str) -> tuple[float, float, float, float] | None:
    attrs = attributes(tag)
    name_match = re.match(r"<([\w:]+)", tag)
    name = name_match.group(1).split(":")[-1].lower() if name_match else ""
    tx, ty = _translate(attrs.get("transform", ""))
    try:
        if name == "path":
            numbers = [float(n) for n in NUMBER_RE.findall(attrs.get("d", ""))]
            if len(numbers) < 2:
                return None
            xs, ys = numbers[0::2], numbers[1::2]
            return min(xs) + tx, min(ys) + ty, max(xs) + tx, max(ys) + ty
        if name in {"polygon", "polyline"}:
            numbers = [float(n) for n in NUMBER_RE.findall(attrs.get("points", ""))]
            xs, ys = numbers[0::2], numbers[1::2]
            return min(xs) + tx, min(ys) + ty, max(xs) + tx, max(ys) + ty
        if name == "circle":
            cx, cy, radius = float(attrs["cx"]), float(attrs["cy"]), float(attrs["r"])
            return cx - radius + tx, cy - radius + ty, cx + radius + tx, cy + radius + ty
        if name == "ellipse":
            cx, cy = float(attrs["cx"]), float(attrs["cy"])
            rx, ry = float(attrs["rx"]), float(attrs["ry"])
            return cx - rx + tx, cy - ry + ty, cx + rx + tx, cy + ry + ty
        if name == "rect":
            x, y = float(attrs.get("x", 0)), float(attrs.get("y", 0))
            width, height = float(attrs["width"]), float(attrs["height"])
            return x + tx, y + ty, x + width + tx, y + height + ty
    except (KeyError, ValueError):
        return None
    return None


def fill_feature(fill: str | None, box: tuple[float, float, float, float], width: int, height: int) -> str:
    match = re.fullmatch(r"#?([0-9a-fA-F]{6})", fill or "")
    if not match:
        return "detail"
    r, g, b = (int(match.group(1)[index:index + 2], 16) for index in (0, 2, 4))
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    area = w * h
    center_y = (y0 + y1) / 2 / height
    high, low = max(r, g, b), min(r, g, b)
    if area > width * height * 0.25:
        return "sky"
    if r > 150 and r > g + 55 and r > b + 55 and area < width * height * 0.002:
        return "flag"
    light = low > 175 and high - low < 45
    pale_blue = b >= r and b > 185 and g > 175
    if (light or pale_blue) and center_y < 0.6 and area > 60:
        if h > w * 1.5 and b > r + 6 and w < width * 0.06:
            return "waterfall"
        return "cloud"
    if h > w * 1.5 and b > r + 6 and b > 185 and w < width * 0.06:
        return "waterfall"
    if b > r + 20 and b > 130:
        return "water"
    if r > 150 and r > b + 28 and b + 6 < g < r + 12 and b > 80:
        return "dirt"
    if g >= b and g > r * 0.75 and g > 55:
        return "vegetation"
    if high - low < 36:
        return "rock"
    return "detail"


def _point_rect_distance(point: tuple[float, float], box: tuple[float, float, float, float]) -> float:
    x, y = point
    x0, y0, x1, y1 = box
    dx = max(x0 - x, 0, x - x1)
    dy = max(y0 - y, 0, y - y1)
    return math.hypot(dx, dy)


def nearest_route(
    box: tuple[float, float, float, float],
    graph: dict | None,
    width: int,
    height: int,
) -> tuple[dict | None, float]:
    best_edge, best_distance = None, float("inf")
    if not graph:
        return best_edge, best_distance
    for edge in graph.get("edges", []):
        for x, y in edge.get("pts", []):
            distance = _point_rect_distance((x * width, y * height), box)
            if distance < best_distance:
                best_edge, best_distance = edge, distance
    return best_edge, best_distance


def _union(boxes: Iterable[tuple[float, float, float, float]]) -> list[float] | None:
    boxes = list(boxes)
    if not boxes:
        return None
    return [
        round(min(box[0] for box in boxes), 1),
        round(min(box[1] for box in boxes), 1),
        round(max(box[2] for box in boxes), 1),
        round(max(box[3] for box in boxes), 1),
    ]


def graph_from_track(track: list[list[float]], focal: list[float] | None = None) -> dict:
    points = sorted(track, key=lambda point: -point[1])
    if focal and (not points or points[-1] != focal):
        points.append(focal)
    return {
        "schema_version": 2,
        "source": "tracked-centerline",
        "nodes": [
            {"id": 0, "kind": "start", "label": "road-start", "x": points[0][0], "y": points[0][1]},
            {"id": 1, "kind": "destination", "label": "castle", "x": points[-1][0], "y": points[-1][1]},
        ],
        "edges": [
            {"id": "route-main-01", "a": 0, "b": 1, "role": "main", "pts": points}
        ],
        "start": 0,
        "castle": 1,
    }


def wrap_base_scene(source: str) -> str:
    if re.search(r'\bid=["\']scene-base["\']', source):
        return source
    root = re.search(r"<svg\b[^>]*>", source, re.I)
    close = source.lower().rfind("</svg>")
    if not root or close < 0:
        return source
    inner = source[root.end():close]
    preserved: list[str] = []

    def pull(match: re.Match[str]) -> str:
        preserved.append(match.group(0))
        return ""

    inner = re.sub(r"<(?:style|metadata)\b.*?</(?:style|metadata)>", pull, inner, flags=re.I | re.S)
    wrapped = (
        "\n".join(preserved)
        + '\n<g id="scene-base" class="semantic-layer scene-base" '
        + 'data-feature="base-scene" data-paint-order="preserved">'
        + inner
        + "</g>\n"
    )
    return source[:root.end()] + wrapped + source[close:]


def tag_svg_text(source: str, graph: dict | None = None, *, wrap_base: bool = True) -> tuple[str, list[dict]]:
    width, height = canvas_size(source)
    counters: Counter[str] = Counter()
    records: list[dict] = []

    def tag(match: re.Match[str]) -> str:
        original = match.group(0)
        attrs = attributes(original)
        box = element_bbox(original)
        if box is None:
            return original
        feature = attrs.get("data-feature")
        role = attrs.get("data-role")
        route_edge = None
        if not feature:
            feature = fill_feature(attrs.get("fill"), box, width, height)
            if feature == "dirt":
                candidate, distance = nearest_route(box, graph, width, height)
                short_side = max(1.0, min(box[2] - box[0], box[3] - box[1]))
                if candidate and distance <= max(6.0, short_side * 0.45):
                    feature = "road"
                    route_edge = candidate
                    role = candidate.get("role", "main")
        elif feature == "fork-road":
            route_edge, _ = nearest_route(box, graph, width, height)
            role = attrs.get("data-role", route_edge.get("role") if route_edge else "branch")

        counters[feature] += 1
        element_id = attrs.get("id") or f"feature-{feature}-{counters[feature]:04d}"
        classes = set(attrs.get("class", "").split())
        classes.update({"feature", f"feature-{feature}"})
        updates = {
            "id": element_id,
            "class": " ".join(sorted(classes)),
            "data-feature": feature,
            "data-bbox": " ".join(f"{value:.1f}" for value in box),
        }
        if route_edge:
            updates["data-path-id"] = str(route_edge.get("id", "route"))
            updates["data-route-role"] = str(route_edge.get("role", role or "main"))
        if role:
            updates["data-role"] = role
        tagged = replace_attributes(original, updates)
        records.append(
            {
                "id": element_id,
                "feature": feature,
                "role": role,
                "path_id": updates.get("data-path-id"),
                "fork_id": attrs.get("data-fork-id"),
                "bbox": [round(value, 1) for value in box],
            }
        )
        return tagged

    output = DRAWABLE_RE.sub(tag, source)
    if wrap_base:
        output = wrap_base_scene(output)
    root = re.search(r"<svg\b[^>]*>", output, re.I)
    if root:
        output = output[:root.start()] + replace_attributes(
            root.group(0), {"data-semantic-schema": "2"}
        ) + output[root.end():]
    return output, records


def build_manifest(
    records: list[dict],
    graph: dict | None,
    *,
    width: int,
    height: int,
    source: str,
    variant: str | None = None,
    forks: list[dict] | None = None,
) -> dict:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        grouped[record["feature"]].append(record)
    features = {
        feature: {
            "selector": f'[data-feature="{feature}"]',
            "count": len(items),
            "bbox": _union(tuple(item["bbox"]) for item in items),
            "elements": [item["id"] for item in items],
        }
        for feature, items in sorted(grouped.items())
    }
    return {
        "schema_version": 2,
        "source": source,
        "variant": variant,
        "canvas": {"width": width, "height": height},
        "selectors": {
            "base_scene": "#scene-base",
            "all_features": "[data-feature]",
            "forks": '[data-feature="fork"]',
            "roads": '[data-feature="road"], [data-feature="fork-road"]',
        },
        "features": features,
        "forks": forks or [],
        "road_network": graph,
        "elements": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("manifest")
    parser.add_argument("--track-json", help="slices.json containing a trusted trunk track")
    parser.add_argument("--graph-json", help="existing semantic road graph JSON")
    args = parser.parse_args()

    source_path = Path(args.input)
    source = source_path.read_text(encoding="utf-8")
    width, height = canvas_size(source)
    graph = None
    if args.graph_json:
        loaded = json.loads(Path(args.graph_json).read_text(encoding="utf-8"))
        graph = loaded.get("road_network", loaded.get("graph", loaded))
    elif args.track_json:
        track_meta = json.loads(Path(args.track_json).read_text(encoding="utf-8"))
        graph = graph_from_track(track_meta["track"], track_meta.get("focal"))

    tagged, records = tag_svg_text(source, graph)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(tagged, encoding="utf-8")
    manifest = build_manifest(
        records,
        graph,
        width=width,
        height=height,
        source=str(source_path).replace("\\", "/"),
    )
    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    summary = {feature: data["count"] for feature, data in manifest["features"].items()}
    print(f"wrote {output_path} and {manifest_path}")
    print("features:", json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
