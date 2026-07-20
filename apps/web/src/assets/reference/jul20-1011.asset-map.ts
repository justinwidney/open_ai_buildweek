/**
 * Stable names for regions in the Jul 20, 2026 "Control AI" reference.
 *
 * This module deliberately stores coordinates only. The source screenshot stays
 * outside the shipped application; use the adjacent extractor manifest to make
 * reviewed, app-local crops when a region is genuinely needed at runtime.
 */
export const JUL20_1011_REFERENCE = {
  id: 'jul20-1011-control-ai',
  source: {
    path: 'finished/ChatGPT Image Jul 20, 2026, 10_11_35 AM.png',
    width: 1916,
    height: 821,
  },
} as const;

export type ReferenceRegionKind = 'ui' | 'signage' | 'world-guide' | 'background-guide';

export type ReferenceRegion = {
  /** Pixel bounds in the immutable source image: [x, y, width, height]. */
  crop: readonly [number, number, number, number];
  /** Whether the extractor may create a lossless PNG for review/use. */
  exportable: boolean;
  kind: ReferenceRegionKind;
  note: string;
};

/**
 * UI/sign crops are small, named review targets. Large painterly areas are
 * composition guides only: a screenshot crop would not hold up as a 3D asset.
 */
export const jul20_1011Regions = {
  brand: {
    crop: [24, 15, 265, 56],
    exportable: true,
    kind: 'ui',
    note: 'Menu, settings seal, and two-line Control AI wordmark.',
  },
  toolbar: {
    crop: [775, 8, 363, 57],
    exportable: true,
    kind: 'ui',
    note: 'Centered row of six cream square controls.',
  },
  activeSkillCard: {
    crop: [1675, 57, 215, 622],
    exportable: true,
    kind: 'ui',
    note: 'Parchment skill sidebar; use as layout reference, not one rasterized component.',
  },
  questionDock: {
    crop: [1460, 748, 422, 64],
    exportable: true,
    kind: 'ui',
    note: 'Bottom-right cream question input with purple help medallion.',
  },
  valuesSign: {
    crop: [43, 503, 174, 151],
    exportable: true,
    kind: 'signage',
    note: 'Left-route Values sign; candidate world billboard.',
  },
  strengthsSign: {
    crop: [418, 385, 147, 120],
    exportable: true,
    kind: 'signage',
    note: 'Left-route Strengths sign; candidate world billboard.',
  },
  mindsetSign: {
    crop: [1281, 284, 113, 105],
    exportable: true,
    kind: 'signage',
    note: 'Right-route Mindset sign; candidate world billboard.',
  },
  timeEnergySign: {
    crop: [1456, 405, 163, 146],
    exportable: true,
    kind: 'signage',
    note: 'Right-route Time & Energy sign; candidate world billboard.',
  },
  foundationPlatform: {
    crop: [369, 457, 837, 364],
    exportable: false,
    kind: 'world-guide',
    note: 'Guide for a procedural hero platform; keep lettering in DOM/canvas rather than a screenshot texture.',
  },
  horizon: {
    crop: [0, 69, 1670, 422],
    exportable: false,
    kind: 'background-guide',
    note: 'Guide for layered parallax sky, distant mountains, and atmospheric fog.',
  },
} as const satisfies Record<string, ReferenceRegion>;

export type ReferenceRegionId = keyof typeof jul20_1011Regions;

/** Named visual roles keep Three, DOM UI, and future importers decoupled. */
export const visualAssetRoles = {
  heroPlatform: { kind: 'procedural-3d', region: 'foundationPlatform' },
  forwardRoute: { kind: 'procedural-3d', region: 'foundationPlatform' },
  leftRouteSign: { kind: 'billboard', region: 'valuesSign' },
  leftRouteDetail: { kind: 'billboard', region: 'strengthsSign' },
  rightRouteSign: { kind: 'billboard', region: 'mindsetSign' },
  rightRouteDetail: { kind: 'billboard', region: 'timeEnergySign' },
  skyParallax: { kind: 'layered-2d', region: 'horizon' },
  appChrome: { kind: 'dom-ui', region: 'activeSkillCard' },
} as const;
