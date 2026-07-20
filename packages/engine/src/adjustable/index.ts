import type { Cents } from "../money/index.js";
import { addC, assertSafe } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { TaxBasisState } from "../types/tax-basis.js";
import type { RandomSource } from "../rng/index.js";
import type { ReferenceDataBundle } from "../reference-data/types.js";

/**
 * The minimal, self-contained context an `Adjustment` needs to compute its
 * line item. Deliberately not the full simulation `LifeStateSnapshot` —
 * that would make this folder depend on `simulation/`, which depends on
 * every domain, which depends on this folder. Keeping this context small
 * and domain-agnostic is what makes the mechanism reusable across income,
 * expenses, debts, and physical assets without a cycle.
 */
export interface AdjustmentContext {
  month: MonthKey;
  rng: RandomSource;
  referenceData: ReferenceDataBundle;
  taxBasis: TaxBasisState;
}

/** A single named amount contributing to (positive) or subtracting from (negative) an Adjustable's gross. */
export interface LineItem {
  key: string;
  label: string;
  amountCents: Cents;
}

/**
 * One step in an Adjustable's pipeline: given the gross amount and every
 * line item computed by earlier steps (order matters — e.g. a pretax 401(k)
 * deferral must run before the federal-tax step so it can see and exclude
 * that deduction from taxable wages), produce this step's own signed
 * amount.
 */
export interface Adjustment {
  key: string;
  label: string;
  compute(ctx: AdjustmentContext, grossCents: Cents, priorLineItems: readonly LineItem[]): Cents;
}

/** Anything with a raw monthly amount and an ordered pipeline of adjustments applied to it. */
export interface Adjustable {
  id: string;
  label: string;
  grossCents(ctx: AdjustmentContext): Cents;
  adjustments: readonly Adjustment[];
}

export interface AdjustableResult {
  id: string;
  label: string;
  grossCents: Cents;
  lineItems: readonly LineItem[];
  /** Always exactly grossCents + sum(lineItems) — never drifts. */
  netCents: Cents;
}

export function resolveAdjustable(ctx: AdjustmentContext, adjustable: Adjustable): AdjustableResult {
  const grossCents = adjustable.grossCents(ctx);
  assertSafe(grossCents, `${adjustable.id}.gross`);

  const lineItems: LineItem[] = [];
  for (const adjustment of adjustable.adjustments) {
    const amountCents = adjustment.compute(ctx, grossCents, lineItems);
    assertSafe(amountCents, `${adjustable.id}.${adjustment.key}`);
    lineItems.push({ key: adjustment.key, label: adjustment.label, amountCents });
  }

  const netCents = addC(grossCents, ...lineItems.map((li) => li.amountCents));
  return { id: adjustable.id, label: adjustable.label, grossCents, lineItems, netCents };
}

/** Looks up a specific prior line item's amount by key — 0 if it hasn't run (or doesn't apply) yet. */
export function findLineItem(lineItems: readonly LineItem[], key: string): Cents {
  return lineItems.find((li) => li.key === key)?.amountCents ?? 0;
}

/** Sums a named subset of prior line items — e.g. every pretax deduction, to compute taxable wages. */
export function sumLineItems(lineItems: readonly LineItem[], keys: readonly string[]): Cents {
  return lineItems.filter((li) => keys.includes(li.key)).reduce((sum, li) => sum + li.amountCents, 0);
}
