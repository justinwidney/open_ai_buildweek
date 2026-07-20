import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { PhysicalAssetConfig } from "./types.js";

const MONTHS_PER_YEAR = 12;

/** Current value from purchase price compounded annually by the configured (de)appreciation rate. */
export function currentPhysicalAssetValueCents(config: PhysicalAssetConfig, currentMonth: MonthKey): Cents {
  const monthsOwned = Math.max(0, currentMonth - config.purchaseMonth);
  const yearsOwned = monthsOwned / MONTHS_PER_YEAR;
  return Math.round(config.purchasePriceCents * Math.pow(1 + config.annualValueChangeRate, yearsOwned));
}

/** Equity = current value minus whatever's still owed on a linked debt (0 if there's no linked debt or it's already paid off). */
export function computeEquityCents(currentValueCents: Cents, linkedDebtRemainingBalanceCents = 0): Cents {
  return currentValueCents - linkedDebtRemainingBalanceCents;
}
