/**
 * The set of `LineItem` keys that reduce federal/state *taxable* wages
 * (traditional 401(k)/403(b)/HSA/pretax benefit premiums) as opposed to
 * being taxed then deducted (Roth contributions, post-tax benefits). Tax
 * adjustments (`federal.ts`, `state.ts`) scan for these keys among the
 * prior line items in an Adjustable's pipeline to compute taxable wages —
 * which means any pretax deduction must be ordered *before* the tax
 * adjustments in an `Adjustable.adjustments` array, or it silently won't
 * reduce taxable income for that month.
 */
export const PRETAX_DEDUCTION_KEYS = ["retirement401kPretax", "healthInsurancePremiumPretax", "hsaContribution"] as const;

/** FICA (Social Security + Medicare) wages exclude pretax retirement deferrals but NOT pretax health/HSA in reality for OASDI; simplified here to exclude the same set as federal for a first pass — revisit if per-tax-type FICA-wage nuance matters later. */
export const FICA_WAGE_EXCLUDED_KEYS = PRETAX_DEDUCTION_KEYS;
