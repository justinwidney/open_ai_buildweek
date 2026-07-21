#!/usr/bin/env python3
"""Find fork candidates and bounding boxes in a raster road reference.

This is deliberately a *diagnostic* detector.  Imported concept art has no
semantic source spline, so candidates are marked with confidence and should be
reviewed in the generated overlay.  Generated SVG variants instead use the
exact graph emitted by ``generate_fork_variants.py``.

Dependencies: Pillow, NumPy, SciPy.  The script exits with an actionable
message when they are unavailable.

Usage:
  python analyze_fork_reference.py reference.png analysis.json \
      --overlay analysis.png
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def _dependencies():
    try:
        import numpy as np
        from PIL import Image, ImageDraw
        from scipy import ndimage
    except ImportError as exc:
        raise SystemExit(
            "raster fork analysis needs pillow, numpy, and scipy; use a Python "
            "environment containing those packages (this repo currently has them under `py -3.11`)"
        ) from exc
    return np, Image, ImageDraw, ndimage


def _runs(row, minimum: int, merge_gap: int) -> list[tuple[int, int]]:
    np, _, _, _ = _dependencies()
    padded = np.pad(row.astype(np.int8), (1, 1))
    changes = np.diff(padded)
    starts = np.where(changes == 1)[0]
    ends = np.where(changes == -1)[0] - 1
    runs = [(int(start), int(end)) for start, end in zip(starts, ends) if end - start + 1 >= minimum]
    merged: list[list[int]] = []
    for start, end in runs:
        if merged and start - merged[-1][1] - 1 <= merge_gap:
            merged[-1][1] = end
        else:
            merged.append([start, end])
    return [(start, end) for start, end in merged if end - start + 1 >= minimum]


def analyze(path: Path) -> tuple[dict, object]:
    np, Image, _, ndimage = _dependencies()
    image = Image.open(path).convert("RGB")
    pixels = np.array(image).astype(float)
    height, width, _ = pixels.shape
    red, green, blue = pixels[..., 0], pixels[..., 1], pixels[..., 2]

    road = (
        (red > 165)
        & (red < 252)
        & (green > 125)
        & (red > blue + 28)
        & (green > blue + 10)
        & (green < red + 5)
        & (blue > 78)
    )
    labels, count = ndimage.label(road)
    if not count:
        raise SystemExit(f"no warm road component found in {path}")
    sizes = ndimage.sum(road, labels, range(1, count + 1))
    main = labels == (int(np.argmax(sizes)) + 1)
    main = ndimage.binary_closing(main, structure=np.ones((7, 7)))
    main = ndimage.binary_fill_holes(main)
    main = ndimage.binary_opening(main, structure=np.ones((3, 3)))

    ys, xs = np.where(main)
    road_box = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    stride = max(2, height // 260)
    minimum_run = max(6, int(width * 0.006))
    merge_gap = max(4, int(width * 0.012))
    profiles: list[dict] = []
    for y in range(int(ys.min()), int(ys.max()) + 1, stride):
        band = main[max(0, y - stride):min(height, y + stride + 1)].any(axis=0)
        runs = _runs(band, minimum_run, merge_gap)
        # A true fork needs a visible water/air gap, not texture within one road.
        meaningful = []
        for run in runs:
            if meaningful and run[0] - meaningful[-1][1] < width * 0.025:
                meaningful[-1] = (meaningful[-1][0], run[1])
            else:
                meaningful.append(run)
        profiles.append(
            {
                "y": y,
                "runs": [[start, end] for start, end in meaningful],
                "centers": [round((start + end) / 2, 1) for start, end in meaningful],
            }
        )

    multi_indexes = [index for index, profile in enumerate(profiles) if len(profile["runs"]) >= 2]
    bands: list[list[int]] = []
    for index in multi_indexes:
        if bands and index - bands[-1][-1] <= 3:
            bands[-1].append(index)
        else:
            bands.append([index])

    forks: list[dict] = []
    minimum_band = max(5, int(height * 0.045 / stride))
    for band in bands:
        if len(band) < minimum_band:
            continue
        band_profiles = [profiles[index] for index in band]
        y0, y1 = band_profiles[0]["y"], band_profiles[-1]["y"]
        # Find the single trunk immediately below the split.
        below = next(
            (
                profile
                for profile in profiles[band[-1] + 1:band[-1] + 1 + max(4, int(height * 0.06 / stride))]
                if len(profile["runs"]) == 1
            ),
            None,
        )
        sample = band_profiles[max(0, int(len(band_profiles) * 0.72) - 1)]
        centers = sample["centers"]
        junction_x = (
            below["centers"][0]
            if below
            else sum(centers) / len(centers)
        )
        junction_y = below["y"] if below else y1
        sides = []
        for center in centers:
            delta = (center - junction_x) / width
            if delta < -0.02:
                sides.append("left")
            elif delta > 0.02:
                sides.append("right")
            else:
                sides.append("main")
        all_runs = [run for profile in band_profiles for run in profile["runs"]]
        x0 = min(run[0] for run in all_runs)
        x1 = max(run[1] for run in all_runs)
        separation = max(centers) - min(centers) if len(centers) > 1 else 0
        confidence = min(0.99, 0.55 + len(band) * stride / height + separation / width * 0.45)
        fork_id = f"candidate-fork-{len(forks) + 1:02d}"
        forks.append(
            {
                "id": fork_id,
                "status": "candidate-needs-review",
                "junction": [round(junction_x / width, 4), round(junction_y / height, 4)],
                "junction_pixels": [round(junction_x, 1), int(junction_y)],
                "sides": sorted(set(sides)),
                "arm_centers": [round(center / width, 4) for center in centers],
                "bbox": {
                    "pixels": [int(x0), int(y0), int(x1), int(junction_y)],
                    "normalized": [
                        round(x0 / width, 4),
                        round(y0 / height, 4),
                        round(x1 / width, 4),
                        round(junction_y / height, 4),
                    ],
                },
                "confidence": round(confidence, 3),
            }
        )

    analysis = {
        "schema_version": 2,
        "source": str(path).replace("\\", "/"),
        "canvas": {"width": width, "height": height},
        "method": "warm-road-mask + horizontal-run divergence",
        "road_mask": {
            "coverage": round(float(main.mean()), 5),
            "bbox": {
                "pixels": road_box,
                "normalized": [
                    round(road_box[0] / width, 4),
                    round(road_box[1] / height, 4),
                    round(road_box[2] / width, 4),
                    round(road_box[3] / height, 4),
                ],
            },
        },
        "fork_candidates": forks,
        "review_note": (
            "Raster candidates are evidence, not authoritative graph edges. "
            "Use trusted spline metadata for generated SVGs."
        ),
    }
    return analysis, image


def draw_overlay(image, analysis: dict, output: Path) -> None:
    _, _, ImageDraw, _ = _dependencies()
    draw = ImageDraw.Draw(image)
    road_box = analysis["road_mask"]["bbox"]["pixels"]
    draw.rectangle(road_box, outline=(30, 220, 255), width=4)
    draw.text((road_box[0] + 6, road_box[1] + 6), "road network", fill=(10, 80, 110), stroke_width=2, stroke_fill="white")
    for fork in analysis["fork_candidates"]:
        box = fork["bbox"]["pixels"]
        draw.rectangle(box, outline=(255, 72, 72), width=6)
        x, y = fork["junction_pixels"]
        radius = 12
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=(255, 210, 0), width=5)
        label = f"{fork['id']} {','.join(fork['sides'])} {fork['confidence']:.2f}"
        draw.text((box[0] + 8, max(4, box[1] + 8)), label, fill=(120, 10, 10), stroke_width=3, stroke_fill="white")
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--overlay")
    args = parser.parse_args()
    analysis, image = analyze(Path(args.input))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(analysis, indent=2) + "\n", encoding="utf-8")
    if args.overlay:
        draw_overlay(image.copy(), analysis, Path(args.overlay))
    print(
        f"{Path(args.input).name}: {len(analysis['fork_candidates'])} fork candidate(s); "
        f"road bbox {analysis['road_mask']['bbox']['normalized']}"
    )


if __name__ == "__main__":
    main()
