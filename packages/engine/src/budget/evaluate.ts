import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { MonthlyStatement } from "../statement/monthly-statement.js";
import type { BudgetLineTarget, BudgetTarget } from "./types.js";

export interface AmountCheck {
  limitCents: Cents;
  actualCents: Cents;
  /** actual − limit. Positive means over budget. */
  varianceCents: Cents;
  overBudget: boolean;
}

export interface SavingsRateCheck {
  targetRate: number;
  actualRate: number;
  /** actual − target. Negative means falling short. */
  variance: number;
  met: boolean;
}

export interface BudgetLineResult extends AmountCheck {
  key: string;
  label: string;
  match: BudgetLineTarget["match"];
}

export interface BudgetReport {
  month: MonthKey;
  /** Present only if the target set a total-spending cap. */
  totalSpending?: AmountCheck;
  /** Present only if the target set a savings-rate goal. */
  savingsRate?: SavingsRateCheck;
  lines: BudgetLineResult[];
  /** True when every provided target is satisfied (nothing over budget, savings goal met). */
  onTrack: boolean;
  /** The lines that are over budget, worst overage first — the "here's what to fix" list. */
  overBudgetLines: BudgetLineResult[];
}

function amountCheck(limitCents: Cents, actualCents: Cents): AmountCheck {
  const varianceCents = actualCents - limitCents;
  return { limitCents, actualCents, varianceCents, overBudget: varianceCents > 0 };
}

/** Sums the statement's spending lines matching a budget line target. */
function actualForLine(statement: MonthlyStatement, target: BudgetLineTarget): Cents {
  return statement.spending.byLine
    .filter((line) => (target.match === "category" ? line.category === target.key : line.entityId === target.key))
    .reduce((total, line) => total + line.amountCents, 0);
}

/**
 * Compares a `BudgetTarget` (the plan) against a `MonthlyStatement` (the
 * actuals) and reports where the month landed relative to plan. Pure: no
 * mutation, same inputs → same report. Only the checks the target actually
 * specified appear; an empty target is trivially on track.
 */
export function evaluateBudget(target: BudgetTarget, statement: MonthlyStatement): BudgetReport {
  const totalSpending = target.totalMonthlySpendingCents === undefined ? undefined : amountCheck(target.totalMonthlySpendingCents, statement.spending.totalCents);

  const savingsRate =
    target.savingsRateTarget === undefined
      ? undefined
      : (() => {
          const actualRate = statement.cashFlow.savingsRate;
          const variance = actualRate - target.savingsRateTarget!;
          return { targetRate: target.savingsRateTarget!, actualRate, variance, met: variance >= 0 };
        })();

  const lines: BudgetLineResult[] = (target.lines ?? []).map((line) => ({
    key: line.key,
    label: line.label ?? line.key,
    match: line.match,
    ...amountCheck(line.limitCents, actualForLine(statement, line)),
  }));

  const overBudgetLines = lines.filter((l) => l.overBudget).sort((a, b) => b.varianceCents - a.varianceCents);
  const onTrack = (totalSpending?.overBudget !== true) && (savingsRate?.met !== false) && overBudgetLines.length === 0;

  return { month: statement.month, totalSpending, savingsRate, lines, onTrack, overBudgetLines };
}
