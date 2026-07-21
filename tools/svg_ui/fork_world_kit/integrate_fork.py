#!/usr/bin/env python3
"""Wire one generated semantic fork into an existing sliced road world.

The integration is idempotent: it refuses to add the same ``fork_id`` twice.
It splits the nearest main edge, adds a labelled branch edge and exit node,
records fork metadata, and injects the complete nested semantic SVG group into
its intended depth slice.

Usage:
  python integrate_fork.py fork_left.json fork_left.svg \
      [slices/slices.json] [slices]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from depth_slice_traced import extract_fork_groups


def integrate(
    fork_json: str,
    fork_svg: str,
    slices_json: str = "slices/slices.json",
    slice_directory: str = "slices",
) -> None:
    fork = json.loads(Path(fork_json).read_text(encoding="utf-8"))
    meta_path = Path(slices_json)
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    graph = meta["graph"]
    fork_id = fork.get("fork_id", Path(fork_svg).stem)
    if any(edge.get("fork_id") == fork_id for edge in graph["edges"]):
        raise SystemExit(f"{fork_id} is already present in {slices_json}")

    attach_x, attach_y = fork["attach"]
    best = None
    for edge_index, edge in enumerate(graph["edges"]):
        # Prefer the main route when semantic roles are available.
        role_penalty = 0 if edge.get("role", "main") == "main" else 1
        for point_index, (x, y) in enumerate(edge["pts"]):
            distance = (x - attach_x) ** 2 + (y - attach_y) ** 2
            candidate = (role_penalty, distance, edge_index, point_index)
            if best is None or candidate < best:
                best = candidate
    if best is None:
        raise SystemExit("road graph has no points")
    _, _, edge_index, point_index = best
    edge = graph["edges"][edge_index]

    integer_ids = [node["id"] for node in graph["nodes"] if isinstance(node["id"], int)]
    if len(integer_ids) != len(graph["nodes"]):
        raise SystemExit("integrate_fork currently expects integer graph node ids")
    next_id = max(integer_ids) + 1
    if 2 <= point_index <= len(edge["pts"]) - 3:
        junction_id = next_id
        next_id += 1
        junction_point = edge["pts"][point_index]
        graph["nodes"].append(
            {
                "id": junction_id,
                "kind": f"fork-{fork.get('side', 'unknown')}",
                "label": f"junction-{fork_id}",
                "x": junction_point[0],
                "y": junction_point[1],
                "fork_ids": [fork_id],
            }
        )
        first = dict(edge)
        first.update({"b": junction_id, "pts": edge["pts"][: point_index + 1]})
        second = dict(edge)
        second.update({"a": junction_id, "pts": edge["pts"][point_index:]})
        first["id"] = f"{edge.get('id', 'route-main')}-a"
        second["id"] = f"{edge.get('id', 'route-main')}-b"
        graph["edges"][edge_index] = first
        graph["edges"].append(second)
    else:
        junction_id = edge["a"] if point_index < len(edge["pts"]) // 2 else edge["b"]

    exit_id = next_id
    graph["nodes"].append(
        {
            "id": exit_id,
            "kind": "exit",
            "label": f"{fork_id}-exit",
            "fork_id": fork_id,
            "side": fork.get("side"),
            "x": fork["exit"][0],
            "y": fork["exit"][1],
        }
    )
    branch_points = [fork["attach"]] + fork["spline"][2:]
    graph["edges"].append(
        {
            "id": fork["graph_edge"].get("id", f"route-{fork_id}"),
            "a": junction_id,
            "b": exit_id,
            "pts": branch_points,
            "role": fork["graph_edge"].get("role", f"branch-{fork.get('side', 'unknown')}"),
            "fork_id": fork_id,
            "selector": fork.get("selectors", {}).get("road", f"#{fork_id}-road"),
            "exit": fork["graph_edge"]["exit"],
        }
    )
    graph.setdefault("junctions", []).append(junction_id)
    meta.setdefault("forks", []).append(
        {
            "fork_id": fork_id,
            "side": fork.get("side"),
            "attach": fork["attach"],
            "bbox": fork.get("bbox"),
            "selectors": fork.get("selectors", {}),
        }
    )

    selected_slice = fork["suggested_slice"]
    slice_path = Path(slice_directory) / f"slice_{selected_slice}.svg"
    slice_source = slice_path.read_text(encoding="utf-8")
    _, groups = extract_fork_groups(Path(fork_svg).read_text(encoding="utf-8"))
    if not groups:
        raise SystemExit(f"{fork_svg} has no <g data-feature=\"fork\"> group")
    if f'id="{fork_id}"' in slice_source:
        raise SystemExit(f"{fork_id} art is already present in {slice_path}")
    slice_path.write_text(
        slice_source.replace("</svg>", groups[0]["markup"] + "\n</svg>"),
        encoding="utf-8",
    )
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(
        f"{fork_id}: junction {junction_id}, exit node {exit_id} -> "
        f"{fork['graph_edge']['exit']}; art in slice_{selected_slice}"
    )


if __name__ == "__main__":
    integrate(*sys.argv[1:])
