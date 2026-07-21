import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { FilingStatus } from "../types/tax-basis.js";
import type { IncomeSourceConfig } from "../income/index.js";
import { initialDebtState } from "../debts/index.js";
import type { EventEffect } from "./apply.js";
import type { StateMutation } from "./mutations.js";

/**
 * Concrete life-event builders. Each takes plain parameters plus the
 * `effectiveFromMonth` (the fork month the change takes effect) and returns an
 * `EventEffect` — the decision to record and the state mutations to apply.
 * These are the reusable "fork templates"; the divergence analysis in Layer 5
 * compares branches produced by different choices of these.
 *
 * Note: household roster changes (adding a dependent/spouse to the `household/`
 * model) are the caller's responsibility to mirror alongside these — an event
 * touches the financial snapshot (incomes/expenses/debts/assets/filing status),
 * which is what a branch actually simulates.
 */

/** Change a pretax retirement contribution rate — the everyday "adjust my budget/savings" fork. */
export function changeContributionRate(params: { incomeId: string; newDeferralRate: number; effectiveFromMonth: MonthKey }): EventEffect {
  return {
    decision: {
      id: `contribution-rate:${params.incomeId}`,
      domain: "financial",
      optionId: `rate-${params.newDeferralRate}`,
      label: `Set 401(k) deferral to ${Math.round(params.newDeferralRate * 100)}%`,
      effectiveFromMonth: params.effectiveFromMonth,
    },
    mutations: [{ kind: "patchIncomeConfig", id: params.incomeId, patch: { pretaxDeferralRate: params.newDeferralRate } }],
  };
}

/** Replace one job with another (new salary, growth, state, deferral). Removing the old income and adding the new one. */
export function changeJob(params: { oldIncomeId: string; newJob: Omit<IncomeSourceConfig, "startMonth">; effectiveFromMonth: MonthKey }): EventEffect {
  const config: IncomeSourceConfig = { ...params.newJob, startMonth: params.effectiveFromMonth };
  return {
    decision: {
      id: `change-job:${params.newJob.id}`,
      domain: "career",
      optionId: params.newJob.id,
      label: `Change job to ${params.newJob.label}`,
      effectiveFromMonth: params.effectiveFromMonth,
    },
    mutations: [
      { kind: "removeIncome", id: params.oldIncomeId },
      { kind: "addIncome", income: { config } },
    ],
  };
}

export interface BuyHomeParams {
  id: string;
  label?: string;
  priceCents: Cents;
  downPaymentCents: Cents;
  closingCostsCents?: Cents;
  mortgageAnnualRate: number;
  termMonths: number;
  monthlyEscrowCents: Cents;
  monthlyMaintenanceCents: Cents;
  annualAppreciationRate: number;
  effectiveFromMonth: MonthKey;
  /** Which cash account funds the down payment + closing; defaults to the primary account. */
  cashAssetId?: string;
}

/** Buy a home: cash out for down payment + closing, a mortgage debt, and the house as an appreciating physical asset. */
export function buyHome(params: BuyHomeParams): EventEffect {
  const label = params.label ?? "Home";
  const mortgageId = `${params.id}-mortgage`;
  const upfrontCents = params.downPaymentCents + (params.closingCostsCents ?? 0);
  return {
    decision: { id: `buy-home:${params.id}`, domain: "housing", optionId: params.id, label: `Buy ${label}`, effectiveFromMonth: params.effectiveFromMonth },
    mutations: [
      { kind: "adjustCash", deltaCents: -upfrontCents, assetId: params.cashAssetId },
      {
        kind: "addDebt",
        debt: initialDebtState({
          id: mortgageId,
          label: `${label} mortgage`,
          originalPrincipalCents: params.priceCents - params.downPaymentCents,
          annualRate: params.mortgageAnnualRate,
          termMonths: params.termMonths,
          startMonth: params.effectiveFromMonth,
          monthlyEscrowCents: params.monthlyEscrowCents,
        }),
      },
      {
        kind: "addPhysicalAsset",
        asset: {
          config: {
            id: params.id,
            label,
            purchasePriceCents: params.priceCents,
            purchaseMonth: params.effectiveFromMonth,
            annualValueChangeRate: params.annualAppreciationRate,
            monthlyUpkeepCents: params.monthlyMaintenanceCents,
            linkedDebtId: mortgageId,
          },
        },
      },
    ],
  };
}

export interface BuyCarParams {
  id: string;
  label?: string;
  priceCents: Cents;
  /** Cash paid up front; the remainder (if any) becomes an auto loan. Defaults to the full price (cash purchase). */
  downPaymentCents?: Cents;
  loanAnnualRate?: number;
  loanTermMonths?: number;
  monthlyInsuranceCents: Cents;
  /** Cars lose value: a negative net rate. Defaults to −15%/yr. */
  annualDepreciationRate?: number;
  effectiveFromMonth: MonthKey;
  cashAssetId?: string;
}

/**
 * Buy a car: cash out for the down payment, an optional auto loan for the rest,
 * a depreciating physical asset, and a recurring insurance expense. The mirror
 * of `buyHome` for a wasting asset.
 */
