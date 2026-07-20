# Platform detail extraction record

Source: `finished/ChatGPT Image Jul 20, 2026, 10_23_53 AM.png`  
Source dimensions: 1536 × 1024  
Method: deterministic ImageMagick crops, connected corner-background removal
at 11% fuzz, then transparent trim. No generative redraw was used; the source
line work and texture pixels are preserved.

| Output | Source crop (`width × height + x + y`) | Trimmed size |
| --- | --- | --- |
| `carved-platform.png` | `204×130+8+20` | 193×121 |
| `tree-island.png` | `147×202+8+170` | 106×171 |
| `waterfall-island.png` | `151×204+548+169` | 114×159 |
| `castle-island.png` | `145×204+968+169` | 115×174 |
| `rope-bridge.png` | `175×157+6+390` | 164×105 |
| `lantern.png` | `65×150+354+392` | 65×117 |
| `sign.png` | `100×154+1348+391` | 87×109 |
| `flower-bed.png` | `177×146+998+567` | 177×122 |
| `storybook-tree.png` | `155×163+5+736` | 146×142 |
| `purple-flag.png` | `108×157+1032+737` | 71×98 |
| `small-platform.png` | `126×130+222+19` | 125×108 |

When adding another atlas object, crop only one object, flood from all four
corners, inspect it against a mid-blue background, then record its actual
trimmed aspect ratio in `src/world/assets/platformDetailCards.ts`.
