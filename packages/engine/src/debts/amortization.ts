import type { Cents } from "../money/index.js";

/** Standard fixed monthly payment for a fully-amortizing loan (the classic annuity-payment formula). */
export function computeAmortizedPaymentCents(principalCents: Cents, annualRate: number, termMonths: number): Cents {
  if (termMonths <= 0) throw new RangeError("termMonths must be positive");
  if (principalCents <= 0) return 0;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return Math.round(principalCents / termMonths);
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const payment = (principalCents * monthlyRate * factor) / (factor - 1);
  return Math.round(payment);
}
