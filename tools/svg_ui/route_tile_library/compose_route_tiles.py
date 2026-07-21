#!/usr/bin/env python3
"""Compose NEW route tiles from the 25 image-generated masters, no image model.

Every master shares the same castle, camera, sky, and palette; tiles differ
only in the route network and the landmass supporting it. So a donor tile's
"route delta" -- branch road plus its supporting island shelf -- can be
isolated by diffing the donor against the straight base tile, grown from the
socket mouth, and feather-blended onto another tile. Socket mouths were
already snapped by prepare_tile_library.py, and the composite is snapped
again afterwards, so seams stay flush with the shared connector contract.

Usage:
  py -3.11 compose_route_tiles.py               # all recipes + validation
  py -3.11 compose_route_tiles.py --skip-svg    # PNG composites only
  py -3.11 compose_route_tiles.py --only 26_near_left_mid_right
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import prepare_tile_library as prep

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "composites"

DIFF_THRESHOLD = 30.0      # RGB euclidean distance that counts as a change
BRIDGE_ITER = 6            # dilation bridging texture gaps when region-growing
MIN_COMPONENT_PX = 500     # drop diff specks smaller than this
PROTECT_TOP = 0.24         # never composite over the castle band
FEATHER_SIGMA = 7.0        # gaussian feather on the blend alpha

# Composite recipes. Parts are painted far-to-near so foreground junctions
# win any overlap on the shared central road strip. "extract" is a side
# socket to grow the delta from, or "auto" for internal features (loops).
RECIPES = [
    {
        "id": "val_22_reconstruction",
        "label": "VALIDATION: rebuild 22 from 06+12",
        "sockets": ["B0", "T0", "L0", "R2"],
        "parts": [["06_near_exit_left", "L0"], ["12_far_exit_right", "R2"]],
        "validate_against": "22_near_left_far_right",
    },
    {
        "id": "26_near_left_mid_right",
        "label": "Near-left and mid-right exits",
        "sockets": ["B0", "T0", "L0", "R1"],
        "parts": [["06_near_exit_left", "L0"], ["10_mid_exit_right", "R1"]],
    },
    {
        "id": "27_mid_left_near_right",
        "label": "Mid-left and near-right exits",
        "sockets": ["B0", "T0", "L1", "R0"],
        "parts": [["09_mid_exit_left", "L1"], ["07_near_exit_right", "R0"]],
    },
    {
        "id": "28_mid_left_far_right",
        "label": "Mid-left and far-right exits",
        "sockets": ["B0", "T0", "L1", "R2"],
        "parts": [["09_mid_exit_left", "L1"], ["12_far_exit_right", "R2"]],
    },
    {
        "id": "29_far_left_near_right",
        "label": "Far-left and near-right exits",
        "sockets": ["B0", "T0", "L2", "R0"],
        "parts": [["11_far_exit_left", "L2"], ["07_near_exit_right", "R0"]],
    },
    {
        "id": "30_far_left_mid_right",
        "label": "Far-left and mid-right exits",
        "sockets": ["B0", "T0", "L2", "R1"],
        "parts": [["11_far_exit_left", "L2"], ["10_mid_exit_right", "R1"]],
    },
    {
        "id": "31_left_near_and_far",
        "label": "Same-side double: near-left and far-left",
        "sockets": ["B0", "T0", "L0", "L2"],
        "parts": [["06_near_exit_left", "L0"], ["11_far_exit_left", "L2"]],
    },
    {
        "id": "32_near_hub_far_right",
        "label": "Triple: near hub both sides plus far-right",
        "sockets": ["B0", "T0", "L0", "R0", "R2"],
        "parts": [
            ["08_near_exits_both", "L0"],
            ["08_near_exits_both", "R0"],
            ["12_far_exit_right", "R2"],
        ],
    },
    {
        "id": "33_mid_loop_near_right",
        "label": "Mid-left loop plus near-right exit",
        "sockets": ["B0", "T0", "R0"],
        "parts": [["15_mid_loop_left", "auto"], ["07_near_exit_right", "R0"]],
    },
    {
        "id": "34_right_near_and_far",
        "label": "Same-side double: near-right and far-right",
        "sockets": ["B0", "T0", "R0", "R2"],
        "parts": [["07_near_exit_right", "R0"], ["12_far_exit_right", "R2"]],
    },
    {
        "id": "35_diamond_near_right",
        "label": "Diamond rejoin plus near-right exit",
        "sockets": ["B0", "T0", "R0"],
        "parts": [["17_diamond_rejoin", "auto"], ["07_near_exit_right", "R0"]],
    },
    {
        "id": "36_near_loop_far_right",
        "label": "Near-left loop plus far-right exit",
        "sockets": ["B0", "T0", "R2"],
        "parts": [["13_near_loop_left", "auto"], ["12_far_exit_right", "R2"]],
    },
    {
        "id": "37_hub_with_mid_loop",
        "label": "Near hub both sides plus mid-left loop",
        "sockets": ["B0", "T0", "L0", "R0"],
        "parts": [
            ["08_near_exits_both", "L0"],
            ["08_near_exits_both", "R0"],
            ["15_mid_loop_left", "auto"],
        ],
    },
]


def load_rgb(tile_id: str) -> np.ndarray:
    path = ROOT / "normalized" / f"{tile_id}.png"
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)


def matter_mask(rgb: np.ndarray) -> np.ndarray:
    """Land / road / vegetation / rock pixels -- excludes sky, water, clouds.

    Clouds and water vary between independent generations; without this
    filter the diff would import cloud rearrangements as fake deltas.
    """
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return ((red - blue) > 8) | ((green - blue) > 8)


def clean(mask: np.ndarray) -> np.ndarray:
    mask = ndimage.binary_opening(mask, iterations=2)
    mask = ndimage.binary_closing(mask, iterations=3)
    labels, count = ndimage.label(mask)
    if not count:
        return mask
    sizes = ndimage.sum_labels(np.ones_like(labels), labels, range(1, count + 1))
    keep = {index + 1 for index, size in enumerate(sizes) if size >= MIN_COMPONENT_PX}
    return np.isin(labels, list(keep)) if keep else np.zeros_like(mask)


def raw_delta(donor: np.ndarray, base: np.ndarray) -> np.ndarray:
    distance = np.sqrt(((donor - base) ** 2).sum(axis=-1))
    mask = (distance > DIFF_THRESHOLD) & matter_mask(donor)
    height = mask.shape[0]
    mask[: int(height * PROTECT_TOP)] = False
    return clean(mask)


def socket_window(shape: tuple[int, int], socket_id: str, contract: dict) -> tuple[slice, slice]:
    height, width = shape
    center = int(contract["center"] * height)
    span = int(0.07 * height)
    rows = slice(max(0, center - span), min(height, center + span))
    cols = slice(0, 30) if contract["edge"] == "left" else slice(width - 30, width)
    return rows, cols


def grow_from_socket(mask: np.ndarray, socket_id: str, contract: dict) -> np.ndarray:
    """Keep only the diff components geodesically connected to the socket mouth."""
    bridged = ndimage.binary_dilation(mask, iterations=BRIDGE_ITER)
    labels, _ = ndimage.label(bridged)
    rows, cols = socket_window(mask.shape, socket_id, contract)
    seed_labels = set(np.unique(labels[rows, cols])) - {0}
    if not seed_labels:
        raise ValueError(f"no route delta reaches socket {socket_id}")
    return mask & np.isin(labels, list(seed_labels))


def auto_features(mask: np.ndarray) -> np.ndarray:
    """Largest interior components -- used for loops and other socketless deltas."""
    height, width = mask.shape
    labels, count = ndimage.label(ndimage.binary_dilation(mask, iterations=BRIDGE_ITER))
    best: list[int] = []
    for index in range(1, count + 1):
        component = labels == index
        area = int((mask & component).sum())
        if area < 8 * MIN_COMPONENT_PX:
            continue
        ys, xs = np.nonzero(component)
        cy, cx = ys.mean() / height, xs.mean() / width
        if 0.26 <= cy <= 0.75 and 0.08 <= cx <= 0.92:
            best.append(index)
    if not best:
        raise ValueError("no interior route feature found")
    return mask & np.isin(labels, best)


def feather(mask: np.ndarray) -> np.ndarray:
    alpha = ndimage.gaussian_filter(mask.astype(np.float32), FEATHER_SIGMA)
    return np.clip(alpha * 1.6, 0.0, 1.0)


def part_depth(extract: str, contracts: dict) -> float:
    if extract == "auto":
        return 0.45
    return contracts[extract]["center"]


def road_connectivity(image: Image.Image, sockets: list[str], contracts: dict) -> dict:
    """Flood the road network from B0 and confirm every mouth is on it."""
    rgb = np.asarray(image.convert("RGB"))
    road = ndimage.binary_dilation(prep.road_mask(rgb), iterations=3)
    labels, _ = ndimage.label(road)
    height, width = road.shape
    b0 = labels[height - 12 :, width // 2 - int(0.10 * width) : width // 2 + int(0.10 * width)]
    main = set(np.unique(b0)) - {0}
    result = {}
    for socket_id in sockets:
        contract = contracts[socket_id]
        if socket_id == "B0":
            window = b0
        elif socket_id == "T0":
            top = int(0.16 * height)
            window = labels[: top + 40, width // 2 - int(0.10 * width) : width // 2 + int(0.10 * width)]
        else:
            rows, cols = socket_window(road.shape, socket_id, contract)
            window = labels[rows, cols]
        result[socket_id] = bool(main & (set(np.unique(window)) - {0}))
    return result


def save_debug(donor: np.ndarray, mask: np.ndarray, name: str) -> None:
    overlay = donor.copy()
    overlay[mask] = overlay[mask] * 0.4 + np.array([255.0, 44.0, 134.0]) * 0.6
    debug_dir = OUT / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(overlay.astype(np.uint8)).save(debug_dir / f"{name}.png")


def compose(recipe: dict, base: np.ndarray, contracts: dict) -> np.ndarray:
    """Blend all parts jointly: where parts overlap, the donor that changes the
    base the most wins, so a real branch always beats another donor's subtle
    main-corridor re-wiggle instead of being painted over by it."""
    alphas, weights, donors = [], [], []
    for donor_id, extract in recipe["parts"]:
        donor = load_rgb(donor_id)
        delta = raw_delta(donor, base)
        if extract == "auto":
            selected = auto_features(delta)
        else:
            selected = grow_from_socket(delta, extract, contracts[extract])
        save_debug(donor, selected, f'{recipe["id"]}__{donor_id}_{extract}')
        alpha = feather(selected)
        distance = ndimage.gaussian_filter(
            np.sqrt(((donor - base) ** 2).sum(axis=-1)), 4.0
        )
        # Cream road pixels get a large bonus: a thin far branch must not be
        # averaged into mud by another donor's overlapping land delta.
        road_boost = 1.0 + 12.0 * ndimage.gaussian_filter(
            prep.road_mask(donor.astype(np.uint8)).astype(np.float32), 2.0
        )
        alphas.append(alpha)
        weights.append(alpha * (distance**2 + 1e-3) * road_boost)
        donors.append(donor)
        print(f'  + {donor_id}:{extract:5s} delta {100.0 * selected.mean():4.1f}% of canvas')

    coverage = 1.0 - np.prod([1.0 - alpha for alpha in alphas], axis=0)
    weight_sum = np.sum(weights, axis=0)
    safe = np.where(weight_sum > 0, weight_sum, 1.0)[..., None]
    donor_mix = np.sum(
        [weight[..., None] * donor for weight, donor in zip(weights, donors)], axis=0
    ) / safe
    donor_mix = np.where(weight_sum[..., None] > 0, donor_mix, base)
    return base * (1.0 - coverage[..., None]) + donor_mix * coverage[..., None]


def validation_panel(composite: Path, reference: Path, output: Path) -> None:
    left = Image.open(composite).convert("RGB")
    right = Image.open(reference).convert("RGB")
    panel = Image.new("RGB", (left.width, left.height * 2 + 8), "#172235")
    panel.paste(left, (0, 0))
    panel.paste(right, (0, left.height + 8))
    panel.save(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-svg", action="store_true")
    parser.add_argument("--only", help="comma-separated recipe ids")
    parser.add_argument("--base", default="01_straight")
    args = parser.parse_args()

    config = json.loads((ROOT / "tile_recipes.json").read_text(encoding="utf-8"))
    contracts = config["socket_contract"]
    vector_canvas = tuple(config.get("vector_canvas", config["normalized_canvas"]))
    (OUT / "normalized").mkdir(parents=True, exist_ok=True)
    (OUT / "svgs").mkdir(parents=True, exist_ok=True)

    base = load_rgb(args.base)
    wanted = set(args.only.split(",")) if args.only else None
    items = []
    for recipe in RECIPES:
        if wanted and recipe["id"] not in wanted:
            continue
        print(f'{recipe["id"]}  ({" ".join(recipe["sockets"])})')
        composite = compose(recipe, base, contracts)
        image = Image.fromarray(np.clip(composite, 0, 255).astype(np.uint8), "RGB")

        seam_report = {}
        for socket_id in recipe["sockets"]:
            contract = contracts[socket_id]
            if contract["edge"] not in ("left", "right"):
                continue
            measured = prep.measure_side_socket(image, contract["edge"], contract["center"])
            image = prep.snap_side_socket(
                image, contract["edge"], measured, contract["center"], contract["road_width"]
            )
            snapped = prep.measure_side_socket(image, contract["edge"], contract["center"])
            seam_report[socket_id] = {
                "measured_center": round(measured["center"], 4),
                "target_center": contract["center"],
                "snapped_center": round(snapped["center"], 4),
                "target_width": contract["road_width"],
                "snapped_width": round(snapped["width"], 4),
            }

        connectivity = road_connectivity(image, recipe["sockets"], contracts)
        normalized_path = OUT / "normalized" / f'{recipe["id"]}.png'
        image.save(normalized_path)

        metadata = {
            "schema_version": 1,
            "id": recipe["id"],
            "label": recipe["label"],
            "topology": f'Composite of {", ".join(f"{d}:{e}" for d, e in recipe["parts"])} over {args.base}.',
            "sockets": recipe["sockets"],
            "socket_contract": {name: contracts[name] for name in recipe["sockets"]},
        }
        path_count = None
        if not args.skip_svg:
            svg_path = OUT / "svgs" / f'{recipe["id"]}.svg'
            path_count = prep.vectorize(normalized_path, svg_path, metadata, vector_canvas)

        if recipe.get("validate_against"):
            validation_panel(
                normalized_path,
                ROOT / "normalized" / f'{recipe["validate_against"]}.png',
                OUT / f'{recipe["id"]}_vs_real.png',
            )

        flush = all(
            abs(report["snapped_center"] - report["target_center"]) <= 0.012
            and abs(report["snapped_width"] - report["target_width"]) <= 0.012
            for report in seam_report.values()
        )
        connected = all(connectivity.values())
        items.append(
            {
                **metadata,
                "parts": recipe["parts"],
                "base": args.base,
                "normalized_png": f'composites/normalized/{recipe["id"]}.png',
                "svg": None if args.skip_svg else f'composites/svgs/{recipe["id"]}.svg',
                "svg_paths": path_count,
                "seam_report": seam_report,
                "connectivity": connectivity,
                "flush": flush,
            }
        )
        status = "FLUSH" if flush else "SEAM DRIFT"
        network = "connected" if connected else f"BROKEN {connectivity}"
        print(f"  = {status}, road network {network}")

    prep.contact_sheet(items, OUT / "contact_sheet.png")
    (OUT / "manifest.json").write_text(json.dumps({
        "schema_version": 1,
        "generation_mode": "delta compositing from image-generated masters, no model",
        "base": args.base,
        "tiles": items,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(items)} composites, manifest, contact sheet to {OUT}")


if __name__ == "__main__":
    main()
