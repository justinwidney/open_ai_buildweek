#!/usr/bin/env python3
"""Structural verification for the generated route tile library."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    tiles = manifest["tiles"]
    assert len(tiles) == 25, f"expected 25 tiles, found {len(tiles)}"
    assert len({tile["id"] for tile in tiles}) == 25, "tile ids are not unique"
    expected_size = tuple(manifest["normalized_canvas"])
    expected_vector_size = tuple(manifest["vector_canvas"])
    socket_usage = set()

    for tile in tiles:
        tile_id = tile["id"]
        png_path = ROOT / tile["normalized_png"]
        svg_path = ROOT / tile["svg"]
        assert png_path.exists() and png_path.stat().st_size > 0, f"{tile_id}: PNG missing"
        assert svg_path.exists() and svg_path.stat().st_size > 0, f"{tile_id}: SVG missing"
        with Image.open(png_path) as image:
            assert image.size == expected_size, f"{tile_id}: wrong PNG canvas {image.size}"

        svg = svg_path.read_text(encoding="utf-8")
        root = re.search(r"<svg\b[^>]*>", svg)
        assert root, f"{tile_id}: SVG root missing"
        width = re.search(r'\bwidth="([0-9.]+)"', root.group(0))
        height = re.search(r'\bheight="([0-9.]+)"', root.group(0))
        vector_size = (int(float(width.group(1))), int(float(height.group(1)))) if width and height else None
        assert vector_size == expected_vector_size, f"{tile_id}: wrong SVG canvas {vector_size}"
        assert f'data-route-tile="{tile_id}"' in svg, f"{tile_id}: root id missing"
        match = re.search(r'<metadata id="route-tile">(.*?)</metadata>', svg, re.S)
        assert match, f"{tile_id}: route metadata missing"
        metadata = json.loads(html.unescape(match.group(1)))
        assert metadata["id"] == tile_id, f"{tile_id}: metadata id mismatch"
        assert metadata["sockets"] == tile["sockets"], f"{tile_id}: socket metadata mismatch"
        paths = len(re.findall(r"<path\b", svg))
        assert paths == tile["svg_paths"] and paths >= 600, f"{tile_id}: invalid path count {paths}"

        for socket_id, report in tile["seam_report"].items():
            center_error = abs(report["snapped_center"] - report["target_center"])
            width_error = abs(report["snapped_width"] - report["target_width"])
            assert center_error <= 0.012, f"{tile_id}/{socket_id}: center error {center_error:.4f}"
            assert width_error <= 0.012, f"{tile_id}/{socket_id}: width error {width_error:.4f}"
            socket_usage.add(socket_id)

    for preview in manifest["seam_previews"]:
        path = ROOT / preview
        assert path.exists() and path.stat().st_size > 0, f"missing seam preview {preview}"
    contact = ROOT / manifest["contact_sheet"]
    assert contact.exists() and contact.stat().st_size > 0, "contact sheet missing"

    for level in "012":
        assert f"L{level}" in socket_usage, f"no left socket at level {level}"
        assert f"R{level}" in socket_usage, f"no right socket at level {level}"
    print(
        f"PASS: {len(tiles)} tiles, {sum(tile['svg_paths'] for tile in tiles)} SVG paths, "
        f"3 compatible side-socket levels, all metadata and seams verified"
    )


if __name__ == "__main__":
    main()
