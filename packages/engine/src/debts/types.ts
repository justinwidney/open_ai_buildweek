import type { Cents } from "../money/index.js";
import { clampNonNegative } from "../money/index.js";
import type { MonthKey } from "../types/month.js";

export interface DebtConfig {
  id: string;
  label: string;
  originalPrincipalCents: Cents;
  annualRate: number;
  termMonths: number;
  startMonth: MonthKey;
  /** Flat monthly escrow (property tax/insurance) on top of the amortized principal-and-interest payment; 0 for a plain loan. */
  monthlyEscrowCents: Cents;
}

export interface DebtState {
  config: DebtConfig;
  remainingBalanceCents: Cents;
}

export function initialDebtState(config: DebtConfig): DebtState {
  return { config, remainingBalanceCents: config.originalPrincipalCents };
}

export function isDebtActive(state: DebtState, month: MonthKey): boolean {
  return month >= state.config.startMonth && state.remainingBalanceCents > 0;
}

/** Advances a debt's balance after a month's principal portion has been paid — never below zero. */
export function applyPrincipalPayment(state: DebtState, principalPaidCents: Cents): DebtState {
  return { ...state, remainingBalanceCents: clampNonNegative(state.remainingBalanceCents - principalPaidCents) };
}
