import { applyRate, clampNonNegative } from "../money/index.js";
import type { Cents } from "../money/index.js";
import type { FinancialAssetState } from "./types.js";

/** Grows a cash/savings-style balance by one month of its configured annual rate, then applies net deposits/withdrawals. */
export function tickFinancialAsset(state: FinancialAssetState, netCashFlowCents: Cents): FinancialAssetState {
  const monthlyRate = state.config.annualInterestRate / 12;
  const interestEarnedCents = applyRate(state.balanceCents, monthlyRate);
  const nextBalance = clampNonNegative(state.balanceCents + interestEarnedCents + netCashFlowCents);
  return { ...state, balanceCents: nextBalance };
}
