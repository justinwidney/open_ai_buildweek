#!/usr/bin/env python3
"""Normalize image-generated route tiles, snap their seams, and trace SVGs.

The image model supplies natural route/land geometry. This post-pass supplies
the deterministic part it cannot guarantee: identical canvas dimensions and
edge sockets whose road center and perspective width agree pixel-for-pixel.

Usage:
  py -3.11 prepare_tile_library.py
  py -3.11 prepare_tile_library.py --skip-svg
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import vtracer


ROOT = Path(__file__).resolve().parent
ROAD_THRESHOLD = {
    "red_min": 175,
    "green_min": 155,
    "blue_max": 190,
    "red_blue_gap": 25,
    "green_blue_gap": 5,
}
TRACE_SETTINGS = {
    "filter_speckle": 8,
    "color_precision": 7,
    "layer_difference": 16,
    "corner_threshold": 60,
    "length_threshold": 4.0,
    "splice_threshold": 45,
    "path_precision": 2,
}


def road_mask(rgb: np.ndarray) -> np.ndarray:
    """Warm cream road pixels; intentionally excludes blue water and clouds."""
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (
        (red > ROAD_THRESHOLD["red_min"])
        & (green > ROAD_THRESHOLD["green_min"])
        & (blue < ROAD_THRESHOLD["blue_max"])
        & ((red.astype(int) - blue) > ROAD_THRESHOLD["red_blue_gap"])
        & ((green.astype(int) - blue) > ROAD_THRESHOLD["green_blue_gap"])
    )


def runs(mask: np.ndarray) -> list[tuple[int, int]]:
    result = []
    start = None
    for index, value in enumerate(mask):
        if value and start is None:
            start = index
        if start is not None and (not value or index == len(mask) - 1):
            end = index if not value else index + 1
            if end - start >= 3:
                result.append((start, end))
            start = None
    return result


def measure_side_socket(image: Image.Image, side: str, expected: float) -> dict:
    data = np.asarray(image.convert("RGB"))
    height, width = data.shape[:2]
    strip = data[:, :8] if side == "left" else data[:, width - 8 :]
    mask = road_mask(strip).mean(axis=1) >= 0.50
    candidates = []
    for start, end in runs(mask):
        center = (start + end) / 2
        normalized = center / height
        if 0.24 <= normalized <= 0.80:
            candidates.append(
                {
                    "start": start,
                    "end": end,
                    "center_px": center,
                    "center": normalized,
                    "width_px": end - start,
                    "width": (end - start) / height,
                }
            )
    if not candidates:
        raise ValueError(f"no cream road mouth detected on {side} edge near {expected:.3f}")
    nearby = [item for item in candidates if abs(item["center"] - expected) <= 0.10]
    if not nearby:
        nearby = candidates
    # Prefer the substantial cream run. Tiny highlights can sit even closer
    # to the expected center than the actual road surface.
    return min(
        nearby,
        key=lambda item: abs(item["center"] - expected) - 0.45 * item["width"],
    )


def snap_side_socket(
    image: Image.Image,
    side: str,
    measured: dict,
    target_center: float,
    target_width: float,
    strip_fraction: float = 0.12,
) -> Image.Image:
    """Taper a local vertical affine correction to zero inside the scene."""
    data = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width = data.shape[:2]
    strip_width = max(2, round(width * strip_fraction))
    result = data.copy()
    destination_y = np.arange(height, dtype=np.float32)
    target_center_px = target_center * height
    target_width_px = max(3.0, target_width * height)
    source_center_px = measured["center_px"]
    source_width_px = max(3.0, measured["width_px"])
    # Do not affine-warp the whole edge: only the route shelf needs moving.
    # This y feather prevents the sky and bottom corners from pinching.
    distance_y = np.abs(destination_y - target_center_px) / height
    y_weight = np.clip((0.22 - distance_y) / 0.10, 0.0, 1.0)

    columns = range(strip_width) if side == "left" else range(width - strip_width, width)
    for x in columns:
        distance = x if side == "left" else width - 1 - x
        weight = max(0.0, 1.0 - distance / (strip_width - 1)) ** 2
        edge_map = source_center_px + (destination_y - target_center_px) * (
            source_width_px / target_width_px
        )
        source_y = destination_y + weight * y_weight * (edge_map - destination_y)
        source_y = np.clip(source_y, 0, height - 1)
        for channel in range(3):
            result[:, x, channel] = np.interp(
                source_y, destination_y, data[:, x, channel]
            )
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8), "RGB")


def inject_metadata(svg_path: Path, metadata: dict) -> int:
    svg = svg_path.read_text(encoding="utf-8")
    count = len(re.findall(r"<path\b", svg))
    encoded = html.escape(json.dumps(metadata, separators=(",", ":")))
    root = re.search(r"<svg\b[^>]*>", svg)
    if not root:
        raise ValueError(f"{svg_path}: missing SVG root")
    new_root = root.group(0)[:-1] + f' data-route-tile="{metadata["id"]}">'
    block = f'<metadata id="route-tile">{encoded}</metadata>'
    svg = svg[: root.start()] + new_root + block + svg[root.end() :]
    svg_path.write_text(svg, encoding="utf-8")
    return count


def vectorize(png_path: Path, svg_path: Path, metadata: dict, size: tuple[int, int]) -> int:
    trace_source: Path | None = None
    with Image.open(png_path) as source:
        if source.size == size:
            input_path = png_path
        else:
            trace_source = svg_path.with_suffix(".trace.png")
            source.convert("RGB").resize(size, Image.Resampling.LANCZOS).save(trace_source)
            input_path = trace_source
    try:
        vtracer.convert_image_to_svg_py(
            str(input_path),
            str(svg_path),
            colormode="color",
            hierarchical="stacked",
            mode="spline",
            **TRACE_SETTINGS,
        )
    finally:
        if trace_source is not None:
            trace_source.unlink(missing_ok=True)
    return inject_metadata(svg_path, metadata)


def contact_sheet(items: list[dict], output: Path) -> None:
    thumb_width, thumb_height = 360, 208
    bar = 34
    columns = 5
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * thumb_width, rows * (thumb_height + bar)), "#172235")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, item in enumerate(items):
        col, row = index % columns, index // columns
        x, y = col * thumb_width, row * (thumb_height + bar)
        image = Image.open(ROOT / item["normalized_png"]).convert("RGB")
        image.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        sheet.paste(image, (x, y + bar))
        label = f'{item["id"]}  {" ".join(item["sockets"])}'
        draw.text((x + 8, y + 11), label, fill="#F4F7FA", font=font)
    sheet.save(output)


def seam_previews(items: list[dict], output_dir: Path) -> list[str]:
    by_socket: dict[str, list[dict]] = {}
    for item in items:
        for socket in item["sockets"]:
            by_socket.setdefault(socket, []).append(item)
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for level in ("0", "1", "2"):
        lefts = by_socket.get(f"L{level}", [])
        rights = by_socket.get(f"R{level}", [])
        if not lefts or not rights:
            continue
        left_tile = Image.open(ROOT / rights[0]["normalized_png"]).convert("RGB")
        right_tile = Image.open(ROOT / lefts[0]["normalized_png"]).convert("RGB")
        crop = 260
        preview = Image.new("RGB", (crop * 2, left_tile.height), "white")
        preview.paste(left_tile.crop((left_tile.width - crop, 0, left_tile.width, left_tile.height)), (0, 0))
        preview.paste(right_tile.crop((0, 0, crop, right_tile.height)), (crop, 0))
        draw = ImageDraw.Draw(preview)
        draw.line((crop, 0, crop, preview.height), fill="#FF2C86", width=2)
        name = f"socket_{level}_seam.png"
        preview.save(output_dir / name)
        results.append(f"seams/{name}")
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-svg", action="store_true")
    parser.add_argument("--resume", action="store_true", help="reuse SVGs that already contain route-tile metadata")
    args = parser.parse_args()

    config = json.loads((ROOT / "tile_recipes.json").read_text(encoding="utf-8"))
    canvas = tuple(config["normalized_canvas"])
    vector_canvas = tuple(config.get("vector_canvas", canvas))
    sockets = config["socket_contract"]
    normalized_dir = ROOT / "normalized"
    svg_dir = ROOT / "svgs"
    normalized_dir.mkdir(exist_ok=True)
    svg_dir.mkdir(exist_ok=True)

    items = []
    for recipe in config["variants"]:
        tile_id = recipe["id"]
        input_stem = recipe.get("file_stem", tile_id)
        raster_path = ROOT / "rasters" / f"{input_stem}.png"
        if not raster_path.exists():
            raise FileNotFoundError(raster_path)
        image = Image.open(raster_path).convert("RGB").resize(canvas, Image.Resampling.LANCZOS)
        seam_report = {}
        for socket_id in recipe["sockets"]:
            contract = sockets[socket_id]
            if contract["edge"] not in ("left", "right"):
                continue
            measured = measure_side_socket(image, contract["edge"], contract["center"])
            image = snap_side_socket(
                image,
                contract["edge"],
                measured,
                contract["center"],
                contract["road_width"],
            )
            snapped = measure_side_socket(image, contract["edge"], contract["center"])
            seam_report[socket_id] = {
                "measured_center": round(measured["center"], 4),
                "measured_width": round(measured["width"], 4),
                "target_center": contract["center"],
                "target_width": contract["road_width"],
                "snapped_center": round(snapped["center"], 4),
                "snapped_width": round(snapped["width"], 4),
            }

        normalized_path = normalized_dir / f"{tile_id}.png"
        image.save(normalized_path)
        metadata = {
            "schema_version": 1,
            "id": tile_id,
            "label": recipe["label"],
            "topology": recipe["topology"],
            "sockets": recipe["sockets"],
            "socket_contract": {name: sockets[name] for name in recipe["sockets"]},
        }
        svg_path = svg_dir / f"{tile_id}.svg"
        path_count = None
        if not args.skip_svg:
            existing = svg_path.read_text(encoding="utf-8") if svg_path.exists() else ""
            if args.resume and '<metadata id="route-tile">' in existing:
                path_count = len(re.findall(r"<path\b", existing))
            else:
                path_count = vectorize(normalized_path, svg_path, metadata, vector_canvas)
        item = {
            **metadata,
            "source_raster": f"rasters/{raster_path.name}",
            "normalized_png": f"normalized/{normalized_path.name}",
            "svg": f"svgs/{svg_path.name}" if not args.skip_svg else None,
            "svg_paths": path_count,
            "seam_report": seam_report,
            "compatible_sockets": {
                name: (
                    "R" + name[1:]
                    if name.startswith("L")
                    else "L" + name[1:]
                    if name.startswith("R")
                    else name
                )
                for name in recipe["sockets"]
            },
        }
        items.append(item)
        sockets_text = ",".join(recipe["sockets"])
        vector_text = f"{path_count} paths" if path_count is not None else "SVG skipped"
        print(f"{tile_id:30s} {sockets_text:18s} {vector_text}")

    contact_sheet(items, ROOT / "contact_sheet.png")
    seam_files = seam_previews(items, ROOT / "seams")
    manifest = {
        "schema_version": 1,
        "generation_mode": "OpenAI built-in image generation, one edit call per variant",
        "normalized_canvas": list(canvas),
        "vector_canvas": list(vector_canvas),
        "trace_settings": TRACE_SETTINGS,
        "socket_contract": sockets,
        "road_detection": ROAD_THRESHOLD,
        "contact_sheet": "contact_sheet.png",
        "seam_previews": seam_files,
        "tiles": items,
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} normalized tiles, manifest, contact sheet, and {len(seam_files)} seam previews")


if __name__ == "__main__":
    main()
