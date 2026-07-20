# Floater sprite generation record

Mode: built-in image generation edit using the local reference image, followed
by magenta chroma-key removal and deterministic per-cell crops.

Reference: `finished/ChatGPT Image Jul 20, 2026, 12_31_34 PM (3).png`

Final prompt:

> Use case: background-extraction. Asset type: reusable 2.5D game sprite sheet
> derived from the supplied watercolor floater plate. Isolate the same six
> distinct subjects from the reference—the large striped hot-air balloon, tiny
> floating structure, small tree-covered floating island, large tree-covered
> floating island, small distant balloon, and large fantasy airship—and place
> them one per cell in a clean 3 by 2 layout. Preserve the reference's delicate
> pastel watercolor style, outlines, colors, identity, and internal detail. One
> complete subject per cell with generous uniform padding, no cropping, overlap,
> grid lines, or cell borders. Use a perfectly flat solid `#ff00ff` chroma-key
> background. Add no objects, labels, text, watermark, floor, cast shadow, or
> reflections. Do not use the key color inside a subject. Keep foliage greens
> and balloon rigging intact, with crisp edges for independent animation.

The six `*-final.png` files are the runtime assets. Temporary green-key,
magenta-key, and rejected cutout variants were removed after validation; the
built-in generator retains its original generated sheets outside this project.
