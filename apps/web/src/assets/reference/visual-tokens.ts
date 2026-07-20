/** Visual language sampled from the reference, expressed as app-owned tokens. */
export const visualTokens = {
  color: {
    ink: '#2E2A28',
    inkMuted: '#5D5043',
    parchment: '#F1E7D3',
    parchmentRaised: '#FFF6E4',
    parchmentShade: '#C6AD89',
    parchmentEdge: '#705B45',
    gold: '#C89C48',
    goldHighlight: '#F5D88A',
    purpleAccent: '#80659B',
    skyDeep: '#6D9BD2',
    skyMist: '#D8D6E6',
    sunrise: '#F3C982',
    moss: '#55743D',
    stone: '#9A7950',
    stoneDark: '#4B4137',
  },
  shadow: {
    ui: '0 3px 0 #705B45, 0 6px 14px rgb(47 37 27 / 35%)',
    floating: '0 16px 28px rgb(35 45 63 / 32%)',
  },
  radius: { control: 12, panel: 18, pill: 999 },
  zIndex: { world: 0, parallax: 1, chrome: 10, modal: 20 },
} as const;

export type VisualTokens = typeof visualTokens;
