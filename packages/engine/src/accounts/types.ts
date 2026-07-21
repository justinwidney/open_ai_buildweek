/**
 * Account taxonomy — the tax "wrapper" a balance sits inside. This is what
 * lets the simulator answer "401(k) vs Roth vs taxable?" and show a user
 * which of their money is pre-tax, tax-free, or already-taxed.
 *
 * The five *tax treatments* are the axis that actually changes the math; the
 * concrete *account types* map onto them (plus display + contribution rules).
 */

export type TaxTreatment =
  | "taxable" // brokerage, checking/savings — growth is taxed as it's earned/realized
  | "taxDeferred" // Traditional 401(k)/IRA — pretax in, ordinary-income out, penalty if early
  | "roth" // Roth 401(k)/IRA — after-tax in, qualified growth comes out tax-free
  | "hsa" // triple-advantaged — pretax in, tax-free out for qualified medical
  | "education529"; // after-tax in, tax-free out for qualified education

export type AccountType =
  | "cash"
  | "taxableBrokerage"
  | "traditional401k"
  | "roth401k"
  | "traditionalIra"
  | "rothIra"
  | "hsa"
  | "education529";

export interface AccountTypeInfo {
  accountType: AccountType;
  taxTreatment: TaxTreatment;
  label: string;
  /** Do contributions reduce this year's taxable income? (Traditional 401k/IRA, HSA.) */
  contributionsPretax: boolean;
  /** Can qualified withdrawals come out entirely tax-free? (Roth, HSA-medical, 529-education.) */
  qualifiedWithdrawalTaxFree: boolean;
  /** Additional-tax penalty rate on a non-qualified early withdrawal (e.g. 0.10 for retirement accounts, 0.20 for HSA). 0 if none. */
  earlyWithdrawalPenaltyRate: number;
  /** Age at/after which the early-withdrawal penalty no longer applies (59.5 for retirement, 65 for HSA). `null` when no age gate (taxable, or Roth basis). */
  penaltyFreeAge: number | null;
}
