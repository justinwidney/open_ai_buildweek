#!/usr/bin/env python3
"""Crop an exact image-generation grid and trace named cells to SVG."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image
import vtracer


def ensure_svg_size(path: Path, size: int) -> None:
    text = path.read_text(encoding="utf-8")
    opening = re.search(r"<svg\s+([^>]*)>", text)
    if not opening:
        raise ValueError(f"missing svg root in {path}")
    attributes = re.sub(r'\s*(?:width|height|viewBox)="[^"]*"', "", opening.group(1))
    replacement = f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" {attributes.strip()}>'
    text = text[: opening.start()] + replacement + text[opening.end() :]
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--columns", type=int, required=True)
    parser.add_argument("--rows", type=int, required=True)
    parser.add_argument("--names", nargs="+", required=True)
    parser.add_argument("--size", type=int, default=280)
    args = parser.parse_args()

    expected = args.columns * args.rows
    if len(args.names) != expected:
        raise SystemExit(f"expected {expected} names, received {len(args.names)}")

    source = Image.open(args.input).convert("RGB")
    args.output.mkdir(parents=True, exist_ok=True)
    raster_dir = args.output / "source-png"
    raster_dir.mkdir(exist_ok=True)

    for index, name in enumerate(args.names):
        row, column = divmod(index, args.columns)
        bounds = (
            round(column * source.width / args.columns),
            round(row * source.height / args.rows),
            round((column + 1) * source.width / args.columns),
            round((row + 1) * source.height / args.rows),
        )
        cell = source.crop(bounds).resize((args.size, args.size), Image.Resampling.LANCZOS)
        png_path = raster_dir / f"{name}.png"
        svg_path = args.output / f"{name}.svg"
        cell.save(png_path, mode="RGB")
        vtracer.convert_image_to_svg_py(
            str(png_path),
            str(svg_path),
            colormode="color",
            hierarchical="stacked",
            mode="spline",
            filter_speckle=8,
            color_precision=7,
            layer_difference=16,
            corner_threshold=60,
            length_threshold=4.0,
            splice_threshold=45,
            path_precision=2,
        )
        ensure_svg_size(svg_path, args.size)
        print(f"{index + 1:02d}/{expected}: {name} {bounds}")


if __name__ == "__main__":
    main()
