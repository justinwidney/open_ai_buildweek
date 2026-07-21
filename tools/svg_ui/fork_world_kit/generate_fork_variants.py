#!/usr/bin/env python3
"""Build a reproducible matrix of semantically tracked road-fork SVGs.

Each variant is the same tagged VTracer scene plus one or more fork groups.
The road graph is assembled from trusted splines, so painted texture can never
silently turn a branch into a false junction (or erase a real one).

Usage:
  python generate_fork_variants.py \
      ../../svg/generated/reference_06_03_continuous_road.svg \
      slices/slices.json road_style.json variants
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

from fork_road import generate_fork
from semantic_svg import build_manifest, canvas_size, graph_from_track, tag_svg_text


VARIANTS: dict[str, list[dict]] = {
    "near-left": [
        {"side": "left", "attach_y": 0.76, "exit_y": 0.48, "seed": 11},
    ],
    "near-right": [
        {"side": "right", "attach_y": 0.76, "exit_y": 0.48, "seed": 12},
    ],
    "near-both": [
        {"side": "left", "attach_y": 0.76, "exit_y": 0.50, "seed": 21},
        {"side": "right", "attach_y": 0.76, "exit_y": 0.50, "seed": 22},
    ],
    "middle-left": [
        {"side": "left", "attach_y": 0.56, "exit_y": 0.32, "seed": 31},
    ],
    "middle-right": [
        {"side": "right", "attach_y": 0.56, "exit_y": 0.32, "seed": 32},
    ],
    "series": [
        {"side": "left", "attach_y": 0.76, "exit_y": 0.55, "seed": 41},
        {"side": "right", "attach_y": 0.58, "exit_y": 0.40, "seed": 42},
        {"side": "left", "attach_y": 0.42, "exit_y": 0.25, "seed": 43},
    ],
}


def _rounded_point(point: list[float] | tuple[float, float]) -> list[float]:
    return [round(float(point[0]), 4), round(float(point[1]), 4)]


def build_semantic_graph(meta: dict, forks: list[dict]) -> dict:
    """Split the trunk at attachments and add exact labelled branch edges."""
    track = [_rounded_point(point) for point in sorted(meta["track"], key=lambda point: -point[1])]
    focal = _rounded_point(meta.get("focal", track[-1]))
    if track[-1] != focal:
        track.append(focal)

    grouped: list[dict] = []
    for fork in sorted(forks, key=lambda item: -item["attach"][1]):
        match = next(
            (
                group
                for group in grouped
                if abs(group["point"][1] - fork["attach"][1]) < 0.006
            ),
            None,
        )
        if match:
            match["forks"].append(fork)
        else:
            point = _rounded_point(fork["attach"])
            nearest_index = min(
                range(len(track)),
                key=lambda index: (track[index][0] - point[0]) ** 2 + (track[index][1] - point[1]) ** 2,
            )
            grouped.append({"point": point, "track_index": nearest_index, "forks": [fork]})
    grouped.sort(key=lambda group: group["track_index"])

    nodes: list[dict] = [
        {"id": 0, "kind": "start", "label": "road-start", "x": track[0][0], "y": track[0][1]}
    ]
    for index, group in enumerate(grouped, 1):
        sides = sorted({fork["side"] for fork in group["forks"]})
        kind = "fork-both" if len(sides) > 1 else f"fork-{sides[0]}"
        group["node_id"] = index
        nodes.append(
            {
                "id": index,
                "kind": kind,
                "label": f"junction-{index:02d}",
                "x": group["point"][0],
                "y": group["point"][1],
                "fork_ids": [fork["fork_id"] for fork in group["forks"]],
            }
        )
    castle_id = len(nodes)
    nodes.append(
        {"id": castle_id, "kind": "destination", "label": "castle", "x": track[-1][0], "y": track[-1][1]}
    )

    edges: list[dict] = []
    previous_node = 0
    previous_index = 0
    previous_point = track[0]
    main_markers = grouped + [
        {"node_id": castle_id, "track_index": len(track) - 1, "point": track[-1], "forks": []}
    ]
    for edge_index, marker in enumerate(main_markers, 1):
        current_index = marker["track_index"]
        middle = track[previous_index + 1:current_index]
        points = [previous_point] + middle + [marker["point"]]
        deduped = [points[0]]
        for point in points[1:]:
            if point != deduped[-1]:
                deduped.append(point)
        if len(deduped) == 1:
            deduped.append(marker["point"])
        edges.append(
            {
                "id": f"route-main-{edge_index:02d}",
                "a": previous_node,
                "b": marker["node_id"],
                "role": "main",
                "label": "main road to castle",
                "pts": deduped,
                "selector": '[data-route-role="main"]',
            }
        )
        previous_node = marker["node_id"]
        previous_index = current_index
        previous_point = marker["point"]

    next_node = castle_id + 1
    for group in grouped:
        for fork in group["forks"]:
            exit_node = next_node
            next_node += 1
            nodes.append(
                {
                    "id": exit_node,
                    "kind": "exit",
                    "label": f"{fork['fork_id']}-exit",
                    "x": fork["exit"][0],
                    "y": fork["exit"][1],
                    "fork_id": fork["fork_id"],
                    "side": fork["side"],
                }
            )
            spline = [_rounded_point(point) for point in fork["spline"]]
            branch_points = [group["point"]] + spline[2:]
            edges.append(
                {
                    "id": fork["graph_edge"]["id"],
                    "a": group["node_id"],
                    "b": exit_node,
                    "role": f"branch-{fork['side']}",
                    "label": f"{fork['side']} branch from {nodes[group['node_id']]['label']}",
                    "fork_id": fork["fork_id"],
                    "pts": branch_points,
                    "exit": fork["graph_edge"]["exit"],
                    "selector": fork["selectors"]["road"],
                }
            )

    return {
        "schema_version": 2,
        "source": "trusted-splines",
        "coordinate_space": "normalized",
        "nodes": nodes,
        "edges": edges,
        "start": 0,
        "castle": castle_id,
        "junctions": [group["node_id"] for group in grouped],
    }


def _set_root_variant(source: str, variant: str) -> str:
    root = re.search(r"<svg\b[^>]*>", source, re.I)
    if not root:
        return source
    tag = root.group(0)
    if "data-variant=" in tag:
        tag = re.sub(r'data-variant=["\'][^"\']*["\']', f'data-variant="{variant}"', tag)
    else:
        tag = tag[:-1] + f' data-variant="{variant}">'
    return source[:root.start()] + tag + source[root.end():]


def _insert_before_close(source: str, markup: str) -> str:
    index = source.lower().rfind("</svg>")
    if index < 0:
        raise ValueError("SVG has no closing </svg>")
    return source[:index] + markup + "\n" + source[index:]


def generate_all(base_svg: Path, slices_json: Path, style_json: Path, output_dir: Path) -> dict:
    base_source = base_svg.read_text(encoding="utf-8")
    meta = json.loads(slices_json.read_text(encoding="utf-8"))
    style = json.loads(style_json.read_text(encoding="utf-8"))
    width, height = canvas_size(base_source)
    output_dir.mkdir(parents=True, exist_ok=True)

    base_graph = graph_from_track(meta["track"], meta.get("focal"))
    tagged_base, base_records = tag_svg_text(base_source, base_graph, wrap_base=True)
    base_output = output_dir / "semantic-base.svg"
    base_output.write_text(tagged_base, encoding="utf-8")
    base_manifest = build_manifest(
        base_records,
        base_graph,
        width=width,
        height=height,
        source=str(base_svg).replace("\\", "/"),
        variant="base",
    )
    (output_dir / "semantic-base.json").write_text(
        json.dumps(base_manifest, indent=2) + "\n", encoding="utf-8"
    )

    index: dict = {
        "schema_version": 2,
        "base": {"svg": base_output.name, "manifest": "semantic-base.json"},
        "references": {
            "near-left": "../references/reference_fork_near_left.png",
            "near-right": "../references/reference_fork_near_right.png",
        },
        "variants": [],
    }

    for variant_name, specs in VARIANTS.items():
        groups: list[str] = []
        forks: list[dict] = []
        for ordinal, spec in enumerate(specs, 1):
            fork_id = f"fork-{variant_name}-{ordinal:02d}-{spec['side']}"
            group, fork = generate_fork(
                meta,
                style,
                attach_y=spec["attach_y"],
                side_name=spec["side"],
                exit_y=spec["exit_y"],
                seed=spec["seed"],
                next_scene=f"scene-{variant_name}-{ordinal:02d}-{spec['side']}.html",
                fork_id=fork_id,
            )
            groups.append(group)
            forks.append(fork)

        graph = build_semantic_graph(meta, forks)
        summary = {
            "schema_version": 2,
            "variant": variant_name,
            "manifest": f"{variant_name}.semantic.json",
            "fork_ids": [fork["fork_id"] for fork in forks],
        }
        metadata = (
            '<metadata id="semantic-road-metadata">'
            + html.escape(json.dumps(summary, separators=(",", ":")))
            + "</metadata>"
        )
        road_tops = "\n".join(
            f'<use href="#{fork["fork_id"]}-road" class="fork-road-top" '
            f'data-feature="fork-road-top" data-fork-id="{fork["fork_id"]}" '
            f'data-suggested-slice="{fork["suggested_slice"]}"/>'
            for fork in forks
        )
        overlay = (
            f'<g id="generated-forks" class="semantic-layer generated-forks" '
            f'data-feature="generated-forks" data-variant="{variant_name}">\n'
            + "\n".join(groups)
            + '\n<g id="generated-fork-road-tops" class="fork-road-tops" '
            + 'data-feature="fork-road-top">\n'
            + road_tops
            + "\n</g>"
            + "\n</g>"
        )
        composed = _set_root_variant(tagged_base, variant_name)
        composed = _insert_before_close(composed, metadata + "\n" + overlay)
        composed, records = tag_svg_text(composed, graph, wrap_base=False)

        svg_name = f"{variant_name}.svg"
        manifest_name = f"{variant_name}.semantic.json"
        (output_dir / svg_name).write_text(composed, encoding="utf-8")
        manifest = build_manifest(
            records,
            graph,
            width=width,
            height=height,
            source=str(base_svg).replace("\\", "/"),
            variant=variant_name,
            forks=forks,
        )
        (output_dir / manifest_name).write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
        (output_dir / f"{variant_name}.forks.json").write_text(
            json.dumps({"variant": variant_name, "forks": forks}, indent=2) + "\n",
            encoding="utf-8",
        )
        index["variants"].append(
            {
                "id": variant_name,
                "svg": svg_name,
                "manifest": manifest_name,
                "forks": len(forks),
                "junctions": len(graph["junctions"]),
                "reference": index["references"].get(variant_name),
            }
        )
        print(
            f"{variant_name:12s}: {len(forks)} fork(s), "
            f"{len(graph['junctions'])} junction(s), {len(graph['edges'])} route edges"
        )

    (output_dir / "manifest.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(index['variants'])} variants to {output_dir}")
    return index


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_svg")
    parser.add_argument("slices_json")
    parser.add_argument("style_json")
    parser.add_argument("output_dir")
    args = parser.parse_args()
    generate_all(
        Path(args.base_svg),
        Path(args.slices_json),
        Path(args.style_json),
        Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
