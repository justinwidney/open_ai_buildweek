#!/usr/bin/env python3
"""Validate Level Two registered layers and camera travel safety."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


WORKSPACE = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = Path(__file__).resolve().parent / "generated/level-two-slices/layer-manifest.json"
REFERENCE_DISTANCE = math.dist((0.0, 18.0, 10.0), (0.0, 0.0, -8.0))
MINIMUM_CAMERA_CLEARANCE = 8.0
EXPECTED_STOPS = 6


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate_crop(item: dict, label: str) -> None:
    top = float(item["cropTop"])
    bottom = float(item["cropBottom"])
    require(0 <= top < bottom <= 1, f"{label}: crop must satisfy 0 <= top < bottom <= 1")


def validate_manifest(path: Path) -> list[str]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    require(manifest.get("schemaVersion") == 1, "Unsupported layer-manifest schemaVersion")
    source_width = int(manifest["sourceSize"]["width"])
    source_height = int(manifest["sourceSize"]["height"])
    require((source_width, source_height) == (1200, 694), "Runtime registration expects a 1200 x 694 source")

    validate_crop(manifest["base"], "base")
    depth_plates = manifest.get("depthPlates", [])
    require(len(depth_plates) >= 3, "At least far, middle, and near depth plates are required")
    plate_ids = [str(plate["id"]) for plate in depth_plates]
    require(len(plate_ids) == len(set(plate_ids)), "Depth plate IDs must be unique")
    for plate in depth_plates:
        validate_crop(plate, f"depth plate {plate['id']}")
        require(0 <= float(plate["parallax"]) <= 1, f"depth plate {plate['id']}: parallax must be 0..1")

    planes = manifest.get("planes", [])
    plane_ids = [str(plane["id"]) for plane in planes]
    require(len(plane_ids) == len(set(plane_ids)), "Registered plane IDs must be unique")
    for plane in planes:
        width = float(plane["width"])
        height = float(plane["height"])
        x = float(plane["x"])
        y = float(plane["y"])
        require(width > 0 and height > 0, f"plane {plane['id']}: dimensions must be positive")
        require(-width * 0.5 < x < source_width + width * 0.5, f"plane {plane['id']}: outside source horizontally")
        require(-height * 0.5 < y < source_height + height * 0.5, f"plane {plane['id']}: outside source vertically")
        require(0 <= float(plane["parallax"]) <= 1, f"plane {plane['id']}: parallax must be 0..1")

    flags = manifest.get("flags", [])
    flag_ids = [str(flag["id"]) for flag in flags]
    require(len(flag_ids) == len(set(flag_ids)), "Flag IDs must be unique")

    stops = [float(value) for value in manifest["travel"]["cameraPushStops"]]
    require(len(stops) == EXPECTED_STOPS, f"Expected {EXPECTED_STOPS} camera push stops")
    require(stops[0] == 0, "The first camera push stop must be zero")
    require(all(current < following for current, following in zip(stops, stops[1:])), "Camera push stops must increase")
    nearest_depth = min([float(plate["depth"]) for plate in depth_plates] + [float(plane["depth"]) for plane in planes])
    final_clearance = REFERENCE_DISTANCE + nearest_depth - stops[-1]
    require(final_clearance >= MINIMUM_CAMERA_CLEARANCE, "Final camera stop crosses the nearest registered layer")

    asset_paths = {
        "reference_06_03_continuous_road": WORKSPACE / "tools/svg/generated/reference_06_03_continuous_road.svg",
        "reference_06_03_clean_background": WORKSPACE / "tools/svg/generated/level-two-slices/clean-background.svg",
        "mask_far_castle": WORKSPACE / "tools/svg/generated/level-two-slices/masks/far-castle-mask.svg",
        "mask_middle_route": WORKSPACE / "tools/svg/generated/level-two-slices/masks/middle-route-mask.svg",
        "mask_near_route": WORKSPACE / "tools/svg/generated/level-two-slices/masks/near-route-mask.svg",
        "mask_foreground_ledges": WORKSPACE / "tools/svg/generated/level-two-slices/masks/foreground-ledges-mask.svg",
        "animated_cloud_bank": WORKSPACE / "tools/svg/generated/level-two-slices/animated/cloud-bank.png",
        "animated_waterfall": WORKSPACE / "tools/svg/generated/level-two-slices/animated/waterfall.png",
        "water_surface_flow": WORKSPACE / "tools/svg/sprites_svg/water/water_surface_flow.svg",
    }
    referenced_assets = [("base", str(manifest["base"]["assetId"]))]
    referenced_assets.extend((f"depth plate {plate['id']}", str(plate["assetId"])) for plate in depth_plates)
    referenced_assets.extend(
        (f"depth plate {plate['id']} mask", str(plate["maskAssetId"]))
        for plate in depth_plates
        if plate.get("maskAssetId")
    )
    referenced_assets.extend((f"plane {plane['id']}", str(plane["assetId"])) for plane in planes)
    for label, asset_id in referenced_assets:
        if asset_id in asset_paths:
            require(asset_paths[asset_id].is_file(), f"{label}: missing {asset_paths[asset_id]}")

    return [
        f"source={source_width}x{source_height}",
        f"depth plates={len(depth_plates)}",
        f"registered planes={len(planes)}",
        f"flags={len(flags)}",
        f"camera stops={','.join(f'{value:g}' for value in stops)}",
        f"final nearest-layer clearance={final_clearance:.2f}",
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()
    path = args.manifest.resolve()
    for result in validate_manifest(path):
        print(result)


if __name__ == "__main__":
    main()
