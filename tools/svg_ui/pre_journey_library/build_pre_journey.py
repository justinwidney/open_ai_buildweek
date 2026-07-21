#!/usr/bin/env python3
"""Normalize and trace the pre-journey image-generation results.

Usage:
  py -3.11 build_pre_journey.py
  py -3.11 build_pre_journey.py --resume
  py -3.11 build_pre_journey.py --skip-svg
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import vtracer


ROOT = Path(__file__).resolve().parent
CANVAS = (1200, 694)
TRACE_SETTINGS = {
    "filter_speckle": 8,
    "color_precision": 7,
    "layer_difference": 16,
    "corner_threshold": 60,
    "length_threshold": 4.0,
    "splice_threshold": 45,
    "path_precision": 2,
}
SCENES = [
    {
        "id": "01_forest_threshold",
        "title": "Forest threshold",
        "decision_language": "two faint natural foot-trails through an old pine forest",
    },
    {
        "id": "02_sunlit_clearing",
        "title": "Sunlit clearing",
        "decision_language": "three subtle options across an open highland meadow",
    },
    {
        "id": "03_streamside_choice",
        "title": "Streamside choice",
        "decision_language": "stepping stones, a log crossing, and a faint bank trail",
    },
    {
        "id": "04_two_way_fork",
        "title": "Two-way dirt-path fork",
        "decision_language": "one foreground dirt path splitting into equal left and right choices",
    },
    {
        "id": "05_path_exits_left",
        "title": "Path exits left",
        "decision_language": "one continuous dirt path curving beyond the left edge",
    },
    {
        "id": "06_path_exits_right",
        "title": "Path exits right",
        "decision_language": "one continuous dirt path curving beyond the right edge",
    },
    {
        "id": "07_left_straight_right",
        "title": "Left / straight / right",
        "decision_language": "one junction with balanced left, straight, and right destinations",
    },
    {
        "id": "08_far_left_near_left_straight",
        "title": "Far-left / near-left / straight",
        "decision_language": "an asymmetric three-path fan with two distinct left choices",
    },
    {
        "id": "09_staged_left_straight_right",
        "title": "Staged three-destination fork",
        "decision_language": "a near left fork followed later by a separate straight/right fork",
    },
]


def crop_and_resize(source: Image.Image) -> Image.Image:
    """Center-crop to the canonical aspect ratio, then resize once."""
    source = source.convert("RGB")
    width, height = source.size
    target_ratio = CANVAS[0] / CANVAS[1]
    source_ratio = width / height
    if source_ratio > target_ratio:
        crop_width = round(height * target_ratio)
        left = (width - crop_width) // 2
        box = (left, 0, left + crop_width, height)
    else:
        crop_height = round(width / target_ratio)
        top = (height - crop_height) // 2
        box = (0, top, width, top + crop_height)
    return source.crop(box).resize(CANVAS, Image.Resampling.LANCZOS)


def inject_metadata(svg_path: Path, metadata: dict) -> int:
    svg = svg_path.read_text(encoding="utf-8")
    path_count = len(re.findall(r"<path\b", svg))
    root = re.search(r"<svg\b[^>]*>", svg)
    if not root:
        raise ValueError(f"{svg_path}: missing SVG root")
    encoded = html.escape(json.dumps(metadata, separators=(",", ":")))
    new_root = root.group(0)[:-1] + f' data-pre-journey-scene="{metadata["id"]}">'
    block = f'<metadata id="pre-journey-scene">{encoded}</metadata>'
    svg = svg[: root.start()] + new_root + block + svg[root.end() :]
    svg_path.write_text(svg, encoding="utf-8")
    return path_count


def make_contact_sheet(items: list[dict], output: Path) -> None:
    thumb_size = (400, 231)
    label_height = 34
    columns = 3
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (columns * thumb_size[0], rows * (thumb_size[1] + label_height)),
        "#172235",
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, item in enumerate(items):
        image = Image.open(ROOT / item["normalized_png"]).convert("RGB")
        image.thumbnail(thumb_size, Image.Resampling.LANCZOS)
        column = index % columns
        row = index // columns
        x = column * thumb_size[0]
        y = row * (thumb_size[1] + label_height)
        sheet.paste(image, (x, y))
        draw.text((x + 10, y + thumb_size[1] + 10), item["title"], fill="#f7f0df", font=font)
    sheet.save(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-svg", action="store_true")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="reuse SVGs that already contain pre-journey metadata",
    )
    args = parser.parse_args()

    normalized_dir = ROOT / "normalized"
    svg_dir = ROOT / "svgs"
    normalized_dir.mkdir(exist_ok=True)
    svg_dir.mkdir(exist_ok=True)

    items = []
    for scene in SCENES:
        raster_path = ROOT / "rasters" / f'{scene["id"]}.png'
        normalized_path = normalized_dir / raster_path.name
        with Image.open(raster_path) as source:
            source_size = list(source.size)
            crop_and_resize(source).save(normalized_path)

        metadata = {
            **scene,
            "stage": "pre-journey",
            "route_selected": False,
            "castle_scale": "tiny distant horizon landmark",
            "canvas": list(CANVAS),
        }
        svg_path = svg_dir / f'{scene["id"]}.svg'
        path_count = None
        if not args.skip_svg:
            existing = svg_path.read_text(encoding="utf-8") if svg_path.exists() else ""
            if args.resume and 'data-pre-journey-scene=' in existing:
                path_count = len(re.findall(r"<path\b", existing))
            else:
                vtracer.convert_image_to_svg_py(
                    str(normalized_path),
                    str(svg_path),
                    colormode="color",
                    hierarchical="stacked",
                    mode="spline",
                    **TRACE_SETTINGS,
                )
                path_count = inject_metadata(svg_path, metadata)

        items.append(
            {
                **metadata,
                "source_size": source_size,
                "source_raster": f"rasters/{raster_path.name}",
                "normalized_png": f"normalized/{normalized_path.name}",
                "svg": f"svgs/{svg_path.name}" if not args.skip_svg else None,
                "svg_paths": path_count,
            }
        )

    make_contact_sheet(items, ROOT / "contact_sheet.png")
    manifest = {
        "schema_version": 1,
        "generation_mode": "OpenAI built-in image generation with three style references",
        "normalized_canvas": list(CANVAS),
        "vector_canvas": list(CANVAS),
        "trace_settings": TRACE_SETTINGS,
        "prompt_set": "GENERATION_PROMPTS.md",
        "contact_sheet": "contact_sheet.png",
        "items": items,
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f'wrote {len(items)} normalized PNGs, {0 if args.skip_svg else len(items)} SVGs, manifest, and contact sheet')


if __name__ == "__main__":
    main()
