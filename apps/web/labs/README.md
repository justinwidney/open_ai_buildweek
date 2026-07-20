# Isolated world labs

Each HTML entry owns one question and one TypeScript controller. No lab imports
`WorldExperience.tsx`, so behavior can be approved before it changes the main
world loop.

| Issue | HTML entry | Lab controller | Production seam under test |
| --- | --- | --- | --- |
| A. Platform art quality | `platform-art.html` | `src/labs/platformArtLab.ts` | `src/world/geometry/platforms/createLayeredPlatform.ts` |
| B. Every spatial element rotates | `rotation-rig.html` | `src/labs/rotationRigLab.ts` | `src/world/WorldExperience.tsx` world-root ownership |
| C. Travel is continuous | `travel-rig.html` | `src/labs/travelRigLab.ts` | `src/world/animation/island-transition/islandTransition.ts` |
| D. Left/right reveal different background sectors | `background-pan.html` | `src/labs/backgroundPanLab.ts` | `src/world/background/layers/LayeredParallaxBackground.tsx` |
| E. Floaters are independent sprites | `floater-sprites.html` | `src/labs/floaterSpritesLab.ts` | `public/lab-assets/floaters/manifest.json` |
| F. Camera stands on the platform | `platform-view.html` | `src/labs/platformViewLab.ts` | `src/world/WorldExperience.tsx` camera/navigation rig |

Shared lab-only code lives in `src/labs/lab.css`, `threeLab.ts`, and
`labWorldObjects.ts`. Promoting a lab should copy only its demonstrated API or
transform rule into the named production seam.
