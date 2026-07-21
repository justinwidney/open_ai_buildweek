# Level Two registered image-generation prompts

All outputs must preserve the 1649 x 954 framing of
`../reference_06_03_continuous_road.png`. Runtime registration converts these
coordinates to the 1200 x 694 SVG coordinate system.

## Clean fallback plate

Use case: `precise-object-edit`. Use the continuous-road PNG as the edit target.
Preserve its exact framing, camera perspective, main connected island
silhouette, continuous cream road, castle, sun, lighting, palette, and painterly
texture. Remove every cloud, waterfall stream/splash, and castle pennant/flagpole.
Remove disconnected far and middle floating islands on both sides of the castle
and road. Reconstruct sky, haze, water, rock faces, and roof tips behind removed
objects. Keep the two lower-corner foreground ledges. Do not crop, zoom, rotate,
mirror, add land, change road bends, or move the castle.

## Animated cloud bank

Use case: `stylized-concept`. Create one isolated wide blue-white watercolor
cloud bank matching the reference gouache palette. Center it with generous
padding on a perfectly flat solid `#00ff00` chroma-key background. No land,
water, castle, sun, shadow, gradient, text, or watermark. Do not use the key
color in the cloud.

## Animated waterfall

Use case: `stylized-concept`. Create one isolated tall turquoise-white
watercolor waterfall ribbon matching the reference. Include irregular falling
water, translucent blue washes, white foam streaks, and a small bottom splash.
Center it with generous padding on a perfectly flat solid `#ff00ff` chroma-key
background. No rock, grass, island, water plane, shadow, gradient, text, or
watermark. Do not use the key color in the waterfall.

## Castle pennant

Use case: `stylized-concept`. Create one isolated cobalt-blue triangular castle
pennant on a short warm-gray pole, matching the castle roofs in the reference.
Show the fabric in a gentle rightward wave with crisp silhouette and subtle
watercolor interior texture. Center it with generous padding on a perfectly
flat solid `#00ff00` chroma-key background. No castle, roof, sky, shadow,
gradient, text, or watermark. Do not use the key color in the sprite.

## Semantic depth plates

Generate registered edits rather than reframed illustrations:

1. `far-castle`: sky, sun, haze, castle, and final castle island only.
2. `middle-route`: middle third of the connected island/road and its cliffs.
3. `near-route`: lower connected island/road plus the two foreground ledges.
4. `water`: turquoise water and surface foam only; no land or sky.

For cutouts, place the retained subject at its original location on one uniform
chroma-key background and preserve the full source canvas. After key removal,
the transparent output must remain 1649 x 954 so all layers share registration.
