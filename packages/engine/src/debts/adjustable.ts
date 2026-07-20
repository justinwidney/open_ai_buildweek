import type { Adjustable } from "../adjustable/index.js";
import { computeAmortizedPaymentCents } from "./amortization.js";
import type { DebtState } from "./types.js";

/**
 * Models a debt payment as an Adjustable whose "gross" is the total cash
 * leaving the household (principal + interest + escrow) and whose
 * adjustments decompose that total into its parts — so `netCents` reaches
 * exactly zero when the payment is fully accounted for, the same
 * reconciliation invariant `adjustable/` enforces everywhere else, just
 * applied to an allocation instead of a tax deduction.
 */
export function buildDebtPaymentAdjustable(state: DebtState): Adjustable {
  const { config, remainingBalanceCents } = state;
  const scheduledPayment = computeAmortizedPaymentCents(config.originalPrincipalCents, config.annualRate, config.termMonths);
  const monthlyRate = config.annualRate / 12;
  const interestCents = Math.round(remainingBalanceCents * monthlyRate);
  // Cap this month's principal+interest at what's actually owed, so the final payment on a loan
  // doesn't overpay past a shrinking remaining balance.
  const maxPayoffCents = remainingBalanceCents + interestCents;
  const principalAndInterestCents = Math.min(scheduledPayment, maxPayoffCents);
  const principalCents = principalAndInterestCents - interestCents;
  const totalPaymentCents = principalAndInterestCents + config.monthlyEscrowCents;

  return {
    id: config.id,
    label: config.label,
    grossCents: () => totalPaymentCents,
    adjustments: [
      { key: "interestPortion", label: "Interest", compute: () => -interestCents },
      { key: "principalPortion", label: "Principal", compute: () => -principalCents },
      { key: "escrowPortion", label: "Escrow (tax & insurance)", compute: () => -config.monthlyEscrowCents },
    ],
  };
}
