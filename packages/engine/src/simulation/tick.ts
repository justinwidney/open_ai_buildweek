import type { RandomSource } from "../rng/index.js";
import type { ReferenceDataBundle } from "../reference-data/index.js";
import type { ReturnsStrategy } from "../returns/index.js";
import type { MonthKey } from "../types/month.js";
import { initialTaxBasis, type TaxBasisState } from "../types/tax-basis.js";
import type { AdjustmentContext } from "../adjustable/index.js";
import { findLineItem, resolveAdjustable } from "../adjustable/index.js";
import { buildIncomeAdjustable, incomeViews, isIncomeActive } from "../income/index.js";
import { buildExpenseAdjustable, expenseViews, isExpenseActive } from "../expenses/index.js";
import { applyPrincipalPayment, buildDebtPaymentAdjustable, debtViews, isDebtActive } from "../debts/index.js";
import { tickFinancialAsset } from "../assets/index.js";
import { tickHoldingGrowth } from "../portfolio/index.js";
import { currentPhysicalAssetValueCents } from "../physical-assets/index.js";
import type { LifeStateSnapshot, Decision, DecisionSet } from "./state.js";
import { computeNetWorthCents } from "./net-worth.js";
import type { BalanceRecord, FlowLineItemRecord, MonthDetail } from "./detail.js";

export interface TickContext {
  month: MonthKey;
  previous: LifeStateSnapshot;
  decisionDeltas: DecisionSet;
  returnsStrategy: ReturnsStrategy;
  referenceData: ReferenceDataBundle;
  rng: RandomSource;
}

export interface TickResult {
  snapshot: LifeStateSnapshot;
  detail: MonthDetail;
}

function mergeDecisions(existing: DecisionSet, deltas: DecisionSet): DecisionSet {
  if (deltas.length === 0) return existing;
  const byId = new Map<string, Decision>(existing.map((d) => [d.id, d]));
  for (const decision of deltas) byId.set(decision.id, decision);
  return Array.from(byId.values());
}

/**
 * Advances a `LifeStateSnapshot` by exactly one month, returning both the
 * next snapshot (only what the *next* tick needs — balances, remaining
 * principal, tax basis) and this month's granular per-entity detail (see
 * `detail.ts`) for a persistence layer to store. Pure: the same
 * `TickContext` (including `rng`'s current state) always produces the
 * same result, with no hidden mutation of `previous`. Processes incomes in
 * array order, threading each source's tax-basis update into the next —
 * this matters for a household with more than one income source in the
 * same month, since the second job's marginal tax rate depends on the
 * first's cumulative wages this year, not just its own.
 *
 * Does *not* interpret `decisionDeltas` into concrete state changes
 * (adding/removing an income source, buying a house) — decisions are
 * recorded on the returned snapshot as an audit trail, but translating a
 * decision into which incomes/expenses/debts/physical-assets exist is the
 * caller's job when it constructs a new starting `LifeStateSnapshot` (see
 * `simulation/branch.ts` and the README's "scope boundary" note). Growing
 * portfolio holdings happens automatically every tick; contributions and
 * withdrawals are applied by the caller via `portfolio/` before calling
 * `tick`, not derived from decisions automatically.
 */
