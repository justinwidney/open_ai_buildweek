import type { Cents } from "../money/index.js";

/**
 * A per-line spending cap. `match: "category"` caps a whole spending
 * category ("fixed" | "discretionary" | "debt"); `match: "entity"` caps one
 * named expense by its id (e.g. "dining"). The finest-grained cap is the
 * hand-holding surface — "you're $120 over your dining budget this month."
 */
export interface BudgetLineTarget {
  key: string;
  match: "category" | "entity";
  limitCents: Cents;
  /** Optional display label; falls back to `key`. */
  label?: string;
}

/**
 * A user's monthly plan. Every field is optional — a budget can be as loose
 * as a single savings-rate goal or as tight as a cap on every line. Compared
 * against a `MonthlyStatement`'s actuals by `evaluateBudget`.
 */
export interface BudgetTarget {
  /** Cap on total monthly spending (fixed + discretionary + debt). */
  totalMonthlySpendingCents?: Cents;
  /** Target savings rate in [0, 1]; met when the statement's actual rate is at least this. */
  savingsRateTarget?: number;
  /** Per-category or per-entity caps. */
  lines?: readonly BudgetLineTarget[];
}
