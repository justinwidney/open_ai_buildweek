import { federalIncomeTax2026 } from "./federal-income-tax.js";
import { fica2026 } from "./fica.js";
import { socialSecurity2026 } from "./social-security.js";
import { capitalGains2026 } from "./capital-gains.js";
import { retirementLimits2026 } from "./retirement-limits.js";
import { stateTaxByCode } from "./state-tax.js";
import { householdExpenseBenchmarks2024 } from "./expense-benchmarks.js";
import { homePriceBenchmarks2026 } from "./home-price-benchmarks.js";
import { historicalReturnsByAssetClass } from "./historical-returns.js";
import type { ReferenceDataBundle } from "./types.js";

export * from "./types.js";
export { applyBrackets, federalIncomeTax2026 } from "./federal-income-tax.js";
export { fica2026 } from "./fica.js";
export { computePia, socialSecurity2026 } from "./social-security.js";
export { capitalGains2026 } from "./capital-gains.js";
export { retirementLimits2026 } from "./retirement-limits.js";
export { californiaProgressive, coloradoFlatTax, nycLocalTaxNote, stateTaxByCode, texasNoIncomeTax } from "./state-tax.js";
export { householdExpenseBenchmarks2024 } from "./expense-benchmarks.js";
export { homePriceBenchmarks2026 } from "./home-price-benchmarks.js";
export { historicalReturnsByAssetClass, sp500TotalReturns1928to2025, treasuryBond10yTotalReturns1928to2025 } from "./historical-returns.js";

/** The default, current-year reference-data bundle every simulation is seeded with unless overridden. */
export const referenceData2026: ReferenceDataBundle = {
  federalIncomeTax: federalIncomeTax2026,
  fica: fica2026,
  socialSecurity: socialSecurity2026,
  capitalGains: capitalGains2026,
  retirementLimits: retirementLimits2026,
  stateTax: stateTaxByCode,
  expenseBenchmarks: householdExpenseBenchmarks2024,
  homePriceBenchmarks: homePriceBenchmarks2026,
  historicalReturns: historicalReturnsByAssetClass,
};
