# Reference asset workflow

`jul20-1011.asset-map.ts` is the code-level visual map for the supplied
1916 x 821 Control AI reference. It is intentionally usable before any image
assets have been staged: scene and UI code can use the role names and visual
tokens without importing a file outside `apps/web`.

## Create reviewed local crops

The importer is non-destructive and uses the existing PNG extractor:

```powershell
node tools/pixel/extract-atlas.mjs --manifest apps/web/src/assets/reference/jul20-1011.extract.json
```

It writes only to `apps/web/public/reference-crops/jul20-1011/`. These crops
are a review/source layer, never a required application dependency. Add a
crop to a runtime texture only after it is named in the asset map and has
appropriate licensing/approval.

## Rendering boundaries

- Build platforms, bridges, route markers, and terrain procedurally in Three.
- Build the right skill panel, left menu, toolbar, and question dock as DOM
  UI using `visual-tokens.ts`; do not ship screenshot crops as UI.
- Use cropped signs only as temporary billboard art. Replace them with
  app-owned SVG/canvas illustrations before production.
- Treat `tools/pixel/preview.png` as a separate low-resolution optional
  vocabulary. Its generated sprites should be consumed through the UI package
  once that package exposes them, rather than copied into the web app.

## Reference composition notes

The visual hierarchy is a warm circular foundation platform at the lower
center, a straight numbered progression disappearing into a bright central
horizon, left/right islands framing diagonal routes, and parchment chrome
anchored to the screen. Preserve this depth ordering with parallax layers:
sky, distant ranges, middle islands, world geometry, foreground vegetation,
then screen UI.
