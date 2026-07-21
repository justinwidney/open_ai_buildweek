# Pre-journey landscape library

These scenes precede the formal floating-island route system. The player is
still making quiet, early-life choices in forests and clearings, while the
blue-roofed castle remains a tiny horizon landmark.

## Contents

- `rasters/`: original full-resolution built-in image-generation results.
- `normalized/`: canonical `1200 x 694` center-cropped PNG masters.
- `svgs/`: full-detail VTracer SVGs traced directly from the normalized PNGs.
- `manifest.json`: scene meaning, dimensions, trace settings, and asset paths.
- `contact_sheet.png`: all nine scenes at a glance.
- `GENERATION_PROMPTS.md`: the reusable prompt set.

## Rebuild

Use the same Python 3.11 environment and VTracer settings as the modular route
tile library:

```powershell
cd tools/svg_ui/pre_journey_library
py -3.11 build_pre_journey.py
```

Use `--resume` to retain completed SVG traces while adding new scenes. Use
`--skip-svg` for a fast PNG/contact-sheet rebuild.
