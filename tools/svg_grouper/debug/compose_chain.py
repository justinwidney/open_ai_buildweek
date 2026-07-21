#!/usr/bin/env python3
"""
compose_chain.py — Snap exported chunks together into a new scene by their
road ports.

Chunks are chained top-to-bottom: each chunk is translated so its topmost
road port lands on the previous chunk's bottommost road port. Chunks without
ports (islands, clouds) can be dropped in at explicit positions. The same
chunk id may be repeated — every use gets its own clip-path ids.

Examples:
  python compose_chain.py chunks_dir out.svg chunk_04_castle_road chunk_05_platform_road chunk_01_platform_road
  python compose_chain.py chunks_dir out.svg chunk_04_castle_road chunk_05_platform_road chunk_05_platform_road \
         --at chunk_03_island:60,300 --at chunk_20_cloud:900,120 --jitter 25

--jitter shifts every link horizontally by a random amount within +-N px, so
repeated runs produce different zigzag designs (use --seed for repeatability).
"""
import argparse
import json
import random
import re
import sys
from pathlib import Path


def load_chunk(chunks_dir, meta):
    text = (chunks_dir / meta["file"]).read_text(encoding="utf-8")
    body = text[text.index("<defs") : text.rindex("</g>") + 4]
    return body


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("chunks_dir")
    ap.add_argument("out")
    ap.add_argument("chain", nargs="+", help="chunk ids to chain by road ports")
    ap.add_argument("--at", action="append", default=[],
                    metavar="ID:X,Y", help="place an extra chunk at x,y (its bbox top-left)")
    ap.add_argument("--jitter", type=float, default=0.0,
                    help="random horizontal offset per link (px)")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--bg", default="#6DB1CD")
    ap.add_argument("--margin", type=float, default=30.0)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    chunks_dir = Path(args.chunks_dir)
    manifest = json.loads((chunks_dir / "chunks.json").read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in manifest["chunks"]}

    placed = []  # (meta, dx, dy)
    prev_port = None
    for cid in args.chain:
        if cid not in by_id:
            sys.exit(f"unknown chunk id {cid}; see {chunks_dir/'chunks.json'}")
        meta = by_id[cid]
        ports = sorted(meta["road_ports"], key=lambda p: p[1])
        if prev_port is None:
            dx = dy = 0.0
        else:
            if not ports:
                sys.exit(f"{cid} has no road ports; use --at to place it")
            top = ports[0]
            dx = prev_port[0] - top[0] + rng.uniform(-args.jitter, args.jitter)
            dy = prev_port[1] - top[1]
        placed.append((meta, dx, dy))
        if ports:
            bot = ports[-1]
            prev_port = [bot[0] + dx, bot[1] + dy]
    for spec in args.at:
        cid, xy = spec.split(":")
        x, y = (float(v) for v in xy.split(","))
        meta = by_id[cid]
        placed.append((meta, x - meta["bbox"][0], y - meta["bbox"][1]))

    xs, ys = [], []
    for meta, dx, dy in placed:
        b = meta["bbox"]
        xs += [b[0] + dx, b[2] + dx]
        ys += [b[1] + dy, b[3] + dy]
    x0, y0 = min(xs) - args.margin, min(ys) - args.margin
    w = max(xs) - x0 + args.margin
    h = max(ys) - y0 + args.margin

    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" '
             f'viewBox="{x0:g} {y0:g} {w:g} {h:g}" width="{w:g}" height="{h:g}">',
             f'<rect x="{x0:g}" y="{y0:g}" width="{w:g}" height="{h:g}" fill="{args.bg}"/>']
    for n, (meta, dx, dy) in enumerate(placed):
        body = load_chunk(chunks_dir, meta)
        # unique clip ids per placement so a chunk can be reused
        body = body.replace(f'id="{meta["id"]}"', f'id="{meta["id"]}_u{n}"') \
                   .replace(f'url(#{meta["id"]})', f'url(#{meta["id"]}_u{n})')
        lines.append(f'<g transform="translate({dx:g} {dy:g})" data-chunk="{meta["id"]}">')
        lines.append(body)
        lines.append("</g>")
    lines.append("</svg>")
    Path(args.out).write_text("\n".join(lines), encoding="utf-8")
    print(f"composed {len(placed)} chunks -> {args.out}  ({w:.0f}x{h:.0f})")


if __name__ == "__main__":
    main()
