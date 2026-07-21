import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { ExpenseCategory } from "../expenses/types.js";
import type { AccountType, TaxTreatment } from "../accounts/types.js";
import { accountTypeInfo } from "../accounts/info.js";
import type { Household, HouseholdContext } from "../household/index.js";
import { householdContextAt } from "../household/index.js";
import { currentPhysicalAssetValueCents } from "../physical-assets/index.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import type { MonthDetail } from "../simulation/detail.js";

const MONTHS_PER_YEAR = 12;
const DEFAULT_SAFE_WITHDRAWAL_RATE = 0.04; // 4% rule → a 25× annual-spending FI target.

export interface StatementContext {
  /** The household this statement is for. When present, drives age, dependent count, and the CTC estimate (takes precedence over `ageYearsAtStart`). */
  household?: Household;
  /** The person's whole-year age at the run's month 0, so a statement can report age at any month. Fallback when no `household` is given. */
  ageYearsAtStart?: number;
  /** Withdrawal rate used for the FI number (annual spending ÷ rate). Defaults to 0.04 (the "25× expenses" rule). */
  safeWithdrawalRate?: number;
}

export interface IncomeSourceLine {
  entityId: string;
  entityLabel: string;
  grossCents: Cents;
  takeHomeCents: Cents;
  totalTaxCents: Cents;
}

export interface SpendingLine {
  entityId: string;
  entityLabel: string;
  /** An expense's own category, or "debt" for a debt's cash payment surfaced as spending. */
  category: ExpenseCategory | "debt";
  amountCents: Cents;
}

export interface AssetLine {
  domain: "financialAsset" | "portfolio" | "physicalAsset";
  entityId: string;
  valueCents: Cents;
  /** The account wrapper, for financial assets and holdings. Omitted for physical assets (not an account). */
  accountType?: AccountType;
  taxTreatment?: TaxTreatment;
}

/** Financial-account balances (cash + investments, excluding physical assets) grouped by tax treatment. */
export type BalancesByTaxTreatment = Record<TaxTreatment, Cents>;

export interface LiabilityLine {
  entityId: string;
  remainingBalanceCents: Cents;
}

/**
 * A complete, UI-ready picture of one month: income, the tax breakdown,
 * spending, debt service, cash flow, the balance sheet, and a few derived
 * planning metrics. This is the "state at any given month" read model — the
 * shape a pathway-simulator screen renders — assembled from an immutable
 * `LifeStateSnapshot` (balances) plus, when available, that month's
 * `MonthDetail` (flows). Forward-looking "expected future returns" is a
 * separate concern served by `forecast/`, not a single month's statement.
 */
export interface MonthlyStatement {
  month: MonthKey;
  calendarYear: number;
  /** Whole-year age (of the primary person) at this month, if a household or `ageYearsAtStart` was supplied. */
  ageYears?: number;
  /** Derived household facts (filing status, ages, dependents, CTC estimate) when a household was supplied. */
  household?: HouseholdContext;

  income: {
    grossCents: Cents;
    takeHomeCents: Cents;
    /** Pretax retirement contributions this month (the 401(k) deferral) — saved, but not take-home. */
    pretaxContributionCents: Cents;
    bySource: IncomeSourceLine[];
  };

  taxes: {
    federalCents: Cents;
    stateCents: Cents;
    ficaCents: Cents;
    totalCents: Cents;
    /** Total tax ÷ gross income (0 when there is no income this month). */
    effectiveRate: number;
  };

  spending: {
    fixedCents: Cents;
    discretionaryCents: Cents;
    /** Cash paid to debts this month (principal + interest + escrow). */
    debtPaymentCents: Cents;
    /** fixed + discretionary + debt payment — every dollar out the door this month. */
    totalCents: Cents;
    byLine: SpendingLine[];
  };

  debt: {
    totalPaymentCents: Cents;
    principalCents: Cents;
    interestCents: Cents;
    escrowCents: Cents;
    totalRemainingBalanceCents: Cents;
  };

  cashFlow: {
    /** Take-home minus all spending (incl. debt). What lands in / is drawn from the bank before interest. */
    netCents: Cents;
    /** (net cash flow + pretax contributions) ÷ gross income — total savings as a share of gross (0 when no income). */
    savingsRate: number;
  };