export function buyCar(params: BuyCarParams): EventEffect {
  const label = params.label ?? "Car";
  const down = params.downPaymentCents ?? params.priceCents;
  const financedCents = Math.max(0, params.priceCents - down);
  const loanId = `${params.id}-loan`;
  const mutations: StateMutation[] = [
    { kind: "adjustCash", deltaCents: -down, assetId: params.cashAssetId },
    {
      kind: "addPhysicalAsset",
      asset: {
        config: {
          id: params.id,
          label,
          purchasePriceCents: params.priceCents,
          purchaseMonth: params.effectiveFromMonth,
          annualValueChangeRate: params.annualDepreciationRate ?? -0.15,
          monthlyUpkeepCents: params.monthlyInsuranceCents,
          linkedDebtId: financedCents > 0 ? loanId : undefined,
        },
      },
    },
  ];
  if (financedCents > 0) {
    mutations.splice(1, 0, {
      kind: "addDebt",
      debt: initialDebtState({
        id: loanId,
        label: `${label} loan`,
        originalPrincipalCents: financedCents,
        annualRate: params.loanAnnualRate ?? 0.07,
        termMonths: params.loanTermMonths ?? 60,
        startMonth: params.effectiveFromMonth,
        monthlyEscrowCents: 0,
      }),
    });
  }
  return {
    decision: { id: `buy-car:${params.id}`, domain: "lifestyle", optionId: params.id, label: `Buy ${label}`, effectiveFromMonth: params.effectiveFromMonth },
    mutations,
  };
}

/** Marriage: change filing status, optionally add a spouse's income and a one-time wedding cost. */
export function marry(params: {
  effectiveFromMonth: MonthKey;
  filingStatus?: FilingStatus;
  spouseIncome?: Omit<IncomeSourceConfig, "startMonth">;
  weddingCostCents?: Cents;
}): EventEffect {
  const mutations: StateMutation[] = [{ kind: "setFilingStatus", filingStatus: params.filingStatus ?? "marriedFilingJointly" }];
  if (params.spouseIncome) mutations.push({ kind: "addIncome", income: { config: { ...params.spouseIncome, startMonth: params.effectiveFromMonth } } });
  if (params.weddingCostCents) mutations.push({ kind: "adjustCash", deltaCents: -params.weddingCostCents });
  return {
    decision: { id: "marry", domain: "family", optionId: "married", label: "Get married", effectiveFromMonth: params.effectiveFromMonth },
    mutations,
  };
}

/** Have a child: a one-time birth cost and an ongoing childcare expense (ending when childcare is no longer needed). */
export function haveChild(params: {
  childId: string;
  effectiveFromMonth: MonthKey;
  oneTimeBirthCostCents?: Cents;
  monthlyChildcareCents: Cents;
  childcareEndMonth?: MonthKey;
  annualChildcareInflation?: number;
}): EventEffect {
  const mutations: StateMutation[] = [];
  if (params.oneTimeBirthCostCents) mutations.push({ kind: "adjustCash", deltaCents: -params.oneTimeBirthCostCents });
  mutations.push({
    kind: "addExpense",
    expense: {
      config: {
        id: `childcare-${params.childId}`,
        label: `Childcare (${params.childId})`,
        category: "fixed",
        baseMonthlyAmountCents: params.monthlyChildcareCents,
        annualInflationRate: params.annualChildcareInflation ?? 0.03,
        startMonth: params.effectiveFromMonth,
        endMonth: params.childcareEndMonth,
      },
    },
  });
  return {
    decision: { id: `have-child:${params.childId}`, domain: "family", optionId: params.childId, label: "Have a child", effectiveFromMonth: params.effectiveFromMonth },
    mutations,
  };
}

/** A one-time windfall (inheritance, bonus, equity sale) landing in a cash account. */
export function receiveWindfall(params: { id: string; amountCents: Cents; effectiveFromMonth: MonthKey; cashAssetId?: string; label?: string }): EventEffect {
  return {
    decision: { id: `windfall:${params.id}`, domain: "windfall", optionId: params.id, label: params.label ?? "Windfall", effectiveFromMonth: params.effectiveFromMonth },
    mutations: [{ kind: "adjustCash", deltaCents: params.amountCents, assetId: params.cashAssetId }],
  };
}

/** Relocate: change the income's state (tax) and optionally its salary, plus adjust cost-of-living expenses. */
export function relocate(params: {
  incomeId: string;
  newStateCode: string;
  newBaseMonthlyGrossCents?: Cents;
  expenseAdjustments?: readonly { id: string; newMonthlyAmountCents: Cents }[];
  effectiveFromMonth: MonthKey;
}): EventEffect {
  const incomePatch: { stateCode: string; baseMonthlyGrossCents?: Cents } = { stateCode: params.newStateCode };
  if (params.newBaseMonthlyGrossCents !== undefined) incomePatch.baseMonthlyGrossCents = params.newBaseMonthlyGrossCents;
  const mutations: StateMutation[] = [{ kind: "patchIncomeConfig", id: params.incomeId, patch: incomePatch }];
  for (const adj of params.expenseAdjustments ?? []) {
    mutations.push({ kind: "patchExpenseConfig", id: adj.id, patch: { baseMonthlyAmountCents: adj.newMonthlyAmountCents } });
  }
  return {
    decision: { id: `relocate:${params.newStateCode}`, domain: "career", optionId: params.newStateCode, label: `Relocate to ${params.newStateCode}`, effectiveFromMonth: params.effectiveFromMonth },
    mutations,
  };
}
