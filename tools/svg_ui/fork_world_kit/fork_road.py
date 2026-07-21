#!/usr/bin/env python3
"""Generate a style-matched, semantically labelled road-fork overlay.

The original implementation drew useful fork art but emitted one anonymous
``<g class="fork">``.  That made a fork visually present while losing its
meaning to later SVG/depth/Three.js stages.  This version treats the spline as
the source of truth and gives every generated feature a stable selector:

    #fork-near-left
    #fork-near-left-road
    #fork-near-left-land
    [data-fork-id="fork-near-left"]
    [data-feature="fork-road"]

The sibling JSON records exact splines, part bounding boxes, the intended
graph-edge role, and the depth slice.  Generation itself uses only the Python
standard library.  ``--scene`` snapping is optional and retains the old image
stack dependency (CairoSVG + NumPy + Pillow).

Usage:
  python fork_road.py slices/slices.json road_style.json fork_left.svg \
      --fork-id fork-near-left --attach-y 0.72 --side left \
      --exit-y 0.48 --seed 3 --next scene_left_viewer.html
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import tempfile
from pathlib import Path
from typing import Iterable


Point = tuple[float, float]
BBox = tuple[float, float, float, float]


def slug(value: str) -> str:
    """Return a stable SVG/XML-safe id fragment."""
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-")
    return clean or "fork"


def bbox_of(points: Iterable[Point]) -> BBox:
    pts = list(points)
    return (
        min(p[0] for p in pts),
        min(p[1] for p in pts),
        max(p[0] for p in pts),
        max(p[1] for p in pts),
    )


def union_bbox(boxes: Iterable[BBox]) -> BBox:
    boxes = list(boxes)
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def bbox_json(box: BBox, width: float, height: float) -> dict:
    x0, y0, x1, y1 = box
    return {
        "pixels": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
        "normalized": [
            round(x0 / width, 4),
            round(y0 / height, 4),
            round(x1 / width, 4),
            round(y1 / height, 4),
        ],
    }


def bbox_attr(box: BBox) -> str:
    return " ".join(f"{v:.1f}" for v in box)


def blob_outline(pts: list[Point], rng: random.Random, amp: float, seg: int = 8) -> list[Point]:
    """Subdivide a polygon and jitter it into a VTracer-like outline."""
    out: list[Point] = []
    for i, (x0, y0) in enumerate(pts):
        x1, y1 = pts[(i + 1) % len(pts)]
        for k in range(seg):
            t = k / seg
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            out.append((x + rng.uniform(-amp, amp), y + rng.uniform(-amp, amp)))
    return out


def strip(center: list[Point], half_w: list[float], rng: random.Random, amp: float) -> list[Point]:
    """Build the left/right outline around a centerline."""
    left: list[Point] = []
    right: list[Point] = []
    width_noise = 1.0
    for i, (x, y) in enumerate(center):
        width_noise = max(0.75, min(1.35, width_noise + rng.uniform(-0.09, 0.09)))
        w = half_w[i] * width_noise
        if i == 0:
            dx, dy = center[1][0] - x, center[1][1] - y
        else:
            dx, dy = x - center[i - 1][0], y - center[i - 1][1]
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        left.append((x + nx * w + rng.uniform(-amp, amp), y + ny * w + rng.uniform(-amp, amp)))
        right.append((x - nx * w + rng.uniform(-amp, amp), y - ny * w + rng.uniform(-amp, amp)))
    return left + right[::-1]


def _snap_to_scene(scene: str, ax: float, ay: float, width: float, height: float) -> Point:
    """Optionally snap an attachment to road pixels in a rendered SVG."""
    try:
        import cairosvg  # type: ignore
        import numpy as np  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "--scene snapping needs cairosvg, numpy, and pillow; omit --scene "
            "to attach directly to the tracked road spline"
        ) from exc

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = tmp.name
        cairosvg.svg2png(url=scene, write_to=tmp_path, output_width=600)
        image = np.array(Image.open(tmp_path).convert("RGB")).astype(float)
        h2, w2, _ = image.shape
        rr, gg, bb = image[..., 0], image[..., 1], image[..., 2]
        road = (rr > 150) & (rr < 250) & (rr > bb + 25) & (gg > bb + 8) & (bb > 70)
        ys, xs = np.where(road)
        if not len(xs):
            return ax, ay
        distance = (xs - ax / width * w2) ** 2 + (ys - ay / height * h2) ** 2
        nearest = int(np.argmin(distance))
        return xs[nearest] / w2 * width, ys[nearest] / h2 * height
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def generate_fork(
    meta: dict,
    style: dict,
    *,
    attach_y: float = 0.62,
    side_name: str = "left",
    exit_y: float = 0.42,
    seed: int | None = None,
    next_scene: str | None = None,
    fork_id: str = "fork-left",
    scene: str | None = None,
) -> tuple[str, dict]:
    """Return ``(semantic_svg_group, metadata)`` for one fork."""
    width, height = float(meta["width"]), float(meta["height"])
    fork_id = slug(fork_id)
    rng = random.Random(seed)

    track = meta["track"]
    ax = min(track, key=lambda point: abs(point[1] - attach_y))[0] * width
    ay = attach_y * height
    if scene:
        ax, ay = _snap_to_scene(scene, ax, ay, width, height)

    side = -1 if side_name == "left" else 1
    ex = (-0.06 * width) if side < 0 else (1.06 * width)
    ey = exit_y * height

    width_bottom, width_top = 0.075 * width, 0.012 * width

    def road_width(y: float) -> float:
        depth = max(0.0, min(1.0, (y / height - 0.12) / 0.85))
        return width_top + (width_bottom - width_top) * depth**1.5

    point_count = 26
    center: list[Point] = [(ax - side * 0.022 * width, ay)]
    for i in range(point_count + 1):
        t = i / point_count
        eased = t * t * (3 - 2 * t)
        x = ax + (ex - ax) * eased + math.sin(t * math.pi * 2.2) * 0.025 * width * (1 - t)
        y = ay + (ey - ay) * t**0.85
        center.append((x, y))

    half_road = [
        road_width(y) * (0.55 + 0.45 * max(0.0, 1 - i / point_count)) / 2 * 1.7
        for i, (_, y) in enumerate(center)
    ]
    # Keep the shelf only modestly wider than the road.  The old 2.6x value
    # produced a foreground wall that hid the source scene, especially when a
    # left and right fork shared one junction.
    half_land = [half * 1.34 + 0.005 * width for half in half_road]
    amp = 0.004 * width
    grass, rock = style["grass"], style["rock"]

    parts: dict[str, list[dict]] = {"land": [], "underside": [], "road": [], "vegetation": []}
    counters: dict[str, int] = {}

    def add_polygon(part: str, role: str, points: list[Point], fill: str, opacity: float = 1.0) -> None:
        counters[role] = counters.get(role, 0) + 1
        element_id = f"{fork_id}-{role}-{counters[role]:02d}"
        box = bbox_of(points)
        d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in points) + " Z"
        opacity_attr = f' opacity="{opacity}"' if opacity < 1 else ""
        svg = (
            f'<path id="{element_id}" class="feature feature-fork-{part} {role}" '
            f'data-feature="fork-{part}" data-fork-id="{fork_id}" data-role="{role}" '
            f'data-bbox="{bbox_attr(box)}" d="{d}" fill="{fill}"{opacity_attr}/>'
        )
        parts[part].append({"id": element_id, "role": role, "bbox": box, "svg": svg})

    def add_circle(part: str, role: str, x: float, y: float, radius: float, fill: str, opacity: float) -> None:
        counters[role] = counters.get(role, 0) + 1
        element_id = f"{fork_id}-{role}-{counters[role]:02d}"
        box = (x - radius, y - radius, x + radius, y + radius)
        svg = (
            f'<circle id="{element_id}" class="feature feature-fork-{part} {role}" '
            f'data-feature="fork-{part}" data-fork-id="{fork_id}" data-role="{role}" '
            f'data-bbox="{bbox_attr(box)}" cx="{x:.1f}" cy="{y:.1f}" r="{radius:.1f}" '
            f'fill="{fill}" opacity="{opacity}"/>'
        )
        parts[part].append({"id": element_id, "role": role, "bbox": box, "svg": svg})

    land = strip(center, half_land, rng, amp * 1.6)
    add_polygon("land", "land-base", blob_outline(land, rng, amp * 1.4, 3), grass[0])
    inner = strip(center, [half * 0.8 for half in half_land], rng, amp)
    add_polygon("land", "land-inner", blob_outline(inner, rng, amp, 3), grass[1])
    for _ in range(10):
        idx = rng.randint(2, point_count - 2)
        cx, cy = center[idx]
        radius = half_land[idx] * rng.uniform(0.25, 0.55)
        ring = [
            (
                cx + math.cos(angle) * radius * rng.uniform(0.7, 1.3),
                cy + math.sin(angle) * radius * rng.uniform(0.5, 1.0),
            )
            for angle in [k * math.pi / 4 for k in range(8)]
        ]
        add_polygon("land", "land-patch", ring, rng.choice(grass[1:3]), 0.85)

    # A few restrained underside facets imply a floating shelf.  Dense,
    # full-height facets read as a cliff curtain and obscure the route.
    for idx in range(3, point_count, 4):
        x, y = center[idx]
        drop = half_land[idx] * rng.uniform(0.32, 0.68)
        jag_width = half_land[idx] * rng.uniform(0.34, 0.58)
        base_y = y + half_land[idx] * 0.68
        jag: list[Point] = [(x - jag_width, base_y)]
        teeth = rng.randint(2, 4)
        for tooth in range(teeth + 1):
            jag.append(
                (
                    x - jag_width + 2 * jag_width * tooth / teeth,
                    base_y + drop * rng.uniform(0.5, 1.0) * (1 - abs(tooth / teeth - 0.5)),
                )
            )
        jag.append((x + jag_width, base_y))
        add_polygon("underside", "rock-base", blob_outline(jag, rng, amp, 3), rng.choice(rock))
        highlight = [(px * 0.997 + x * 0.003, py * 0.92 + base_y * 0.08) for px, py in jag]
        add_polygon("underside", "rock-detail", blob_outline(highlight, rng, amp, 2), rock[0], 0.8)

    road_edge = strip(center, [half * 1.16 for half in half_road], rng, amp)
    add_polygon("road", "road-edge", blob_outline(road_edge, rng, amp, 3), style["road_dark"])
    road_main = strip(center, half_road, rng, amp * 0.8)
    add_polygon("road", "road-base", blob_outline(road_main, rng, amp * 0.8, 3), style["road_base"])
    road_highlight = strip(center, [half * 0.45 for half in half_road], rng, amp * 0.6)
    add_polygon(
        "road",
        "road-highlight",
        blob_outline(road_highlight, rng, amp * 0.6, 3),
        style["road_light"],
        0.85,
    )
    for _ in range(24):
        idx = rng.randint(0, point_count)
        x, y = center[idx]
        radius = max(1.2, half_road[idx] * rng.uniform(0.06, 0.16))
        add_circle(
            "road",
            "road-speckle",
            x + rng.uniform(-1, 1) * half_road[idx],
            y + rng.uniform(-0.7, 0.7) * half_road[idx],
            radius,
            style["road_dark"],
            0.5,
        )

    for _ in range(rng.randint(1, 2)):
        idx = rng.randint(3, point_count - 3)
        x, y = center[idx]
        offset = (half_road[idx] + half_land[idx]) * 0.55 * rng.choice([-1, 1])
        tree_x, tree_y = x + offset, y - half_land[idx] * 0.1
        tree_h = max(12.0, min(42.0, half_land[idx] * rng.uniform(0.34, 0.52)))
        tree = [(tree_x, tree_y - tree_h), (tree_x - tree_h * 0.38, tree_y), (tree_x + tree_h * 0.38, tree_y)]
        add_polygon("vegetation", "tree-base", blob_outline(tree, rng, amp, 4), grass[2])
        crown = [
            (tree_x, tree_y - tree_h),
            (tree_x - tree_h * 0.26, tree_y - tree_h * 0.35),
            (tree_x + tree_h * 0.26, tree_y - tree_h * 0.35),
        ]
        add_polygon("vegetation", "tree-highlight", blob_outline(crown, rng, amp * 0.7, 3), grass[1])

    all_boxes = [entry["bbox"] for entries in parts.values() for entry in entries]
    fork_box = union_bbox(all_boxes)
    slice_count = len(meta["slices"])
    bottom = min(1.0, (max(p[1] for p in center) + max(half_land)) / height)
    suggested_slice = 1 + min(
        slice_count - 2,
        int(max(0.0, (bottom - 0.18) / 0.82) ** 1.2 * (slice_count - 1)),
    )

    group_markup: list[str] = []
    # Underside is behind the walkable grass/road surface in paint order.
    for part in ("underside", "land", "road", "vegetation"):
        entries = parts[part]
        part_box = union_bbox(entry["bbox"] for entry in entries)
        group_markup.append(
            f'<g id="{fork_id}-{part}" class="feature feature-fork-{part}" '
            f'data-feature="fork-{part}" data-fork-id="{fork_id}" '
            f'data-bbox="{bbox_attr(part_box)}">\n'
            + "\n".join(entry["svg"] for entry in entries)
            + "\n</g>"
        )

    group_svg = (
        f'<g id="{fork_id}" class="feature feature-fork fork-{side_name}" '
        f'data-feature="fork" data-fork-id="{fork_id}" data-side="{side_name}" '
        f'data-attach-y="{ay / height:.4f}" data-suggested-slice="{suggested_slice}" '
        f'data-bbox="{bbox_attr(fork_box)}">\n'
        + "\n".join(group_markup)
        + "\n</g>"
    )

    normalized_spline = [[round(x / width, 4), round(y / height, 4)] for x, y in center]
    metadata = {
        "schema_version": 2,
        "fork_id": fork_id,
        "feature": "fork",
        "side": side_name,
        "attach": [round(ax / width, 4), round(ay / height, 4)],
        "exit": [round(center[-1][0] / width, 4), round(center[-1][1] / height, 4)],
        "spline": normalized_spline,
        "bbox": bbox_json(fork_box, width, height),
        "parts": {
            part: {
                "selector": f"#{fork_id}-{part}",
                "bbox": bbox_json(union_bbox(entry["bbox"] for entry in entries), width, height),
                "elements": [entry["id"] for entry in entries],
            }
            for part, entries in parts.items()
        },
        "suggested_slice": suggested_slice,
        "graph_edge": {
            "id": f"route-{fork_id}",
            "role": f"branch-{side_name}",
            "pts": normalized_spline,
            "exit": next_scene or "next_scene.html",
        },
        "selectors": {
            "fork": f"#{fork_id}",
            "road": f"#{fork_id}-road",
            "land": f"#{fork_id}-land",
            "underside": f"#{fork_id}-underside",
            "vegetation": f"#{fork_id}-vegetation",
        },
    }
    return group_svg, metadata


def write_fork(output: str | Path, group_svg: str, metadata: dict, width: int, height: int) -> None:
    output = Path(output)
    if output.suffix.lower() != ".svg":
        output = output.with_suffix(".svg")
    output.parent.mkdir(parents=True, exist_ok=True)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" data-semantic-schema="2">\n'
        f"{group_svg}\n</svg>\n"
    )
    output.write_text(svg, encoding="utf-8")
    output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("slices_json")
    parser.add_argument("style_json")
    parser.add_argument("output")
    parser.add_argument("--attach-y", type=float, default=0.62, help="fork split as canvas y fraction")
    parser.add_argument("--side", choices=["left", "right"], default="left")
    parser.add_argument("--exit-y", type=float, default=0.42, help="height where branch leaves canvas")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--next", default=None, help="viewer loaded when the branch exit is reached")
    parser.add_argument("--scene", default=None, help="optional SVG used to snap onto painted road pixels")
    parser.add_argument("--fork-id", default=None, help="stable semantic id; defaults to output filename")
    args = parser.parse_args()

    meta = json.loads(Path(args.slices_json).read_text(encoding="utf-8"))
    style = json.loads(Path(args.style_json).read_text(encoding="utf-8"))
    output = Path(args.output)
    fork_id = args.fork_id or f"fork-{args.side}-{slug(output.stem)}"
    group_svg, metadata = generate_fork(
        meta,
        style,
        attach_y=args.attach_y,
        side_name=args.side,
        exit_y=args.exit_y,
        seed=args.seed,
        next_scene=args.next,
        fork_id=fork_id,
        scene=args.scene,
    )
    write_fork(output, group_svg, metadata, int(meta["width"]), int(meta["height"]))
    print(
        f"wrote {output.with_suffix('.svg')} (+.json): {metadata['fork_id']} "
        f"{metadata['side']} {metadata['attach']} -> {metadata['exit']}; "
        f"slice {metadata['suggested_slice']}"
    )


if __name__ == "__main__":
    main()
