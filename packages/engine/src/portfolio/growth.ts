import { applyRate, clampNonNegative } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { RandomSource } from "../rng/index.js";
import type { ReturnsStrategy } from "../returns/index.js";
import type { HoldingState } from "./types.js";

/** Grows a holding's balance by one month under whichever ReturnsStrategy the run is configured with. Cost basis is untouched by growth — only contributions/withdrawals move it. */
export function tickHoldingGrowth(state: HoldingState, returnsStrategy: ReturnsStrategy, month: MonthKey, rng: RandomSource): HoldingState {
  const { nominalReturn } = returnsStrategy.nextReturn({ month, assetClassId: state.config.assetClassId, rng });
  const growthCents = applyRate(state.balanceCents, nominalReturn);
  return { ...state, balanceCents: clampNonNegative(state.balanceCents + growthCents) };
}

/** A contribution increases balance and cost basis equally — it creates no gain by itself. */
export function applyContribution(state: HoldingState, amountCents: number): HoldingState {
  return { ...state, balanceCents: state.balanceCents + amountCents, costBasisCents: state.costBasisCents + amountCents };
}
