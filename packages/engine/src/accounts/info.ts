import type { Cents } from "../money/index.js";
import type { RetirementLimits } from "../reference-data/types.js";
import type { AccountType, AccountTypeInfo } from "./types.js";

const RETIREMENT_PENALTY_AGE = 59.5;
const HSA_PENALTY_AGE = 65;

const INFO: Record<AccountType, AccountTypeInfo> = {
  cash: { accountType: "cash", taxTreatment: "taxable", label: "Cash / savings", contributionsPretax: false, qualifiedWithdrawalTaxFree: false, earlyWithdrawalPenaltyRate: 0, penaltyFreeAge: null },
  taxableBrokerage: { accountType: "taxableBrokerage", taxTreatment: "taxable", label: "Taxable brokerage", contributionsPretax: false, qualifiedWithdrawalTaxFree: false, earlyWithdrawalPenaltyRate: 0, penaltyFreeAge: null },
  traditional401k: { accountType: "traditional401k", taxTreatment: "taxDeferred", label: "Traditional 401(k)", contributionsPretax: true, qualifiedWithdrawalTaxFree: false, earlyWithdrawalPenaltyRate: 0.1, penaltyFreeAge: RETIREMENT_PENALTY_AGE },
  roth401k: { accountType: "roth401k", taxTreatment: "roth", label: "Roth 401(k)", contributionsPretax: false, qualifiedWithdrawalTaxFree: true, earlyWithdrawalPenaltyRate: 0.1, penaltyFreeAge: RETIREMENT_PENALTY_AGE },
  traditionalIra: { accountType: "traditionalIra", taxTreatment: "taxDeferred", label: "Traditional IRA", contributionsPretax: true, qualifiedWithdrawalTaxFree: false, earlyWithdrawalPenaltyRate: 0.1, penaltyFreeAge: RETIREMENT_PENALTY_AGE },
  rothIra: { accountType: "rothIra", taxTreatment: "roth", label: "Roth IRA", contributionsPretax: false, qualifiedWithdrawalTaxFree: true, earlyWithdrawalPenaltyRate: 0.1, penaltyFreeAge: RETIREMENT_PENALTY_AGE },
  hsa: { accountType: "hsa", taxTreatment: "hsa", label: "HSA", contributionsPretax: true, qualifiedWithdrawalTaxFree: true, earlyWithdrawalPenaltyRate: 0.2, penaltyFreeAge: HSA_PENALTY_AGE },
  education529: { accountType: "education529", taxTreatment: "education529", label: "529 college savings", contributionsPretax: false, qualifiedWithdrawalTaxFree: true, earlyWithdrawalPenaltyRate: 0.1, penaltyFreeAge: null },
};

export function accountTypeInfo(accountType: AccountType): AccountTypeInfo {
  return INFO[accountType];
}

/** Every account type, for UIs that render a picker. */
export function allAccountTypes(): readonly AccountTypeInfo[] {
  return Object.values(INFO);
}

/**
 * The IRS annual contribution limit for an account type at a given age, or
 * `null` when this package doesn't model a federal limit for it (taxable/cash
 * have none; HSA and 529 have limits that aren't in `reference-data` yet, so
 * they're returned as unenforced `null` rather than a wrong number).
 *
 * Note the returned 401(k)/IRA limits are the *per-limit-group* elective
 * amounts. The elective-deferral limit is shared across Traditional + Roth
 * 401(k), and the IRA limit is shared across Traditional + Roth IRA — a caller
 * splitting contributions across both must enforce that shared cap itself.
 */
export function annualContributionLimitCents(accountType: AccountType, ageYears: number, limits: RetirementLimits): Cents | null {
  switch (accountType) {
    case "traditional401k":
    case "roth401k": {
      const catchUp = ageYears >= 60 && ageYears <= 63 ? limits.superCatchUp60to63Cents : ageYears >= 50 ? limits.catchUp50PlusCents : 0;
      return limits.employeeDeferralLimitCents + catchUp;
    }
    case "traditionalIra":
    case "rothIra": {
      const catchUp = ageYears >= 50 ? limits.iraCatchUp50PlusCents : 0;
      return limits.iraLimitCents + catchUp;
    }
    default:
      return null; // cash, taxableBrokerage, hsa, education529 — no modeled federal cap here
  }
}
