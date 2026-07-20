import { Color } from "three";

export const FANTASY_PALETTE = {
  parchment: new Color(0xeadab5),
  parchmentLight: new Color(0xfff3d2),
  ink: new Color(0x30281f),
  stone: new Color(0x4a6665),
  stoneShadow: new Color(0x263f45),
  foliage: new Color(0x617f51),
  foliageLight: new Color(0x9fca84),
  trim: new Color(0xd7ad61),
  trimLight: new Color(0xffd67d),
  bridge: new Color(0xb9dca2),
  skyTop: new Color(0x7aa8cc),
  skyHorizon: new Color(0xd7e3de),
  skyLower: new Color(0xb9a9be),
  mist: new Color(0xe6dfd5),
  lavender: new Color(0xcbbfe7),
  peach: new Color(0xf0c29b),
  mint: new Color(0xaad7bf)
} as const;

export type FantasyPalette = typeof FANTASY_PALETTE;

/** Returns owned colors so a caller can safely tint a world variant. */
export function cloneFantasyPalette(): Record<keyof FantasyPalette, Color> {
  return Object.fromEntries(
    Object.entries(FANTASY_PALETTE).map(([name, color]) => [name, color.clone()])
  ) as Record<keyof FantasyPalette, Color>;
}
