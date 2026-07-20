import type { AdjustableResult } from "../adjustable/index.js";
import type { Cents } from "../money/index.js";
import type { ExpenseCategory } from "./types.js";

export interface ExpenseViews {
  totalMonthlyCents: Cents;
  category: ExpenseCategory;
  /** Gross minus every adjustment (reimbursements, subsidies) — the actual out-of-pocket cost. */
  outOfPocketCents: Cents;
}

export function expenseViews(result: AdjustableResult, category: ExpenseCategory): ExpenseViews {
  return {
    totalMonthlyCents: result.grossCents,
    category,
    outOfPocketCents: result.netCents,
  };
}
