#!/usr/bin/env python3
"""Generate grouped watercolor road worlds from a JSON route recipe.

This is the bridge between ``svg_grouper`` and procedural routes:

1. remove the traced master road while preserving the grouper-verified paint
   order of the remaining watercolor scene;
2. build main/branch splines from JSON tokens (straight, left, right, fork);
3. paint a layered watercolor corridor using palettes harvested from grouped
   ChatGPT-image traces;
4. reuse small grouped vegetation/rock regions as clipped watercolor sprites;
5. run ``group_svg_objects.py`` on every result and keep its zero-diff proof;
6. attach the exact route graph and stable feature selectors to the manifest.

Usage:
  py -3.11 generate_route_combinations.py route_recipes.json \
      generated/combinations --render
"""

from __future__ import annotations

import argparse
import html
import json
import math
import random
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

import group_svg_objects as grouper


Point = tuple[float, float]
PATH_RE = re.compile(r"<path\b[^>]*?/>", re.S)
ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')


def attrs(element: str) -> dict[str, str]:
    return dict(ATTR_RE.findall(element))


def luminance(color: str) -> float:
    value = int(color.lstrip("#"), 16)
    red, green, blue = value >> 16, (value >> 8) & 255, value & 255
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def palette(colors: list[str], fallback: list[str]) -> tuple[str, str, str]:
    valid = sorted({color.upper() for color in colors if re.fullmatch(r"#[0-9A-Fa-f]{6}", color)}, key=luminance)
    if len(valid) < 3:
        valid = fallback
    return valid[max(0, len(valid) // 6)], valid[len(valid) // 2], valid[min(len(valid) - 1, len(valid) * 5 // 6)]


def iter_subgroups(manifest: dict):
    for obj in manifest.get("objects", []):
        for subgroup in obj.get("subgroups", []):
            yield subgroup


def group_parts(svg: str, class_id: str) -> list[str]:
    pattern = re.compile(
        r'<g\b(?=[^>]*\bclass="' + re.escape(class_id) + r'")[^>]*>.*?</g>',
        re.S,
    )
    return pattern.findall(svg)


def choose_route_group(manifest: dict, svg: str) -> dict:
    candidates = []
    for subgroup in iter_subgroups(manifest):
        markup = "".join(group_parts(svg, subgroup["id"]))
        provenance = markup.count('data-generated-feature="road"')
        bbox = subgroup.get("bbox") or [0, 0, 0, 0]
        height = bbox[3] - bbox[1]
        road_hint = 1 if subgroup.get("label", "").startswith(("road", "route_network")) else 0
        candidates.append(
            (provenance, road_hint, height * subgroup.get("paths", 0), subgroup)
        )
    if not candidates:
        raise ValueError("manifest has no semantic subgroups")
    selected = max(candidates, key=lambda item: item[:3])
    if selected[0] == 0 and selected[1] == 0:
        raise ValueError("could not identify a route group")
    return selected[3]


def remove_group(svg: str, class_id: str) -> str:
    pattern = re.compile(
        r'<g\b(?=[^>]*\bclass="' + re.escape(class_id) + r'")[^>]*>.*?</g>',
        re.S,
    )
    return pattern.sub("", svg)


def polygon_area(poly: list[Point]) -> float:
    return abs(
        sum(
            poly[index][0] * poly[(index + 1) % len(poly)][1]
            - poly[(index + 1) % len(poly)][0] * poly[index][1]
            for index in range(len(poly))
        )
    ) / 2


def clip_polygon(poly: list[Point], bbox: list[float]) -> list[Point]:
    """Sutherland-Hodgman clip against a rectangle."""
    x0, y0, x1, y1 = bbox

    def clip(points: list[Point], inside, intersect) -> list[Point]:
        if not points:
            return []
        output: list[Point] = []
        previous = points[-1]
        previous_inside = inside(previous)
        for current in points:
            current_inside = inside(current)
            if current_inside:
                if not previous_inside:
                    output.append(intersect(previous, current))
                output.append(current)
            elif previous_inside:
                output.append(intersect(previous, current))
            previous, previous_inside = current, current_inside
        return output

    def ix(bound: float):
        return lambda a, b: (
            bound,
            a[1] + (b[1] - a[1]) * (bound - a[0]) / ((b[0] - a[0]) or 1e-9),
        )

    def iy(bound: float):
        return lambda a, b: (
            a[0] + (b[0] - a[0]) * (bound - a[1]) / ((b[1] - a[1]) or 1e-9),
            bound,
        )

    result = clip(poly, lambda p: p[0] >= x0, ix(x0))
    result = clip(result, lambda p: p[0] <= x1, ix(x1))
    result = clip(result, lambda p: p[1] >= y0, iy(y0))
    return clip(result, lambda p: p[1] <= y1, iy(y1))


def path_tag(poly: list[Point], fill: str, feature: str, route_id: str, opacity: float = 1.0) -> str:
    if len(poly) < 3:
        return ""
    data = "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in poly) + " Z"
    opacity_attr = f' opacity="{opacity:.3f}"' if opacity < 1 else ""
    return (
        f'<path d="{data}" fill="{fill}" data-generated-feature="{feature}" '
        f'data-route-id="{route_id}"{opacity_attr}/>'
    )


def smooth_polyline(anchors: list[Point], rng: random.Random, steps: int = 8) -> list[Point]:
    points: list[Point] = [anchors[0]]
    for index, (start, end) in enumerate(zip(anchors, anchors[1:])):
        bend = rng.uniform(-3.0, 3.0)
        for step in range(1, steps + 1):
            t = step / steps
            eased = t * t * (3 - 2 * t)
            x = start[0] + (end[0] - start[0]) * eased
            x += math.sin(math.pi * t) * bend
            y = start[1] + (end[1] - start[1]) * t
            points.append((x, y))
    return points


def normalize_token(token) -> dict:
    if isinstance(token, str):
        aliases = {
            "fork_left": {"type": "fork", "branches": ["left"], "take": "straight"},
            "fork_right": {"type": "fork", "branches": ["right"], "take": "straight"},
            "fork_both": {"type": "fork", "branches": ["left", "right"], "take": "straight"},
        }
        return aliases.get(token, {"type": token})
    return dict(token)


def build_route(path_tokens: list, width: int, height: int, rng: random.Random) -> tuple[list[Point], list[dict]]:
    tokens = [normalize_token(token) for token in path_tokens] or [{"type": "straight"}]
    start_y, upper_y = height * 1.03, height * 0.23
    anchors: list[Point] = [(width * 0.50, start_y)]
    events: list[dict] = []
    x = width * 0.50
    delta_y = (start_y - upper_y) / len(tokens)
    for index, token in enumerate(tokens):
        kind = token.get("type", "straight")
        direction = token.get("take", kind)
        if direction == "left":
            x -= width * 0.085
        elif direction == "right":
            x += width * 0.085
        else:
            x += rng.uniform(-width * 0.018, width * 0.018)
        x = max(width * 0.31, min(width * 0.69, x))
        next_point = (x, start_y - (index + 1) * delta_y)
        if kind == "fork":
            previous = anchors[-1]
            junction = (
                previous[0] + (next_point[0] - previous[0]) * 0.48,
                previous[1] + (next_point[1] - previous[1]) * 0.48,
            )
            events.append({"junction": junction, "branches": token.get("branches", ["left"])})
        anchors.append(next_point)
    anchors.append((width * 0.51, height * 0.115))
    main = smooth_polyline(anchors, rng)

    branches: list[dict] = []
    for event_index, event in enumerate(events, 1):
        junction = event["junction"]
        for side in event["branches"]:
            sign = -1 if side == "left" else 1
            endpoint = (
                -width * 0.055 if sign < 0 else width * 1.055,
                max(height * 0.10, junction[1] - height * 0.30),
            )
            control = (
                junction[0] + sign * width * 0.17,
                junction[1] - height * 0.095,
            )
            points = smooth_polyline([junction, control, endpoint], rng, steps=9)
            branches.append(
                {
                    "id": f"fork-{event_index:02d}-{side}",
                    "side": side,
                    "junction": junction,
                    "points": points,
                }
            )
    return main, branches


def half_road(y: float, height: int) -> float:
    depth = max(0.0, min(1.0, y / height))
    return 2.8 + 20.5 * depth**1.65


def strip(
    line: list[Point],
    factor: float,
    extra: float,
    rng: random.Random,
    jitter: float,
    height: int,
) -> list[Point]:
    left: list[Point] = []
    right: list[Point] = []
    for index, (x, y) in enumerate(line):
        if index == 0:
            dx, dy = line[1][0] - x, line[1][1] - y
        elif index == len(line) - 1:
            dx, dy = x - line[index - 1][0], y - line[index - 1][1]
        else:
            dx, dy = line[index + 1][0] - line[index - 1][0], line[index + 1][1] - line[index - 1][1]
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        radius = half_road(y, height) * factor + extra
        noise = rng.uniform(-jitter, jitter)
        left.append((x + nx * (radius + noise), y + ny * (radius + noise)))
        right.append((x - nx * (radius - noise), y - ny * (radius - noise)))
    return left + right[::-1]


def blob(cx: float, cy: float, radius: float, rng: random.Random, count: int = 8) -> list[Point]:
    return [
        (
            cx + math.cos(2 * math.pi * i / count) * radius * rng.uniform(0.65, 1.25),
            cy + math.sin(2 * math.pi * i / count) * radius * rng.uniform(0.45, 0.95),
        )
        for i in range(count)
    ]


def build_graph(main: list[Point], branches: list[dict], width: int, height: int) -> dict:
    junctions = []
    for branch in branches:
        match = next(
            (entry for entry in junctions if math.dist(entry["point"], branch["junction"]) < 2),
            None,
        )
        if match:
            match["branches"].append(branch)
        else:
            nearest = min(range(len(main)), key=lambda index: math.dist(main[index], branch["junction"]))
            junctions.append({"point": branch["junction"], "index": nearest, "branches": [branch]})
    junctions.sort(key=lambda entry: entry["index"])

    def norm(point: Point) -> list[float]:
        return [round(point[0] / width, 4), round(point[1] / height, 4)]

    nodes = [{"id": 0, "kind": "start", "x": norm(main[0])[0], "y": norm(main[0])[1]}]
    for number, junction in enumerate(junctions, 1):
        junction["node"] = number
        sides = sorted({branch["side"] for branch in junction["branches"]})
        nodes.append(
            {
                "id": number,
                "kind": "fork-both" if len(sides) > 1 else f"fork-{sides[0]}",
                "x": norm(junction["point"])[0],
                "y": norm(junction["point"])[1],
                "branches": [branch["id"] for branch in junction["branches"]],
            }
        )
    castle_id = len(nodes)
    nodes.append({"id": castle_id, "kind": "destination", "x": norm(main[-1])[0], "y": norm(main[-1])[1]})
    edges = []
    previous_index, previous_node = 0, 0
    for edge_number, marker in enumerate(junctions + [{"index": len(main) - 1, "node": castle_id}], 1):
        points = main[previous_index:marker["index"] + 1]
        if len(points) < 2:
            points = [main[previous_index], main[marker["index"]]]
        edges.append(
            {"id": f"main-{edge_number:02d}", "a": previous_node, "b": marker["node"], "role": "main", "pts": [norm(p) for p in points]}
        )
        previous_index, previous_node = marker["index"], marker["node"]
    next_node = castle_id + 1
    for junction in junctions:
        for branch in junction["branches"]:
            nodes.append(
                {"id": next_node, "kind": "exit", "side": branch["side"], "x": norm(branch["points"][-1])[0], "y": norm(branch["points"][-1])[1]}
            )
            edges.append(
                {"id": branch["id"], "a": junction["node"], "b": next_node, "role": f"branch-{branch['side']}", "pts": [norm(p) for p in branch["points"]]}
            )
            next_node += 1
    return {"nodes": nodes, "edges": edges, "start": 0, "castle": castle_id}


def make_sprite_bank(masters: list[dict], root: Path) -> tuple[dict[str, list[dict]], dict[str, list[str]]]:
    bank: dict[str, list[dict]] = defaultdict(list)
    colors: dict[str, list[str]] = defaultdict(list)
    for master in masters:
        svg = (root / master["svg"]).read_text(encoding="utf-8")
        manifest = json.loads((root / master["manifest"]).read_text(encoding="utf-8"))
        route = choose_route_group(manifest, svg)
        route_markup = "".join(group_parts(svg, route["id"]))
        colors["road"].extend(attrs(path).get("fill", "") for path in PATH_RE.findall(route_markup))
        for subgroup in iter_subgroups(manifest):
            label = subgroup.get("label", "")
            feature = next((name for name in ("vegetation", "rock", "terrain") if label.startswith(name)), None)
            if not feature or not subgroup.get("bbox"):
                continue
            box = subgroup["bbox"]
            box_width, box_height = box[2] - box[0], box[3] - box[1]
            colors[feature].extend(subgroup.get("top_colors", []))
            if not (8 <= box_width <= 130 and 8 <= box_height <= 115 and 2 <= subgroup.get("paths", 0) <= 14):
                continue
            markup = "".join(group_parts(svg, subgroup["id"]))
            polygons = []
            for element in PATH_RE.findall(markup):
                a = attrs(element)
                tx = ty = 0.0
                transform = re.search(r"translate\(([-\d.]+)[ ,]([-\d.]+)\)", a.get("transform", ""))
                if transform:
                    tx, ty = float(transform.group(1)), float(transform.group(2))
                for poly in grouper.flatten_path(a.get("d", ""), tx, ty):
                    clipped = clip_polygon(poly, box)
                    if len(clipped) >= 3 and polygon_area(clipped) > 1:
                        polygons.append((a.get("fill", "#777777"), clipped))
            if polygons:
                bank[feature].append({"id": subgroup["id"], "bbox": box, "polygons": polygons})
    return bank, colors


def place_sprite(sprite: dict, feature: str, x: float, y: float, target_height: float, mirror: bool, route_id: str) -> list[str]:
    box = sprite["bbox"]
    scale = target_height / max(1.0, box[3] - box[1])
    center_x = (box[0] + box[2]) / 2
    result = []
    for fill, polygon in sprite["polygons"]:
        transformed = []
        for px, py in polygon:
            local_x = (px - center_x) * scale * (-1 if mirror else 1)
            transformed.append((x + local_x, y + (py - box[3]) * scale))
        tag = path_tag(transformed, fill, feature, route_id)
        if tag:
            result.append(tag)
    return result


def paint_route(
    route_id: str,
    main: list[Point],
    branches: list[dict],
    bank: dict[str, list[dict]],
    colors: dict[str, list[str]],
    rng: random.Random,
    width: int,
    height: int,
) -> list[str]:
    road_dark, road_base, road_light = palette(colors["road"], ["#9B885B", "#CFB47A", "#F0D5A7"])
    land_dark, vegetation_base, _ = palette(colors["vegetation"], ["#48503A", "#77734A", "#8E855B"])
    terrain_dark, land_base, land_light = palette(colors["terrain"], ["#756C45", "#95894C", "#B5A45C"])
    rock_dark, rock_base, rock_light = palette(colors["rock"], ["#5C6268", "#7A7D7B", "#A4A39A"])
    lines = [("main", main)] + [(branch["id"], branch["points"]) for branch in branches]
    output: list[str] = []

    # Rock facets first. Branch shelves extend much farther below the grass
    # than the road corridor, making side routes read as paths on floating
    # land rather than beige ribbons suspended over the water.
    for line_id, line in lines[1:]:
        for index in range(5, len(line) - 2, 7):
            x, y = line[index]
            radius = half_road(y, height) * 2.20
            facet = [
                (x - radius * 0.80, y + radius * 0.50),
                (x + radius * 0.75, y + radius * 0.45),
                (x + radius * 0.35, y + radius * rng.uniform(2.05, 2.70)),
                (x - radius * 0.30, y + radius * rng.uniform(1.85, 2.45)),
            ]
            output.append(path_tag(facet, rng.choice([rock_dark, rock_base, rock_light]), "rock", route_id))

    for line_id, line in lines:
        is_branch = line_id != "main"
        outer = (2.70, 8.5, 3.2) if is_branch else (2.15, 6.5, 2.2)
        inner = (2.20, 5.5, 2.2) if is_branch else (1.72, 4.0, 1.4)
        output.append(path_tag(strip(line, outer[0], outer[1], rng, outer[2], height), land_dark, "landscape", route_id))
        output.append(path_tag(strip(line, inner[0], inner[1], rng, inner[2], height), land_base, "landscape", route_id))
    for line_id, line in lines:
        stride = 5 if line_id != "main" else 8
        for index in range(4, len(line) - 2, stride):
            x, y = line[index]
            radius = half_road(y, height) * rng.uniform(0.85, 1.45)
            side = rng.choice([-1, 1])
            for patch_side, color, opacity in (
                (side, land_light, 0.74),
                (-side, terrain_dark, 0.52),
                (side, vegetation_base, 0.38),
            ):
                output.append(
                    path_tag(
                        blob(
                            x + patch_side * radius * rng.uniform(1.55, 2.10),
                            y + rng.uniform(-radius * 0.20, radius * 0.20),
                            radius * rng.uniform(0.60, 1.05),
                            rng,
                        ),
                        color,
                        "landscape",
                        route_id,
                        opacity,
                    )
                )

    # All roads paint after all land, so two branches cannot cover each other.
    for _, line in lines:
        output.append(path_tag(strip(line, 1.16, 1.1, rng, 0.85, height), road_dark, "road", route_id))
        output.append(path_tag(strip(line, 1.00, 0.0, rng, 0.65, height), road_base, "road", route_id))
        output.append(path_tag(strip(line, 0.55, 0.0, rng, 0.5, height), road_light, "road", route_id, 0.92))
        for index in range(3, len(line) - 1, 5):
            x, y = line[index]
            radius = max(0.7, half_road(y, height) * rng.uniform(0.05, 0.10))
            output.append(path_tag(blob(x + rng.uniform(-half_road(y, height) * 0.6, half_road(y, height) * 0.6), y, radius, rng, 6), road_dark, "road", route_id, 0.38))

    # Reuse clipped watercolor groups from the ChatGPT-derived masters.
    candidate_lines = [main] + [branch["points"] for branch in branches]
    for line in candidate_lines:
        for index in range(6, len(line) - 4, 9):
            x, y = line[index]
            side = rng.choice([-1, 1])
            offset = half_road(y, height) * 1.62 + 4
            if bank["vegetation"]:
                sprite = rng.choice(bank["vegetation"])
                target_height = 7 + 20 * max(0.1, min(1.0, y / height))
                output.extend(place_sprite(sprite, "vegetation", x + side * offset, y, target_height, side < 0, route_id))
            if bank["terrain"]:
                sprite = rng.choice(bank["terrain"])
                target_height = 6 + 14 * max(0.1, min(1.0, y / height))
                output.extend(place_sprite(sprite, "landscape", x - side * offset * 0.55, y + 2, target_height, side > 0, route_id))
            if index % 18 == 6 and bank["rock"]:
                sprite = rng.choice(bank["rock"])
                target_height = 4 + 10 * max(0.1, min(1.0, y / height))
                output.extend(place_sprite(sprite, "rock", x - side * offset * 0.85, y + 2, target_height, side > 0, route_id))
    return [element for element in output if element]


def generated_group_map(svg: str, manifest: dict) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = defaultdict(list)
    for subgroup in iter_subgroups(manifest):
        markup = "".join(group_parts(svg, subgroup["id"]))
        counts = Counter(re.findall(r'data-generated-feature="([^"]+)"', markup))
        for feature, count in counts.items():
            if count:
                result[feature].append({"id": subgroup["id"], "paths": count, "bbox": subgroup.get("bbox")})
    for groups in result.values():
        groups.sort(key=lambda group: -group["paths"])
    return dict(result)


def canonicalize(
    grouped_path: Path,
    manifest_path: Path,
    recipe: dict,
    graph: dict,
) -> dict:
    svg = grouped_path.read_text(encoding="utf-8")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    feature_groups = generated_group_map(svg, manifest)
    road_groups = feature_groups.get("road", [])
    if not road_groups:
        raise ValueError(f"{grouped_path.name}: grouper did not retain generated road provenance")
    primary = road_groups[0]["id"]
    svg = svg.replace(primary, "route_network")
    for subgroup in iter_subgroups(manifest):
        if subgroup["id"] == primary:
            subgroup["id"] = "route_network"
            subgroup["label"] = "route_network"
    for group in road_groups:
        if group["id"] == primary:
            group["id"] = "route_network"

    semantic = {
        "schema_version": 1,
        "recipe_id": recipe["id"],
        "tokens": recipe["path"],
        "selectors": {
            "road": 'path[data-generated-feature="road"]',
            "landscape": 'path[data-generated-feature="landscape"]',
            "vegetation": 'path[data-generated-feature="vegetation"]',
            "rocks": 'path[data-generated-feature="rock"]',
            "primary_road_group": ".route_network",
        },
    }
    metadata = '<metadata id="route-recipe">' + html.escape(json.dumps(semantic, separators=(",", ":"))) + "</metadata>"
    root = re.search(r"<svg\b[^>]*>", svg)
    if root:
        svg = svg[:root.end()] + metadata + svg[root.end():]
    grouped_path.write_text(svg, encoding="utf-8")
    manifest.update(
        {
            "schema_version": 2,
            "recipe": recipe,
            "selectors": semantic["selectors"],
            "generated_groups": feature_groups,
            "road_graph": graph,
        }
    )
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("recipes")
    parser.add_argument("output_dir")
    parser.add_argument("--supersample", type=int, default=1)
    parser.add_argument("--render", action="store_true", help="render grouped previews with debug/render_diff.cjs")
    args = parser.parse_args()

    recipe_path = Path(args.recipes).resolve()
    root = recipe_path.parent
    config = json.loads(recipe_path.read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = Path.cwd() / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    preview_dir = output_dir / "previews"
    if args.render:
        preview_dir.mkdir(exist_ok=True)

    base_svg_path = root / config["base_master"]
    base_manifest_path = root / config["base_manifest"]
    base_svg = base_svg_path.read_text(encoding="utf-8")
    base_manifest = json.loads(base_manifest_path.read_text(encoding="utf-8"))
    width, height = base_manifest["canvas"]
    source_route = choose_route_group(base_manifest, base_svg)
    clean_source = remove_group(base_svg, source_route["id"])
    base_paths = PATH_RE.findall(clean_source)
    svg_open = re.search(r"<svg\b[^>]*>", base_svg).group(0)

    bank, colors = make_sprite_bank(config["style_masters"], root)
    print(
        f"base route {source_route['id']} removed; {len(base_paths)} underpaint paths; "
        f"sprite bank vegetation={len(bank['vegetation'])}, rock={len(bank['rock'])}"
    )

    index = {
        "schema_version": 1,
        "recipes": str(recipe_path).replace("\\", "/"),
        "selectors": {
            "road": 'path[data-generated-feature="road"]',
            "landscape": 'path[data-generated-feature="landscape"]',
            "vegetation": 'path[data-generated-feature="vegetation"]',
            "rocks": 'path[data-generated-feature="rock"]',
        },
        "variants": [],
    }
    grouper_script = Path(__file__).with_name("group_svg_objects.py")
    render_script = Path(__file__).with_name("debug") / "render_diff.cjs"

    for number, recipe in enumerate(config["variants"]):
        route_id = recipe["id"]
        rng = random.Random(config.get("seed", 1) + number * 1009)
        main_line, branches = build_route(recipe["path"], width, height, rng)
        generated = paint_route(route_id, main_line, branches, bank, colors, rng, width, height)
        graph = build_graph(main_line, branches, width, height)
        flat_path = output_dir / f"{route_id}.flat.svg"
        flat_path.write_text(
            svg_open + "\n" + "\n".join(base_paths + generated) + "\n</svg>\n",
            encoding="utf-8",
        )
        grouped_path = output_dir / f"{route_id}_grouped.svg"
        command = [
            sys.executable,
            str(grouper_script),
            str(flat_path),
            "-o",
            str(grouped_path),
            "--supersample",
            str(args.supersample),
        ]
        run = subprocess.run(command, check=True, capture_output=True, text=True)
        proof = next((line.strip() for line in run.stdout.splitlines() if "pixel diff vs original" in line), "verification missing")
        manifest_path = output_dir / f"{route_id}_groups.json"
        manifest = canonicalize(grouped_path, manifest_path, recipe, graph)
        preview = None
        if args.render:
            subprocess.run(["node", str(render_script), str(grouped_path)], check=True, capture_output=True, text=True)
            rendered = grouped_path.with_suffix(".render.png")
            preview_path = preview_dir / f"{route_id}.png"
            shutil.copyfile(rendered, preview_path)
            preview = str(preview_path.relative_to(output_dir)).replace("\\", "/")
        entry = {
            "id": route_id,
            "label": recipe.get("label", route_id),
            "tokens": recipe["path"],
            "flat_svg": flat_path.name,
            "grouped_svg": grouped_path.name,
            "groups": manifest_path.name,
            "overlay": f"{route_id}_overlay.svg",
            "preview": preview,
            "forks": len(branches),
            "graph_nodes": len(graph["nodes"]),
            "graph_edges": len(graph["edges"]),
            "verification": proof,
        }
        index["variants"].append(entry)
        print(f"{route_id:28s} paths={len(generated):3d} forks={len(branches)} {proof}")

    (output_dir / "manifest.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(index['variants'])} grouped watercolor combinations to {output_dir}")


if __name__ == "__main__":
    main()
