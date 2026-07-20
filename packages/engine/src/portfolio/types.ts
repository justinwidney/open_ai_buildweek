import type { Cents } from "../money/index.js";

export interface HoldingConfig {
  id: string;
  label: string;
  assetClassId: string;
}

export interface HoldingState {
  config: HoldingConfig;
  balanceCents: Cents;
  /** Cumulative amount contributed (not withdrawn) — the basis growth/gains are measured against. */
  costBasisCents: Cents;
}

export interface PortfolioState {
  holdings: readonly HoldingState[];
}

export function initialHoldingState(config: HoldingConfig, openingBalanceCents: Cents): HoldingState {
  return { config, balanceCents: openingBalanceCents, costBasisCents: openingBalanceCents };
}