export function tick(ctx: TickContext): TickResult {
  const { previous, month } = ctx;
  const decisions = mergeDecisions(previous.decisions, ctx.decisionDeltas);

  const flows: FlowLineItemRecord[] = [];
  const balances: BalanceRecord[] = [];

  const isNewCalendarYear = month > 0 && month % 12 === 0;
  let taxBasis: TaxBasisState = isNewCalendarYear
    ? initialTaxBasis(previous.taxBasis.calendarYear + 1, previous.taxBasis.filingStatus)
    : previous.taxBasis;

  // Incomes: process sequentially, threading the running tax basis so a second income source
  // in the same month sees the first's cumulative wages for correct marginal withholding.
  let totalTakeHomeCents = 0;
  const nextIncomes = previous.incomes.map((incomeState) => {
    if (!isIncomeActive(incomeState, month)) return incomeState;
    const localCtx: AdjustmentContext = { month, rng: ctx.rng, referenceData: ctx.referenceData, taxBasis };
    const result = resolveAdjustable(localCtx, buildIncomeAdjustable(incomeState, month));
    const views = incomeViews(result);
    totalTakeHomeCents += views.takeHomeCents;

    const { id, label } = incomeState.config;
    flows.push(
      { domain: "income", entityId: id, entityLabel: label, viewKey: "gross", amountCents: views.grossMonthlyCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "afterPayrollDeductions", amountCents: views.afterPayrollDeductionsCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "afterTax", amountCents: views.afterTaxCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "taxFree", amountCents: views.taxFreeCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "socialSecurityWage", amountCents: views.socialSecurityWageCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "takeHome", amountCents: views.takeHomeCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "federalTax", amountCents: views.federalTaxCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "stateTax", amountCents: views.stateTaxCents },
      { domain: "income", entityId: id, entityLabel: label, viewKey: "fica", amountCents: views.ficaTaxCents },
    );

    taxBasis = {
      ...taxBasis,
      ytdGrossWagesCents: taxBasis.ytdGrossWagesCents + result.grossCents,
      ytdFederalTaxableWagesCents: taxBasis.ytdFederalTaxableWagesCents + views.afterPayrollDeductionsCents,
      ytdFicaWagesCents: taxBasis.ytdFicaWagesCents + views.socialSecurityWageCents,
      ytdRetirementContributionsCents: taxBasis.ytdRetirementContributionsCents + views.taxFreeCents,
      ytdFederalWithheldCents: taxBasis.ytdFederalWithheldCents + -findLineItem(result.lineItems, "federalIncomeTax"),
      ytdStateWithheldCents: taxBasis.ytdStateWithheldCents + -findLineItem(result.lineItems, "stateTax"),
    };
    return incomeState;
  });

  // Expenses.
  let totalExpensesCents = 0;
  for (const expenseState of previous.expenses) {
    if (!isExpenseActive(expenseState, month)) continue;
    const localCtx: AdjustmentContext = { month, rng: ctx.rng, referenceData: ctx.referenceData, taxBasis };
    const result = resolveAdjustable(localCtx, buildExpenseAdjustable(expenseState, month));
    const views = expenseViews(result, expenseState.config.category);
    totalExpensesCents += views.outOfPocketCents;
    const { id, label } = expenseState.config;
    flows.push(
      { domain: "expense", entityId: id, entityLabel: label, viewKey: "total", amountCents: views.totalMonthlyCents },
      { domain: "expense", entityId: id, entityLabel: label, viewKey: "outOfPocket", amountCents: views.outOfPocketCents },
    );
  }

  // Debts: pay down principal, accumulate total cash paid.
  let totalDebtPaymentsCents = 0;
  const nextDebts = previous.debts.map((debtState) => {
    const { id, label } = debtState.config;
    if (!isDebtActive(debtState, month)) {
      balances.push({ domain: "debt", entityId: id, metricKey: "remainingBalance", amountCents: debtState.remainingBalanceCents });
      return debtState;
    }
    const result = resolveAdjustable(
      { month, rng: ctx.rng, referenceData: ctx.referenceData, taxBasis },
      buildDebtPaymentAdjustable(debtState),
    );
    const views = debtViews(result, debtState.remainingBalanceCents);
    totalDebtPaymentsCents += views.totalPaymentCents;
    flows.push(
      { domain: "debt", entityId: id, entityLabel: label, viewKey: "totalPayment", amountCents: views.totalPaymentCents },
      { domain: "debt", entityId: id, entityLabel: label, viewKey: "principalPortion", amountCents: views.principalPortionCents },
      { domain: "debt", entityId: id, entityLabel: label, viewKey: "interestPortion", amountCents: views.interestPortionCents },
      { domain: "debt", entityId: id, entityLabel: label, viewKey: "escrowPortion", amountCents: views.escrowPortionCents },
    );
    const next = applyPrincipalPayment(debtState, views.principalPortionCents);
    balances.push({ domain: "debt", entityId: id, metricKey: "remainingBalance", amountCents: next.remainingBalanceCents });
    return next;
  });

  // Net cash flow lands on the first financial asset (the household's primary cash account);
  // any additional financial assets just grow on their own — a documented simplification, see README.
  const netCashFlowCents = totalTakeHomeCents - totalExpensesCents - totalDebtPaymentsCents;
  const nextFinancialAssets = previous.financialAssets.map((assetState, index) => {
    const next = tickFinancialAsset(assetState, index === 0 ? netCashFlowCents : 0);
    balances.push({ domain: "financialAsset", entityId: assetState.config.id, metricKey: "balance", amountCents: next.balanceCents });
    return next;
  });

  // Portfolio: grow every holding under the run's returns strategy. Contributions/withdrawals are
  // applied by the caller before invoking tick, not derived automatically from cash flow here.
  const nextHoldings = previous.portfolio.holdings.map((holding) => {
    const next = tickHoldingGrowth(holding, ctx.returnsStrategy, month, ctx.rng);
    balances.push({ domain: "portfolio", entityId: holding.config.id, metricKey: "balance", amountCents: next.balanceCents });
    balances.push({ domain: "portfolio", entityId: holding.config.id, metricKey: "costBasis", amountCents: next.costBasisCents });
    return next;
  });

  for (const physicalAsset of previous.physicalAssets) {
    const value = currentPhysicalAssetValueCents(physicalAsset.config, month);
    balances.push({ domain: "physicalAsset", entityId: physicalAsset.config.id, metricKey: "value", amountCents: value });
  }

  const netWorthCents = computeNetWorthCents({
    financialAssets: nextFinancialAssets,
    portfolio: { holdings: nextHoldings },
    physicalAssets: previous.physicalAssets,
    debts: nextDebts,
    month,
  });

  const snapshot: LifeStateSnapshot = {
    runId: previous.runId,
    month,
    parentSnapshotRef: previous.parentSnapshotRef,
    decisions,
    incomes: nextIncomes,
    expenses: previous.expenses,
    debts: nextDebts,
    financialAssets: nextFinancialAssets,
    portfolio: { holdings: nextHoldings },
    physicalAssets: previous.physicalAssets,
    taxBasis,
    netWorthCents,
    extensions: previous.extensions,
  };

  return { snapshot, detail: { month, flows, balances } };
}
