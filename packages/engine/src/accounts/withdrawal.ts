import { clampNonNegative, roundHalfEven } from "../money/index.js";
import type { Cents } from "../money/index.js";
import type { AccountType } from "./types.js";
import { accountTypeInfo } from "./info.js";

export interface WithdrawalTaxClassification {
  /** Amount actually withdrawn (capped at the balance). */
  grossAmountCents: Cents;
  /** Portion that is neither taxed nor penalized — return of basis, or a qualified distribution. */
  taxFreeCents: Cents;
  /** Portion taxed as ordinary income (tax-deferred distributions, non-qualified Roth/HSA/529 earnings). */
  ordinaryIncomeCents: Cents;
  /** Portion realized as a long-term capital gain (taxable-account sales). */
  capitalGainsCents: Cents;
  /** Additional-tax penalty owed on top of the withdrawal (not a slice of it). */
  penaltyCents: Cents;
}

export interface ClassifyWithdrawalParams {
  accountType: AccountType;
  requestedCents: Cents;
  balanceCents: Cents;
  /** Contributed (after-tax) basis in the account — used for taxable gains and Roth/529 return-of-basis ordering. */
  costBasisCents: Cents;
  /** Age in years (fractional allowed, e.g. 59.5) at the time of withdrawal. */
  ageYears: number;
  /** For HSA/529: is this a qualified (medical/education) distribution? Ignored for other types. */
  qualifiedExpense?: boolean;
}

/**
 * Classifies the tax character of a withdrawal by account type. This is the
 * "what will it cost me to pull money out of *this* account now?" answer — it
 * does not itself compute the dollar tax (that runs through `tax/`), only the
 * taxable/penalized decomposition. `taxFree + ordinaryIncome + capitalGains`
 * always equals the gross withdrawal; `penalty` is additional.
 *
 * Simplifications (documented, not bugs): average-cost basis (no specific-lot
 * selection); Roth/529 use contributions-first ordering; the Roth 5-year rule
 * and 529/HSA qualified-expense *verification* are the caller's concern — this
 * takes `qualifiedExpense` at face value.
 */
export function classifyWithdrawalTax(params: ClassifyWithdrawalParams): WithdrawalTaxClassification {
  const info = accountTypeInfo(params.accountType);
  const grossAmountCents = Math.min(clampNonNegative(params.requestedCents), clampNonNegative(params.balanceCents));

  const zero: WithdrawalTaxClassification = { grossAmountCents, taxFreeCents: 0, ordinaryIncomeCents: 0, capitalGainsCents: 0, penaltyCents: 0 };
  if (grossAmountCents === 0) return zero;

  const gainFraction = params.balanceCents > 0 ? clampNonNegative(params.balanceCents - params.costBasisCents) / params.balanceCents : 0;
  const gainPortion = roundHalfEven(grossAmountCents * gainFraction);
  const basisPortion = grossAmountCents - gainPortion;
  const beforePenaltyAge = info.penaltyFreeAge !== null && params.ageYears < info.penaltyFreeAge;
  const penaltyOn = (amount: Cents): Cents => (beforePenaltyAge ? roundHalfEven(amount * info.earlyWithdrawalPenaltyRate) : 0);

  switch (info.taxTreatment) {
    case "taxable":
      // Selling realizes the gain as a long-term capital gain; the basis returns tax-free.
      return { ...zero, taxFreeCents: basisPortion, capitalGainsCents: gainPortion };

    case "taxDeferred":
      // Every dollar was pretax going in, so every dollar is ordinary income coming out.
      return { ...zero, ordinaryIncomeCents: grossAmountCents, penaltyCents: penaltyOn(grossAmountCents) };

    case "roth": {
      // Contributions (basis) come out first, always tax- and penalty-free. Earnings are tax-free
      // only if qualified (here: at/after the penalty-free age); otherwise ordinary income + penalty.
      const basisOut = Math.min(grossAmountCents, params.costBasisCents);
      const earningsOut = grossAmountCents - basisOut;
      if (!beforePenaltyAge) return { ...zero, taxFreeCents: grossAmountCents };
      return { ...zero, taxFreeCents: basisOut, ordinaryIncomeCents: earningsOut, penaltyCents: penaltyOn(earningsOut) };
    }

    case "hsa":
      if (params.qualifiedExpense) return { ...zero, taxFreeCents: grossAmountCents };
      return { ...zero, ordinaryIncomeCents: grossAmountCents, penaltyCents: penaltyOn(grossAmountCents) };

    case "education529":
      if (params.qualifiedExpense) return { ...zero, taxFreeCents: grossAmountCents };
      // Non-qualified: only the earnings are taxed + penalized; contributed basis returns tax-free.
      // The 529 penalty is gated on qualification, not age (scholarship/disability/death waivers
      // are not modeled), so it applies here regardless of `ageYears`.
      return { ...zero, taxFreeCents: basisPortion, ordinaryIncomeCents: gainPortion, penaltyCents: roundHalfEven(gainPortion * info.earlyWithdrawalPenaltyRate) };
  }
}
