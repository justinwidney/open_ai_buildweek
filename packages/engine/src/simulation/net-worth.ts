import { addC, type Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { DebtState } from "../debts/index.js";
import type { FinancialAssetState } from "../assets/index.js";
import type { PortfolioState } from "../portfolio/index.js";
import type { PhysicalAssetState } from "../physical-assets/index.js";
import { currentPhysicalAssetValueCents } from "../physical-assets/index.js";

export interface NetWorthInputs {
  financialAssets: readonly FinancialAssetState[];
  portfolio: PortfolioState;
  physicalAssets: readonly PhysicalAssetState[];
  debts: readonly DebtState[];
  month: MonthKey;
}

/**
 * Total assets minus total liabilities — physical assets count at their
 * full current value and debts subtract their full remaining balance
 * directly, rather than netting each physical asset against its linked
 * debt individually first. Both approaches are mathematically equivalent
 * for the total; this one is simpler and doesn't require every debt to
 * declare a linked physical asset.
 */
export function computeNetWorthCents(inputs: NetWorthInputs): Cents {
  const financialTotal = addC(...inputs.financialAssets.map((a) => a.balanceCents));
  const portfolioTotal = addC(...inputs.portfolio.holdings.map((h) => h.balanceCents));
  const physicalTotal = addC(...inputs.physicalAssets.map((p) => currentPhysicalAssetValueCents(p.config, inputs.month)));
  const debtTotal = addC(...inputs.debts.map((d) => d.remainingBalanceCents));
  return financialTotal + portfolioTotal + physicalTotal - debtTotal;
}
