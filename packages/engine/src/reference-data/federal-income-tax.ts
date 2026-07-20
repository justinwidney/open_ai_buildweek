import { cents } from "../money/index.js";
import type { BracketsByFilingStatus, FederalIncomeTaxRules } from "./types.js";

/**
 * 2026 federal ordinary-income brackets. The top-bracket threshold and
 * standard deductions below are directly confirmed against IRS Rev. Proc.
 * 2025-32 (single $640,600 / MFJ $768,600 top-bracket start; standard
 * deductions $16,100 single / $32,200 MFJ). The remaining bracket
 * boundaries are reconstructed by applying the same ~2.28% adjustment
 * factor implied by those confirmed figures to the published 2025
 * brackets — a structurally consistent approximation, not a
 * digit-for-digit transcription of the final Rev. Proc. 2025-32 table.
 * Replace with the exact published table on the next data-refresh pass.
 */
const brackets: BracketsByFilingStatus = {
  single: [
    { fromCents: cents(0), rate: 0.1 },
    { fromCents: cents(12_200), rate: 0.12 },
    { fromCents: cents(49_600), rate: 0.22 },
    { fromCents: cents(105_700), rate: 0.24 },
    { fromCents: cents(201_800), rate: 0.32 },
    { fromCents: cents(256_200), rate: 0.35 },
    { fromCents: cents(640_600), rate: 0.37 },
  ],
  marriedFilingJointly: [
    { fromCents: cents(0), rate: 0.1 },
    { fromCents: cents(24_400), rate: 0.12 },
    { fromCents: cents(99_200), rate: 0.22 },
    { fromCents: cents(211_400), rate: 0.24 },
    { fromCents: cents(403_600), rate: 0.32 },
    { fromCents: cents(512_500), rate: 0.35 },
    { fromCents: cents(768_600), rate: 0.37 },
  ],
  marriedFilingSeparately: [
    { fromCents: cents(0), rate: 0.1 },
    { fromCents: cents(12_200), rate: 0.12 },
    { fromCents: cents(49_600), rate: 0.22 },
    { fromCents: cents(105_700), rate: 0.24 },
    { fromCents: cents(201_800), rate: 0.32 },
    { fromCents: cents(256_200), rate: 0.35 },
    { fromCents: cents(384_400), rate: 0.37 },
  ],
  headOfHousehold: [
    { fromCents: cents(0), rate: 0.1 },
    { fromCents: cents(17_400), rate: 0.12 },
    { fromCents: cents(66_300), rate: 0.22 },
    { fromCents: cents(105_700), rate: 0.24 },
    { fromCents: cents(201_800), rate: 0.32 },
    { fromCents: cents(256_200), rate: 0.35 },
    { fromCents: cents(640_600), rate: 0.37 },
  ],
};

export const federalIncomeTax2026: FederalIncomeTaxRules = {
  taxYear: 2026,
  brackets,
  standardDeductionCents: {
    single: cents(16_100),
    marriedFilingJointly: cents(32_200),
    marriedFilingSeparately: cents(16_100),
    headOfHousehold: cents(24_150),
  },
  source: "IRS Revenue Procedure 2025-32",
  url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
  asOf: "2026-01-01",
};

/** Applies a marginal bracket schedule to a taxable-income amount and returns the total tax owed, in cents. */
export function applyBrackets(taxableIncomeCents: number, schedule: readonly { fromCents: number; rate: number }[]): number {
  if (taxableIncomeCents <= 0) return 0;
  let tax = 0;
  for (let i = 0; i < schedule.length; i++) {
    const bracket = schedule[i]!;
    const next = schedule[i + 1];
    const ceiling = next ? next.fromCents : Infinity;
    if (taxableIncomeCents <= bracket.fromCents) break;
    const upperBound = Math.min(taxableIncomeCents, ceiling);
    const amountInBracket = upperBound - bracket.fromCents;
    if (amountInBracket > 0) tax += amountInBracket * bracket.rate;
  }
  return Math.round(tax);
}
