import type { Cents } from "../money/index.js";

export interface FinancialAssetConfig {
  id: string;
  label: string;
  /** Annual interest rate (e.g. a savings account or money-market APY), compounded monthly. */
  annualInterestRate: number;
}

export interface FinancialAssetState {
  config: FinancialAssetConfig;
  balanceCents: Cents;
}

export function initialFinancialAssetState(config: FinancialAssetConfig, openingBalanceCents: Cents): FinancialAssetState {
  return { config, balanceCents: openingBalanceCents };
}