  balanceSheet: {
    cashCents: Cents;
    investmentsCents: Cents;
    physicalCents: Cents;
    totalAssetsCents: Cents;
    totalLiabilitiesCents: Cents;
    netWorthCents: Cents;
    assets: AssetLine[];
    liabilities: LiabilityLine[];
    /** Cash + investment balances grouped by tax treatment (taxable / tax-deferred / Roth / HSA / 529). Excludes physical assets. */
    byTaxTreatment: BalancesByTaxTreatment;
  };

  planning: {
    /** Cash ÷ monthly spending — how many months of expenses the emergency fund covers (0 when spending is 0). */
    emergencyFundMonths: number;
    /** This month's spending annualized (× 12) — a naive run-rate, not a lifetime average. */
    annualSpendingCents: Cents;
    /** Financial-independence target: annual spending ÷ safe withdrawal rate. */
    fiNumberCents: Cents;
    /** Net worth ÷ FI number — 1.0 means financially independent at the current run-rate. */
    fiProgress: number;
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/** Sums the `amountCents` of every flow matching a domain + viewKey. */
function sumFlow(detail: MonthDetail | undefined, domain: string, viewKey: string): Cents {
  if (!detail) return 0;
  return sum(detail.flows.filter((f) => f.domain === domain && f.viewKey === viewKey).map((f) => f.amountCents));
}

export interface BuildMonthlyStatementParams {
  snapshot: LifeStateSnapshot;
  /** The month's flow detail (income/tax/expense/debt). Omit for a month with no computed flows (e.g. the month-0 starting snapshot). */
  detail?: MonthDetail;
  context?: StatementContext;
}

/**
 * Assembles a `MonthlyStatement` from a snapshot (balances) and its optional
 * flow detail. Pure and allocation-free of hidden state: same inputs → same
 * statement. The balance sheet comes from the snapshot so it's always
 * available; income/tax/spending come from `detail` and are zero when it's
 * absent.
 */
export function buildMonthlyStatement(params: BuildMonthlyStatementParams): MonthlyStatement {
  const { snapshot, detail, context } = params;
  const swr = context?.safeWithdrawalRate ?? DEFAULT_SAFE_WITHDRAWAL_RATE;

  // --- Income + taxes (from flows) ---
  const grossCents = sumFlow(detail, "income", "gross");
  const takeHomeCents = sumFlow(detail, "income", "takeHome");
  const pretaxContributionCents = sumFlow(detail, "income", "taxFree");
  const federalCents = sumFlow(detail, "income", "federalTax");
  const stateCents = sumFlow(detail, "income", "stateTax");
  const ficaCents = sumFlow(detail, "income", "fica");
  const totalTaxCents = federalCents + stateCents + ficaCents;

  const incomeByEntity = new Map<string, IncomeSourceLine>();
  for (const flow of detail?.flows ?? []) {
    if (flow.domain !== "income") continue;
    const line = incomeByEntity.get(flow.entityId) ?? {
      entityId: flow.entityId,
      entityLabel: flow.entityLabel,
      grossCents: 0,
      takeHomeCents: 0,
      totalTaxCents: 0,
    };
    if (flow.viewKey === "gross") line.grossCents += flow.amountCents;
    else if (flow.viewKey === "takeHome") line.takeHomeCents += flow.amountCents;
    else if (flow.viewKey === "federalTax" || flow.viewKey === "stateTax" || flow.viewKey === "fica") line.totalTaxCents += flow.amountCents;
    incomeByEntity.set(flow.entityId, line);
  }

  // --- Spending (expenses + debt payments) ---
  const categoryById = new Map(snapshot.expenses.map((e) => [e.config.id, e.config.category]));
  const labelById = new Map(snapshot.expenses.map((e) => [e.config.id, e.config.label]));
  const spendingLines: SpendingLine[] = [];
  let fixedCents = 0;
  let discretionaryCents = 0;
  for (const flow of detail?.flows ?? []) {
    if (flow.domain !== "expense" || flow.viewKey !== "outOfPocket") continue;
    const category = categoryById.get(flow.entityId) ?? "fixed";
    if (category === "discretionary") discretionaryCents += flow.amountCents;
    else fixedCents += flow.amountCents;
    spendingLines.push({ entityId: flow.entityId, entityLabel: labelById.get(flow.entityId) ?? flow.entityLabel, category, amountCents: flow.amountCents });
  }

  // --- Debt service ---
  const debtPaymentCents = sumFlow(detail, "debt", "totalPayment");
  const principalCents = sumFlow(detail, "debt", "principalPortion");
  const interestCents = sumFlow(detail, "debt", "interestPortion");
  const escrowCents = sumFlow(detail, "debt", "escrowPortion");
  for (const flow of detail?.flows ?? []) {
    if (flow.domain === "debt" && flow.viewKey === "totalPayment") {
      spendingLines.push({ entityId: flow.entityId, entityLabel: flow.entityLabel, category: "debt", amountCents: flow.amountCents });
    }
  }

  const totalSpendingCents = fixedCents + discretionaryCents + debtPaymentCents;

  // --- Balance sheet (from the snapshot, so it's valid even without a detail) ---
  const byTaxTreatment: BalancesByTaxTreatment = { taxable: 0, taxDeferred: 0, roth: 0, hsa: 0, education529: 0 };
  const assets: AssetLine[] = [];
  let cashCents = 0;
  for (const asset of snapshot.financialAssets) {
    cashCents += asset.balanceCents;
    const info = accountTypeInfo(asset.config.accountType ?? "cash");
    byTaxTreatment[info.taxTreatment] += asset.balanceCents;
    assets.push({ domain: "financialAsset", entityId: asset.config.id, valueCents: asset.balanceCents, accountType: info.accountType, taxTreatment: info.taxTreatment });
  }
  let investmentsCents = 0;
  for (const holding of snapshot.portfolio.holdings) {
    investmentsCents += holding.balanceCents;
    const info = accountTypeInfo(holding.config.accountType ?? "taxableBrokerage");
    byTaxTreatment[info.taxTreatment] += holding.balanceCents;
    assets.push({ domain: "portfolio", entityId: holding.config.id, valueCents: holding.balanceCents, accountType: info.accountType, taxTreatment: info.taxTreatment });
  }
  let physicalCents = 0;
  for (const physical of snapshot.physicalAssets) {
    const value = currentPhysicalAssetValueCents(physical.config, snapshot.month);
    physicalCents += value;
    assets.push({ domain: "physicalAsset", entityId: physical.config.id, valueCents: value });
  }
  const liabilities: LiabilityLine[] = snapshot.debts.map((d) => ({ entityId: d.config.id, remainingBalanceCents: d.remainingBalanceCents }));
  const totalLiabilitiesCents = sum(liabilities.map((l) => l.remainingBalanceCents));
  const totalAssetsCents = cashCents + investmentsCents + physicalCents;

  // --- Derived planning metrics ---
  const netCashFlowCents = takeHomeCents - totalSpendingCents;
  const savingsRate = grossCents > 0 ? (netCashFlowCents + pretaxContributionCents) / grossCents : 0;
  const effectiveRate = grossCents > 0 ? totalTaxCents / grossCents : 0;
  const emergencyFundMonths = totalSpendingCents > 0 ? cashCents / totalSpendingCents : 0;
  const annualSpendingCents = totalSpendingCents * MONTHS_PER_YEAR;
  const fiNumberCents = Math.round(annualSpendingCents / swr);
  const fiProgress = fiNumberCents > 0 ? snapshot.netWorthCents / fiNumberCents : 0;

  const householdCtx = context?.household ? householdContextAt(context.household, snapshot.month) : undefined;
  const ageYears = householdCtx
    ? householdCtx.primaryAgeYears
    : context?.ageYearsAtStart === undefined
      ? undefined
      : context.ageYearsAtStart + Math.floor(snapshot.month / MONTHS_PER_YEAR);

  return {
    month: snapshot.month,
    calendarYear: snapshot.taxBasis.calendarYear,
    ageYears,
    household: householdCtx,
    income: {
      grossCents,
      takeHomeCents,
      pretaxContributionCents,
      bySource: [...incomeByEntity.values()],
    },
    taxes: { federalCents, stateCents, ficaCents, totalCents: totalTaxCents, effectiveRate },
    spending: { fixedCents, discretionaryCents, debtPaymentCents, totalCents: totalSpendingCents, byLine: spendingLines },
    debt: { totalPaymentCents: debtPaymentCents, principalCents, interestCents, escrowCents, totalRemainingBalanceCents: totalLiabilitiesCents },
    cashFlow: { netCents: netCashFlowCents, savingsRate },
    balanceSheet: {
      cashCents,
      investmentsCents,
      physicalCents,
      totalAssetsCents,
      totalLiabilitiesCents,
      netWorthCents: snapshot.netWorthCents,
      assets,
      liabilities,
      byTaxTreatment,
    },
    planning: { emergencyFundMonths, annualSpendingCents, fiNumberCents, fiProgress },
  };
}
