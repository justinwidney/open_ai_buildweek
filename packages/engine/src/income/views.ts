import type { AdjustableResult } from "../adjustable/index.js";
import { findLineItem } from "../adjustable/index.js";
import type { Cents } from "../money/index.js";

export interface IncomeViews {
  grossMonthlyCents: Cents;
  /** Gross minus the pretax 401(k) deferral only — what payroll actually runs tax withholding against. */
  afterPayrollDeductionsCents: Cents;
  /** Gross minus federal, state, and FICA taxes, but not the pretax deferral (which isn't "tax"). */
  afterTaxCents: Cents;
  /** The portion of this month's gross that isn't taxed this year (the pretax deferral). */
  taxFreeCents: Cents;
  /** FICA-taxable wages — the base Social Security benefits will eventually be computed from. */
  socialSecurityWageCents: Cents;
  /** Gross minus every deduction and tax — what actually lands in the bank this month. */
  takeHomeCents: Cents;
}

export function incomeViews(result: AdjustableResult): IncomeViews {
  const pretax = findLineItem(result.lineItems, "retirement401kPretax");
  const federalTax = findLineItem(result.lineItems, "federalIncomeTax");
  const stateTax = findLineItem(result.lineItems, "stateTax");
  const ficaSs = findLineItem(result.lineItems, "ficaSocialSecurity");
  const ficaMedicare = findLineItem(result.lineItems, "ficaMedicare");

  return {
    grossMonthlyCents: result.grossCents,
    afterPayrollDeductionsCents: result.grossCents + pretax,
    afterTaxCents: result.grossCents + federalTax + stateTax + ficaSs + ficaMedicare,
    taxFreeCents: -pretax,
    socialSecurityWageCents: result.grossCents + pretax,
    takeHomeCents: result.netCents,
  };
}
