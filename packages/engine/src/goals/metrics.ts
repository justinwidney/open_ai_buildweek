import { applyRate, type Cents } from "../money/index.js";
import { currentPhysicalAssetValueCents } from "../physical-assets/index.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import type { GoalContext, GoalMetric } from "./types.js";

const DEFAULT_SAFE_WITHDRAWAL_RATE = 0.04;

/** Whether a higher metric value is better (closer to the goal). `debtFree` is the lone lower-is-better metric. */
export const HIGHER_IS_BETTER: Record<GoalMetric, boolean> = {
  netWorth: true,
  liquidNetWorth: true,
  retirementIncome: true,
  collegeFund: true,
  homeEquity: true,
  debtFree: false,
};

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/** Debt ids that finance a physical asset (a mortgage), so liquid net worth can exclude them. */
function securedDebtIds(snapshot: LifeStateSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const p of snapshot.physicalAssets) if (p.config.linkedDebtId) ids.add(p.config.linkedDebtId);
  return ids;
}

/**
 * Resolves the current value of a goal's metric from a snapshot. For
 * `retirementIncome` this is an annual income (investable balance × the safe
 * withdrawal rate), not a balance; every other metric is a cents amount.
 */
export function metricValueCents(metric: GoalMetric, snapshot: LifeStateSnapshot, context: GoalContext = {}): Cents {
  const financial = snapshot.financialAssets;
  const holdings = snapshot.portfolio.holdings;

  switch (metric) {
    case "netWorth":
      return snapshot.netWorthCents;

    case "liquidNetWorth": {
      const secured = securedDebtIds(snapshot);
      const liquidAssets = sum(financial.map((a) => a.balanceCents)) + sum(holdings.map((h) => h.balanceCents));
      const unsecuredDebt = sum(snapshot.debts.filter((d) => !secured.has(d.config.id)).map((d) => d.remainingBalanceCents));
      return liquidAssets - unsecuredDebt;
    }

    case "retirementIncome": {
      // Investable = every liquid balance except education-earmarked 529s; annualized at the withdrawal rate.
      const investable =
        sum(financial.filter((a) => a.config.accountType !== "education529").map((a) => a.balanceCents)) +
        sum(holdings.filter((h) => h.config.accountType !== "education529").map((h) => h.balanceCents));
      return applyRate(investable, context.safeWithdrawalRate ?? DEFAULT_SAFE_WITHDRAWAL_RATE);
    }

    case "collegeFund":
      return sum(financial.filter((a) => a.config.accountType === "education529").map((a) => a.balanceCents)) + sum(holdings.filter((h) => h.config.accountType === "education529").map((h) => h.balanceCents));

    case "homeEquity": {
      const debtById = new Map(snapshot.debts.map((d) => [d.config.id, d]));
      return sum(
        snapshot.physicalAssets.map((p) => {
          const value = currentPhysicalAssetValueCents(p.config, snapshot.month);
          const linked = p.config.linkedDebtId ? debtById.get(p.config.linkedDebtId) : undefined;
          return value - (linked?.remainingBalanceCents ?? 0);
        }),
      );
    }

    case "debtFree":
      return sum(snapshot.debts.map((d) => d.remainingBalanceCents));
  }
}
