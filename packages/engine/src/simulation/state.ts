import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { TaxBasisState } from "../types/tax-basis.js";
import type { IncomeState } from "../income/index.js";
import type { ExpenseState } from "../expenses/index.js";
import type { DebtState } from "../debts/index.js";
import type { FinancialAssetState } from "../assets/index.js";
import type { PortfolioState } from "../portfolio/index.js";
import type { PhysicalAssetState } from "../physical-assets/index.js";
import type { DecisionImportance, JsonValue, StableId, VersionedReference } from "../contracts/index.js";

/**
 * A decision is open-ended by design (`domain` is a plain string, not a
 * closed union) so the frontend's "choose a job," "choose an after-hours
 * activity," "buy a house," or any future life-decision category can be
 * recorded without a change here. The simulation kernel treats decisions
 * as an audit trail attached to a snapshot, not something it interprets —
 * translating "decision X was chosen" into concrete state (which incomes/
 * expenses/debts exist) is the caller's responsibility when it constructs
 * the `LifeStateSnapshot` at a fork point. See simulation/README.md.
 */
export interface Decision {
  id: StableId;
  domain: string;
  optionId: string;
  label: string;
  effectiveFromMonth: MonthKey;
  /** Pins the selected option to the definition version used for preview and replay. */
  optionRef?: VersionedReference;
  /** Persisted classification lets every UI choose the same compact/expanded treatment. */
  importance?: DecisionImportance;
  /** Links the committed audit record to its preview/compare lifecycle. */
  sessionId?: StableId;
  /** JSON-safe parameters for replaying custom decisions such as an annual life plan. */
  inputs?: Readonly<Record<string, JsonValue>>;
}
export type DecisionSet = readonly Decision[];

export interface LifeStateSnapshot {
  runId: string;
  month: MonthKey;
  parentSnapshotRef: { runId: string; month: MonthKey } | null;
  decisions: DecisionSet;
  incomes: readonly IncomeState[];
  expenses: readonly ExpenseState[];
  debts: readonly DebtState[];
  financialAssets: readonly FinancialAssetState[];
  portfolio: PortfolioState;
  physicalAssets: readonly PhysicalAssetState[];
  taxBasis: TaxBasisState;
  /** Cached, derived from the state above via net-worth.ts — never hand-set. */
  netWorthCents: Cents;
  /** Escape hatch for a future domain ("more") without a type or schema migration. */
  extensions: Record<string, unknown>;
}
