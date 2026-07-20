import type { AdjustableResult } from "../adjustable/index.js";
import { findLineItem } from "../adjustable/index.js";
import type { Cents } from "../money/index.js";

export interface DebtViews {
  totalPaymentCents: Cents;
  principalPortionCents: Cents;
  interestPortionCents: Cents;
  escrowPortionCents: Cents;
  remainingBalanceCents: Cents;
}

export function debtViews(result: AdjustableResult, remainingBalanceCents: Cents): DebtViews {
  return {
    totalPaymentCents: result.grossCents,
    principalPortionCents: -findLineItem(result.lineItems, "principalPortion"),
    interestPortionCents: -findLineItem(result.lineItems, "interestPortion"),
    escrowPortionCents: -findLineItem(result.lineItems, "escrowPortion"),
    remainingBalanceCents,
  };
}
