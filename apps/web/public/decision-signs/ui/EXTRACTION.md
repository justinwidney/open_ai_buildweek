# Interface chrome extraction record

Source: `finished/ChatGPT Image Jul 20, 2026, 10_15_52 AM.png` (section 1, "UI Pieces")
Source dimensions: 1448 × 1086
Method: deterministic ImageMagick crops, connected corner-background removal
at 12% fuzz, then transparent trim. No generative redraw was used; the source
line work and texture pixels are preserved.

| Output | Source crop (`width × height + x + y`) | Trimmed size |
| --- | --- | --- |
| `rule-long.png` | `252×42+26+408` | 216×27 |
| `corner-scroll.png` | `46×70+275+410` | 43×60 |
| `ornament-gem.png` | `132×86+346+401` | 130×81 |
| `corner-leaf.png` | `76×60+481+410` | 59×50 |
| `badge-crest.png` | `140×112+20+300` | 93×103 |

`corner-scroll` is the top-left orientation; the remaining three corners are
produced with CSS `transform: scaleX/scaleY(-1)` rather than four separate
files. `rule-long` tiles horizontally via `border-image` so section dividers
stretch without distorting the carved end caps.

The section-1 crop boxes sit close to their engraved labels ("Decorative
Badge", "Border & Corner Pieces"). Crop below the label baseline or the
flood-fill keeps the lettering — verify each cutout against a mid-blue
background before recording it here.

Still unextracted from section 1: the icon-button set, the four button states,
and the search bar. Those are raster at ~48px and would need redraw to survive
retina scaling, so the interface uses CSS controls with these carved
ornaments applied as accents instead.
