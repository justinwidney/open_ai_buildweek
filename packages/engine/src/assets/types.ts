import type { Cents } from "../money/index.js";
import type { AccountType } from "../accounts/types.js";

export interface FinancialAssetConfig {
  id: string;
  label: string;
  /** Annual interest rate (e.g. a savings account or money-market APY), compounded monthly. */
  annualInterestRate: number;
  /** The tax wrapper this asset sits in. Defaults to `cash` when omitted (see accounts/). */
  accountType?: AccountType;
}

export interface FinancialAssetState {
  config: FinancialAssetConfig;
  balanceCents: Cents;
}

export function initialFinancialAssetState(config: FinancialAssetConfig, openingBalanceCents: Cents): FinancialAssetState {
  return { config, balanceCents: openingBalanceCents };
}
