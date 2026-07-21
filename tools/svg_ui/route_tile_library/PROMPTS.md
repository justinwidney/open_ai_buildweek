# Image-generation prompt set

Mode: OpenAI built-in image generation, one edit call per variant. No CLI or
API-key fallback was used.

Edit target:
`../../svg/generated/reference_06_03_continuous_road.png`

The exact per-variant topology sentences are stored in
`tile_recipes.json`. Each was inserted into this shared production prompt:

```text
Use case: stylized-concept
Asset type: modular watercolor route tile, variant <ID>
Primary request: Edit Image 1. <TOPOLOGY FROM tile_recipes.json>
Input images: Image 1 is the edit target and strict style, world, camera,
perspective, and composition reference. When supplied, Image 2/3 are paired
connector-geometry references only.
Scene/backdrop: Preserve the original castle, blue-sky floating-island world,
water, clouds, waterfalls, distant islands, trees, rocks, and flowers.
Style/medium: Preserve the exact detailed watercolor storybook game-concept
style, brush texture, palette, atmospheric depth, perspective, and wide framing.
Composition/framing: Preserve the original bottom-center road entry and centered
castle destination. Every side road must physically reach the requested canvas
edge, be perpendicular and unobstructed for its final 8% of canvas width, and
sit on a broad continuous grassy floating-island shelf with an irregular edge,
visible rocky cliff underside, trees, shrubs, flowers, and waterfalls. Keep open
blue-water gaps so all route geometry reads clearly.
Constraints: Change only land and road geometry needed for this topology. Every
route is a continuous warm cream dirt path. No unsupported road ribbon,
bridge-only road, ambiguous beige decoration, dead end before an edge,
unintended extra fork, tangled crossing, text, label, arrow, sign, character,
vehicle, UI, border, or watermark.
```

Paired connector generation used these image references:

- Near geometry: `06_near_exit_left.png` / `07_near_exit_right.png`
- Mid geometry: `09_mid_exit_left.png` / `10_mid_exit_right.png`
- Far geometry: `11_far_exit_left.png` / `12_far_exit_right.png`
- Multi-exit correction: near and far reference images were supplied together,
  with the additional constraint that both paths physically intersect their
  canvas edges and never taper out early.

Because image generation is not pixel-deterministic, `prepare_tile_library.py`
performs the final deterministic seam snap after generation.
