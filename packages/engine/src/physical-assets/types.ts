import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";

export interface PhysicalAssetConfig {
  id: string;
  label: string;
  purchasePriceCents: Cents;
  purchaseMonth: MonthKey;
  /** Annual appreciation (positive, e.g. a house) or depreciation (negative, e.g. a car) rate. */
  annualValueChangeRate: number;
  /** Flat monthly upkeep (maintenance, HOA, insurance not already covered by a linked debt's escrow). */
  monthlyUpkeepCents: Cents;
  /** Optional id of a `DebtState` financing this asset, so equity can be computed as value minus that debt's remaining balance. */
  linkedDebtId?: string;
}

export interface PhysicalAssetState {
  config: PhysicalAssetConfig;
}
