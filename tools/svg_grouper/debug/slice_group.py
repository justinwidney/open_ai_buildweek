#!/usr/bin/env python3
"""
slice_group.py — Pull a group out of a grouped SVG to eyeball whether the
segmentation got it right.

A group may be emitted in several parts (ids suffixed __p2, __p3 ...) that all
share one `class`; matching is done against the class attribute (falling back
to id) with a substring, so `road` matches `obj_00_scene__road_09` and all of
its parts at once.

Modes:
  only    keep just the matched group(s), on a white canvas   (default)
  remove  delete the matched group(s), keep everything else
  tint    recolor the matched group(s) bright red in place

Examples:
  python slice_group.py scene_grouped.svg road
  python slice_group.py scene_grouped.svg obj_02 --mode remove -o no_clouds.svg
  python slice_group.py scene_grouped.svg vegetation_15 --mode tint

Render the result with debug/render_diff.js or any SVG viewer.
"""
import argparse
import re
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("grouped_svg")
    ap.add_argument("match", help="substring of the group class/id to slice")
    ap.add_argument("--mode", choices=["only", "remove", "tint"], default="only")
    ap.add_argument("-o", "--out", help="output SVG (default <stem>_<match>_<mode>.svg)")
    ap.add_argument("--tint-color", default="#FF2222")
    args = ap.parse_args()

    src = Path(args.grouped_svg)
    text = src.read_text(encoding="utf-8")

    # find matching <g ...> opening tags, then scan for the balanced </g> so
    # parent groups with nested subgroups are captured whole
    tag_tok = re.compile(r"<g\b|</g>")
    spans = []
    for m in re.finditer(r"<g [^>]*>", text):
        tag = m.group(0)
        attrs = dict(re.findall(r'(\w[\w-]*)="([^"]*)"', tag))
        if args.match not in attrs.get("class", "") and args.match not in attrs.get("id", ""):
            continue
        depth = 0
        for t in tag_tok.finditer(text, m.start()):
            depth += 1 if t.group(0) != "</g>" else -1
            if depth == 0:
                spans.append((m.start(), t.end(), attrs.get("id", "?")))
                break
    # drop spans nested inside an already matched span (parent covers them)
    spans.sort()
    top = []
    for s in spans:
        if not top or s[0] >= top[-1][1]:
            top.append(s)
    if not top:
        sys.exit(f"no group matching '{args.match}' in {src.name}")
    print(f"matched {len(top)} group part(s): {', '.join(s[2] for s in top)}")

    if args.mode == "only":
        svg_open = re.search(r"<svg\b[^>]*>", text).group(0)
        w = re.search(r'width="([\d.]+)"', svg_open)
        h = re.search(r'height="([\d.]+)"', svg_open)
        bgrect = (f'<rect width="{w.group(1)}" height="{h.group(1)}" fill="white"/>'
                  if w and h else "")
        out_text = (svg_open + bgrect
                    + "".join(text[a:b] for a, b, _ in top) + "</svg>")
    elif args.mode == "remove":
        out_text = text
        for a, b, _ in reversed(top):
            out_text = out_text[:a] + out_text[b:]
    else:
        out_text = text
        for a, b, _ in reversed(top):
            chunk = re.sub(r'fill="#[0-9A-Fa-f]{3,6}"',
                           f'fill="{args.tint_color}"', out_text[a:b])
            out_text = out_text[:a] + chunk + out_text[b:]

    out = Path(args.out) if args.out else src.with_name(
        f"{src.stem}_{re.sub(r'[^A-Za-z0-9_-]', '_', args.match)}_{args.mode}.svg")
    out.write_text(out_text, encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
