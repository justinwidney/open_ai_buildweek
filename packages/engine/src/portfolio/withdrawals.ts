import { clampNonNegative } from "../money/index.js";
import type { Cents } from "../money/index.js";
import type { AdjustmentContext } from "../adjustable/index.js";
import { longTermCapitalGainsTaxCents } from "../tax/index.js";
import type { HoldingState } from "./types.js";

export interface WithdrawalResult {
  /** What was actually removed from the holding — capped at its balance even if more was requested. */
  grossWithdrawalCents: Cents;
  /** The proportional share of the withdrawal attributable to gain rather than returned cost basis. */
  realizedGainCents: Cents;
  capitalGainsTaxCents: Cents;
  /** What actually reaches the household's cash after capital gains tax. */
  netProceedsCents: Cents;
  nextState: HoldingState;
}

/**
 * Withdraws up to `requestedCents` from a holding, computing the realized
 * gain as the same proportion of the withdrawal that the whole balance's
 * unrealized gain represents (a simplified average-cost-basis model,
 * not a specific-lot/FIFO/LIFO election — a documented simplification).
 */
export function withdrawFromHolding(state: HoldingState, requestedCents: Cents, ctx: AdjustmentContext): WithdrawalResult {
  const grossWithdrawalCents = Math.min(requestedCents, state.balanceCents);
  const unrealizedGainCents = clampNonNegative(state.balanceCents - state.costBasisCents);
  const gainFraction = state.balanceCents > 0 ? unrealizedGainCents / state.balanceCents : 0;
  const realizedGainCents = Math.round(grossWithdrawalCents * gainFraction);
  const costBasisRemovedCents = grossWithdrawalCents - realizedGainCents;

  const capitalGainsTaxCents = longTermCapitalGainsTaxCents(ctx, realizedGainCents);

  const nextState: HoldingState = {
    ...state,
    balanceCents: state.balanceCents - grossWithdrawalCents,
    costBasisCents: clampNonNegative(state.costBasisCents - costBasisRemovedCents),
  };

  return {
    grossWithdrawalCents,
    realizedGainCents,
    capitalGainsTaxCents,
    netProceedsCents: grossWithdrawalCents - capitalGainsTaxCents,
    nextState,
  };
}
