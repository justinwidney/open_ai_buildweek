#!/usr/bin/env python3
"""Split a traced/semantic SVG into depth slices without losing fork groups.

Compared with the original slicer this parser accepts attributes in any order,
retains stable path ids/classes, and moves each complete
``<g data-feature="fork">`` to its declared depth slice.  Nested fork
land/road/rock/vegetation groups therefore survive intact and remain
queryable in CSS, JavaScript, and Three.js.

If ``input.semantic.json`` exists beside the SVG, its trusted road graph and
fork metadata are copied into ``slices.json`` automatically.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from semantic_svg import attributes, canvas_size, element_bbox


def extract_fork_groups(source: str) -> tuple[str, list[dict]]:
    """Remove and return balanced semantic fork groups."""
    spans: list[tuple[int, int, str, dict[str, str]]] = []
    token_re = re.compile(r"<g\b[^>]*>|</g\s*>", re.I)
    for start in re.finditer(r"<g\b[^>]*>", source, re.I):
        attrs = attributes(start.group(0))
        if attrs.get("data-feature") != "fork":
            continue
        depth = 0
        end_pos = None
        for token in token_re.finditer(source, start.start()):
            if token.group(0).lower().startswith("<g"):
                depth += 1
            else:
                depth -= 1
                if depth == 0:
                    end_pos = token.end()
                    break
        if end_pos is None:
            raise ValueError(f"unclosed fork group {attrs.get('id', '(unknown)')}")
        spans.append((start.start(), end_pos, source[start.start():end_pos], attrs))

    # Ignore nested duplicate discoveries (only the outer data-feature=fork is wanted).
    selected: list[tuple[int, int, str, dict[str, str]]] = []
    for span in sorted(spans):
        if selected and span[0] >= selected[-1][0] and span[1] <= selected[-1][1]:
            continue
        selected.append(span)
    pieces: list[str] = []
    cursor = 0
    groups: list[dict] = []
    for start, end, markup, attrs in selected:
        pieces.append(source[cursor:start])
        cursor = end
        groups.append(
            {
                "id": attrs.get("id", f"fork-{len(groups) + 1}"),
                "markup": markup,
                "slice": int(attrs.get("data-suggested-slice", "1")),
                "bbox": attrs.get("data-bbox"),
                "side": attrs.get("data-side"),
            }
        )
    pieces.append(source[cursor:])
    return "".join(pieces), groups


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("outdir")
    parser.add_argument("--n", type=int, default=6)
    parser.add_argument("--horizon", type=float, default=0.18)
    parser.add_argument("--focal", type=float, nargs=2, default=[0.5, 0.15])
    parser.add_argument("--semantic-manifest", help="trusted graph manifest; auto-detected by default")
    args = parser.parse_args()

    input_path = Path(args.input)
    source = input_path.read_text(encoding="utf-8")
    head_match = re.search(r"<svg\b[^>]*>", source, re.I)
    if not head_match:
        raise SystemExit("input has no <svg> root")
    head = head_match.group(0)
    width, height = canvas_size(source)
    style_matches = re.findall(r"<style\b.*?</style>", source, re.I | re.S)
    styles = "\n".join(style_matches)

    source_without_forks, fork_groups = extract_fork_groups(source)
    paths: list[dict] = []
    for match in re.finditer(r"<path\b[^>]*>", source_without_forks, re.I):
        raw = match.group(0)
        attrs = attributes(raw)
        box = element_bbox(raw)
        if box is None:
            continue
        paths.append(
            {
                "raw": raw,
                "fill": attrs.get("fill", ""),
                "id": attrs.get("id"),
                "feature": attrs.get("data-feature", ""),
                "x0": box[0],
                "y0": box[1],
                "x1": box[2],
                "y1": box[3],
                "idx": len(paths),
            }
        )
    if not paths:
        raise SystemExit("no drawable paths found")

    slice_count, path_count = args.n, len(paths)

    def kind_of(path: dict) -> str:
        feature = path["feature"]
        if feature == "sky":
            return "base"
        if feature == "cloud":
            return "cloud"
        fill = path["fill"]
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", fill):
            return "solid"
        red, green, blue = (int(fill[index:index + 2], 16) for index in (1, 3, 5))
        w, h = path["x1"] - path["x0"], path["y1"] - path["y0"]
        high, low = max(red, green, blue), min(red, green, blue)
        if w * h > width * height * 0.25:
            return "base"
        if (low > 175 and high - low < 45) or (blue >= red and blue > 185 and green > 175):
            return "cloud"
        return "solid"

    def initial(path: dict) -> int:
        kind = kind_of(path)
        if kind == "base":
            return 0
        bbox_bottom = path["y1"] / height
        if bbox_bottom <= args.horizon and path["idx"] < path_count * 0.5:
            return 0
        depth = 0.6 * max(0, (bbox_bottom - args.horizon) / (1 - args.horizon))
        depth += 0.4 * (path["idx"] / path_count)
        selected = 1 + min(slice_count - 2, int(depth**1.2 * (slice_count - 1)))
        if kind == "cloud" and selected > 1:
            selected -= 1
        return selected

    assignment = [initial(path) for path in paths]
    for _ in range(3):
        changed = 0
        for later_index, later in enumerate(paths):
            for earlier_index, earlier in enumerate(paths[:later_index]):
                if (
                    earlier["x0"] <= later["x0"]
                    and earlier["x1"] >= later["x1"]
                    and earlier["y0"] <= later["y0"]
                    and earlier["y1"] >= later["y1"]
                    and assignment[later_index] < assignment[earlier_index]
                ):
                    assignment[later_index] = assignment[earlier_index]
                    changed += 1
        if not changed:
            break

    id_to_slice = {path["id"]: selected for path, selected in zip(paths, assignment) if path["id"]}
    uses: list[list[str]] = [[] for _ in range(slice_count)]
    for match in re.finditer(r"<use\b[^>]*>", source_without_forks, re.I):
        attrs = attributes(match.group(0))
        reference = attrs.get("href", attrs.get("xlink:href", "")).lstrip("#")
        declared_slice = attrs.get("data-suggested-slice")
        selected = (
            max(0, min(slice_count - 1, int(declared_slice)))
            if declared_slice is not None
            else id_to_slice.get(reference, slice_count - 1)
        )
        uses[selected].append(match.group(0))

    output_dir = Path(args.outdir)
    output_dir.mkdir(parents=True, exist_ok=True)
    buckets: list[list[str]] = [[] for _ in range(slice_count)]
    for path, selected in zip(paths, assignment):
        buckets[selected].append(path["raw"])
    fork_buckets: list[list[dict]] = [[] for _ in range(slice_count)]
    for group in fork_groups:
        selected = max(0, min(slice_count - 1, group["slice"]))
        fork_buckets[selected].append(group)

    manifest_path = (
        Path(args.semantic_manifest)
        if args.semantic_manifest
        else input_path.with_suffix(".semantic.json")
    )
    semantic = None
    if manifest_path.exists():
        semantic = json.loads(manifest_path.read_text(encoding="utf-8"))

    meta: dict = {
        "schema_version": 2,
        "width": width,
        "height": height,
        "focal": args.focal,
        "variant": semantic.get("variant") if semantic else None,
        "slices": [],
    }
    if semantic:
        if semantic.get("road_network"):
            meta["graph"] = semantic["road_network"]
            castle_id = meta["graph"].get("castle")
            castle = next(
                (node for node in meta["graph"].get("nodes", []) if node["id"] == castle_id),
                None,
            )
            if castle:
                meta["focal"] = [castle["x"], castle["y"]]
        meta["forks"] = [
            {
                "fork_id": fork["fork_id"],
                "side": fork["side"],
                "attach": fork["attach"],
                "bbox": fork["bbox"],
                "selectors": fork["selectors"],
            }
            for fork in semantic.get("forks", [])
        ]

    for index in range(slice_count):
        base_group = (
            f'<g id="scene-base-slice-{index}" class="semantic-layer scene-base-slice" '
            f'data-feature="base-scene" data-slice="{index}">\n'
            + "\n".join(buckets[index])
            + "\n</g>"
        )
        fork_markup = "\n".join(group["markup"] for group in fork_buckets[index])
        overlay = (
            '\n<g class="animated-overlay" data-feature="animation-overlay">\n'
            + "\n".join(uses[index])
            + "\n</g>"
            if uses[index]
            else ""
        )
        slice_path = output_dir / f"slice_{index}.svg"
        slice_path.write_text(
            f"{head}{styles}\n{base_group}\n{fork_markup}{overlay}\n</svg>",
            encoding="utf-8",
        )
        meta["slices"].append(
            {
                "file": slice_path.name,
                "z": index,
                "paths": len(buckets[index]),
                "clones": len(uses[index]),
                "forks": [group["id"] for group in fork_buckets[index]],
            }
        )
        print(
            f"{slice_path.name}: {len(buckets[index])} paths, {len(uses[index])} clones, "
            f"{len(fork_buckets[index])} semantic fork(s)"
        )
    (output_dir / "slices.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
