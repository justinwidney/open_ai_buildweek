import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";

/** One named flow for one entity in one month — the exact shape @control-ai/db's flow_line_items table stores. */
export interface FlowLineItemRecord {
  domain: string;
  entityId: string;
  entityLabel: string;
  viewKey: string;
  amountCents: Cents;
}

/** One named point-in-time balance for one entity in one month — mirrors @control-ai/db's balance_snapshots table. */
export interface BalanceRecord {
  domain: string;
  entityId: string;
  metricKey: string;
  amountCents: Cents;
}

/**
 * The granular per-entity detail `tick()` computes on its way to the
 * aggregate `LifeStateSnapshot` — income's after-tax/take-home views,
 * a debt's principal/interest split, a holding's balance, and so on.
 * `LifeStateSnapshot` itself only keeps what the *next* tick needs
 * (balances, remaining principal, tax basis); this is the side channel a
 * persistence layer reads to populate the two generalized fact tables
 * without re-deriving them from scratch.
 */
export interface MonthDetail {
  month: MonthKey;
  flows: readonly FlowLineItemRecord[];
  balances: readonly BalanceRecord[];
}
