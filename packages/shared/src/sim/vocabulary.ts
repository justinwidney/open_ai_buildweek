import type { BalanceRecord, FlowLineItemRecord } from "@control-ai/engine";

/**
 * The `domain` + `viewKey`/`metricKey` vocabulary that @control-ai/db's two
 * long/tidy fact tables store and the Cube data model slices by.
 *
 * The engine deliberately types these as plain `string` on
 * `FlowLineItemRecord`/`BalanceRecord` so a new domain never forces an engine
 * change — but that left the *actual* set of values recorded nowhere except
 * the literals inside `tick()` and a partial prose comment in the Cube YAML
 * (which listed 3 of the 9 income view keys). This file is the single
 * enumeration: `tick()` is the producer, Cube is the consumer, and
 * `vocabulary.test.ts` asserts both still agree with it.
 */

export const FLOW_DOMAINS = ["income", "expense", "debt"] as const;
export type FlowDomain = (typeof FLOW_DOMAINS)[number];

export const INCOME_VIEW_KEYS = [
  "gross",
  "afterPayrollDeductions",
  "afterTax",
  "taxFree",
  "socialSecurityWage",
  "takeHome",
  "federalTax",
  "stateTax",
  "fica",
] as const;
export type IncomeViewKey = (typeof INCOME_VIEW_KEYS)[number];

export const EXPENSE_VIEW_KEYS = ["total", "outOfPocket"] as const;
export type ExpenseViewKey = (typeof EXPENSE_VIEW_KEYS)[number];

export const DEBT_VIEW_KEYS = ["totalPayment", "principalPortion", "interestPortion", "escrowPortion"] as const;
export type DebtViewKey = (typeof DEBT_VIEW_KEYS)[number];

export type FlowViewKey = IncomeViewKey | ExpenseViewKey | DebtViewKey;

/** Which view keys are valid for which flow domain — a debt never emits "gross", income never emits "escrowPortion". */
export const FLOW_VIEW_KEYS_BY_DOMAIN: Readonly<Record<FlowDomain, readonly FlowViewKey[]>> = {
  income: INCOME_VIEW_KEYS,
  expense: EXPENSE_VIEW_KEYS,
  debt: DEBT_VIEW_KEYS,
};

export const BALANCE_DOMAINS = ["debt", "financialAsset", "portfolio", "physicalAsset"] as const;
export type BalanceDomain = (typeof BALANCE_DOMAINS)[number];

export const BALANCE_METRIC_KEYS = ["remainingBalance", "balance", "costBasis", "value"] as const;
export type BalanceMetricKey = (typeof BALANCE_METRIC_KEYS)[number];

/** Which metric keys each balance domain reports. Portfolio is the only one reporting two. */
export const BALANCE_METRIC_KEYS_BY_DOMAIN: Readonly<Record<BalanceDomain, readonly BalanceMetricKey[]>> = {
  debt: ["remainingBalance"],
  financialAsset: ["balance"],
  portfolio: ["balance", "costBasis"],
  physicalAsset: ["value"],
};

/**
 * The engine's records narrowed to the known vocabulary. Persistence layers
 * annotate with these so a typo in a `viewKey` is a compile error at the
 * write site rather than a row that silently never matches a Cube filter.
 * Structurally identical to the engine's records, so an engine value assigns
 * straight into one after a `parse*` check.
 */
export interface TypedFlowLineItem extends FlowLineItemRecord {
  domain: FlowDomain;
  viewKey: FlowViewKey;
}

export interface TypedBalanceRecord extends BalanceRecord {
  domain: BalanceDomain;
  metricKey: BalanceMetricKey;
}

export function isFlowDomain(value: unknown): value is FlowDomain {
  return typeof value === "string" && (FLOW_DOMAINS as readonly string[]).includes(value);
}

export function isBalanceDomain(value: unknown): value is BalanceDomain {
  return typeof value === "string" && (BALANCE_DOMAINS as readonly string[]).includes(value);
}

/** True when a flow's view key is one this domain is allowed to emit. */
export function isValidFlow(domain: string, viewKey: string): boolean {
  if (!isFlowDomain(domain)) return false;
  return (FLOW_VIEW_KEYS_BY_DOMAIN[domain] as readonly string[]).includes(viewKey);
}

/** True when a balance's metric key is one this domain is allowed to emit. */
export function isValidBalance(domain: string, metricKey: string): boolean {
  if (!isBalanceDomain(domain)) return false;
  return (BALANCE_METRIC_KEYS_BY_DOMAIN[domain] as readonly string[]).includes(metricKey);
}
