import type { Adjustment, AdjustmentContext, LineItem } from "../adjustable/index.js";
import { sumLineItems } from "../adjustable/index.js";
import { applyBrackets } from "../reference-data/federal-income-tax.js";
import { clampNonNegative } from "../money/index.js";
import { PRETAX_DEDUCTION_KEYS } from "./pretax-keys.js";

/**
 * Handles all three state-tax archetypes generically from
 * `reference-data/state-tax.ts` — no per-state code branching needed to add
 * a new state, only a new `StateTaxRules` entry.
 */
export function stateTaxAdjustment(stateCode: string): Adjustment {
  return {
    key: "stateTax",
    label: `State income tax (${stateCode})`,
    compute(ctx: AdjustmentContext, grossCents: number, priorLineItems: readonly LineItem[]): number {
      const rules = ctx.referenceData.stateTax[stateCode];
      if (!rules) {
        throw new RangeError(`No state tax rules registered for "${stateCode}" — add one in reference-data/state-tax.ts`);
      }
      if (rules.archetype === "no-income-tax") return 0;

      const pretaxThisMonth = sumLineItems(priorLineItems, [...PRETAX_DEDUCTION_KEYS]);
      const taxableGrossThisMonth = clampNonNegative(grossCents + pretaxThisMonth);

      if (rules.archetype === "flat") {
        return -Math.round(taxableGrossThisMonth * (rules.flatRate ?? 0));
      }

      // Progressive archetype: same cumulative-year marginal method as federal, applied to the same
      // taxable-wage basis. Deliberately does not model a separate state standard deduction — state
      // deductions vary widely and aren't captured in `StateTaxRules` yet; see reference-data/state-tax.ts.
      const brackets = rules.brackets ?? [];
      const ytdBefore = ctx.taxBasis.ytdFederalTaxableWagesCents;
      const ytdAfter = ytdBefore + taxableGrossThisMonth;
      const taxBefore = applyBrackets(ytdBefore, brackets);
      const taxAfter = applyBrackets(ytdAfter, brackets);
      return -(taxAfter - taxBefore);
    },
  };
}
