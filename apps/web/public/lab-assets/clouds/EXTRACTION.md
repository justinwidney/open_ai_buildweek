# Cloud shape-segmentation record

The cloud atlas is not sliced with rectangular ownership. Rectangles inevitably
capture parts of nearby clouds. Each exported PNG instead comes from one
connected shape component:

1. Convert the atlas to a high-threshold silhouette mask.
2. Close small brush gaps so one painted cloud remains one component.
3. Label connected components and retain exactly one component ID.
4. Multiply that component by a soft color-distance alpha derived from the
   original atlas, preserving translucent watercolor edges.
5. Apply the result to the untouched source pixels.
6. Trim transparent space only after the shape is isolated.

Source atlas: `finished/ChatGPT Image Jul 20, 2026, 02_39_01 PM.png`  
Separate backwall: `finished/ChatGPT Image Jul 20, 2026, 02_39_16 PM.png`  
Runtime backwall: `public/world-background/sunrise-backwall-v2.webp`

Component IDs and runtime paths are recorded in `manifest.json`. Inspect the
sprites on a blue background after every extraction; no unrelated neighboring
shape may remain in the sprite.
