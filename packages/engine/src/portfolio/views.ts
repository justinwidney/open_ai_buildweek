import type { Cents } from "../money/index.js";
import { addC, clampNonNegative } from "../money/index.js";
import type { PortfolioState } from "./types.js";

export interface PortfolioViews {
  totalBalanceCents: Cents;
  totalCostBasisCents: Cents;
  unrealizedGainCents: Cents;
  byHolding: readonly { id: string; label: string; balanceCents: Cents; unrealizedGainCents: Cents }[];
}

export function portfolioViews(state: PortfolioState): PortfolioViews {
  const byHolding = state.holdings.map((h) => ({
    id: h.config.id,
    label: h.config.label,
    balanceCents: h.balanceCents,
    unrealizedGainCents: clampNonNegative(h.balanceCents - h.costBasisCents),
  }));

  return {
    totalBalanceCents: addC(...state.holdings.map((h) => h.balanceCents)),
    totalCostBasisCents: addC(...state.holdings.map((h) => h.costBasisCents)),
    unrealizedGainCents: addC(...byHolding.map((h) => h.unrealizedGainCents)),
    byHolding,
  };
}
