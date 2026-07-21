import type { Cents } from "../money/index.js";
import type { FilingStatus } from "../types/tax-basis.js";
import type { IncomeSourceConfig, IncomeState } from "../income/index.js";
import type { ExpenseConfig, ExpenseState } from "../expenses/index.js";
import type { DebtState } from "../debts/index.js";
import type { FinancialAssetState } from "../assets/index.js";
import type { HoldingState } from "../portfolio/index.js";
import type { PhysicalAssetState } from "../physical-assets/index.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import { computeNetWorthCents } from "../simulation/net-worth.js";

/**
 * The typed vocabulary of state changes a life event can make. A decision
 * (buy a home, change jobs) is expressed as an ordered list of these, which
 * `applyMutations` folds over a `LifeStateSnapshot` to produce the diverged
 * starting point a branch runs forward from. Keeping the vocabulary small and
 * explicit is what lets the divergence analysis (Layer 5) later reason about
 * "what did this decision actually change."
 */
export type StateMutation =
  // One-time cash impact: default targets the primary cash account (index 0); a down payment is
  // negative, an inheritance positive. May drive cash negative — affordability is a precondition's job.
  | { kind: "adjustCash"; deltaCents: Cents; assetId?: string }
  | { kind: "addIncome"; income: IncomeState }
  | { kind: "removeIncome"; id: string }
  | { kind: "patchIncomeConfig"; id: string; patch: Partial<Omit<IncomeSourceConfig, "id">> }
  // Multiply one income's base gross by a factor — a raise (>1) or a pay cut (<1) — without
  // needing to know its current amount. Only touches the named source, so a spouse's income is untouched.
  | { kind: "scaleIncome"; id: string; factor: number }
  | { kind: "addExpense"; expense: ExpenseState }
  | { kind: "removeExpense"; id: string }
  | { kind: "patchExpenseConfig"; id: string; patch: Partial<Omit<ExpenseConfig, "id">> }
  // Multiply one expense's base amount — a rent hike (>1) or a belt-tightening cut (<1) — without needing its current amount.
  | { kind: "scaleExpense"; id: string; factor: number }
  | { kind: "addDebt"; debt: DebtState }
  | { kind: "removeDebt"; id: string }
  | { kind: "addFinancialAsset"; asset: FinancialAssetState }
  | { kind: "addHolding"; holding: HoldingState }
  | { kind: "addPhysicalAsset"; asset: PhysicalAssetState }
  | { kind: "removePhysicalAsset"; id: string }
  | { kind: "setFilingStatus"; filingStatus: FilingStatus };

function applyOne(snapshot: LifeStateSnapshot, m: StateMutation): LifeStateSnapshot {
  switch (m.kind) {
    case "adjustCash": {
      if (snapshot.financialAssets.length === 0) throw new Error("adjustCash: the snapshot has no financial (cash) account to adjust");
      const targetIndex = m.assetId ? snapshot.financialAssets.findIndex((a) => a.config.id === m.assetId) : 0;
      if (targetIndex < 0) throw new Error(`adjustCash: no financial asset with id "${m.assetId}"`);
      const financialAssets = snapshot.financialAssets.map((a, i) => (i === targetIndex ? { ...a, balanceCents: a.balanceCents + m.deltaCents } : a));
      return { ...snapshot, financialAssets };
    }
    case "addIncome":
      return { ...snapshot, incomes: [...snapshot.incomes, m.income] };
    case "removeIncome":
      return { ...snapshot, incomes: snapshot.incomes.filter((s) => s.config.id !== m.id) };
    case "patchIncomeConfig":
      return { ...snapshot, incomes: snapshot.incomes.map((s) => (s.config.id === m.id ? { ...s, config: { ...s.config, ...m.patch } } : s)) };
    case "scaleIncome":
      return {
        ...snapshot,
        incomes: snapshot.incomes.map((s) => (s.config.id === m.id ? { ...s, config: { ...s.config, baseMonthlyGrossCents: Math.round(s.config.baseMonthlyGrossCents * m.factor) } } : s)),
      };
    case "addExpense":
      return { ...snapshot, expenses: [...snapshot.expenses, m.expense] };
    case "removeExpense":
      return { ...snapshot, expenses: snapshot.expenses.filter((s) => s.config.id !== m.id) };
    case "patchExpenseConfig":
      return { ...snapshot, expenses: snapshot.expenses.map((s) => (s.config.id === m.id ? { ...s, config: { ...s.config, ...m.patch } } : s)) };
    case "scaleExpense":
      return {
        ...snapshot,
        expenses: snapshot.expenses.map((s) => (s.config.id === m.id ? { ...s, config: { ...s.config, baseMonthlyAmountCents: Math.round(s.config.baseMonthlyAmountCents * m.factor) } } : s)),
      };
    case "addDebt":
      return { ...snapshot, debts: [...snapshot.debts, m.debt] };
    case "removeDebt":
      return { ...snapshot, debts: snapshot.debts.filter((s) => s.config.id !== m.id) };
    case "addFinancialAsset":
      return { ...snapshot, financialAssets: [...snapshot.financialAssets, m.asset] };
    case "addHolding":
      return { ...snapshot, portfolio: { holdings: [...snapshot.portfolio.holdings, m.holding] } };
    case "addPhysicalAsset":
      return { ...snapshot, physicalAssets: [...snapshot.physicalAssets, m.asset] };
    case "removePhysicalAsset":
      return { ...snapshot, physicalAssets: snapshot.physicalAssets.filter((s) => s.config.id !== m.id) };
    case "setFilingStatus":
      return { ...snapshot, taxBasis: { ...snapshot.taxBasis, filingStatus: m.filingStatus } };
  }
}

/**
 * Applies an ordered list of mutations and recomputes the cached net worth.
 * Pure — returns a new snapshot, never mutates the input. Mutations apply in
 * order, so a `removeIncome` then `addIncome` with the same id is a replace.
 */
export function applyMutations(snapshot: LifeStateSnapshot, mutations: readonly StateMutation[]): LifeStateSnapshot {
  const next = mutations.reduce(applyOne, snapshot);
  const netWorthCents = computeNetWorthCents({
    financialAssets: next.financialAssets,
    portfolio: next.portfolio,
    physicalAssets: next.physicalAssets,
    debts: next.debts,
    month: next.month,
  });
  return { ...next, netWorthCents };
}
