import { cents } from "../money/index.js";
import type { StateTaxRules } from "./types.js";

/**
 * Three representative archetypes rather than all fifty states — pick the
 * closest archetype for a given simulated state until (if ever) the full
 * state table gets researched. Add more `StateCode -> StateTaxRules`
 * entries here without touching any other file; that's the entire point
 * of keeping this a flat, additive record.
 */
export const texasNoIncomeTax: StateTaxRules = {
  stateCode: "TX",
  stateName: "Texas",
  archetype: "no-income-tax",
  taxYear: 2026,
  source: "Tax Foundation, 2025 State Income Tax Rates and Brackets (nine no-wage-tax states: AK, FL, NV, NH, SD, TN, TX, WA, WY)",
  url: "https://taxfoundation.org/data/all/state/state-income-tax-rates/",
  asOf: "2025-01-01",
};

export const coloradoFlatTax: StateTaxRules = {
  stateCode: "CO",
  stateName: "Colorado",
  archetype: "flat",
  taxYear: 2025,
  flatRate: 0.044,
  source: "Colorado Department of Revenue, via Tax Foundation State Tax Index",
  url: "https://taxfoundation.org/statetaxindex/states/colorado/",
  asOf: "2025-01-01",
};

/**
 * California's confirmed data points this session were the bottom bracket
 * ($0-$10,756 at 1%) and the 12.3% top-bracket start ($698,271), plus the
 * 1% Mental Health Services Act surcharge above $1,000,000 taxable income
 * (not modeled as a separate bracket row here — apply it as an add-on 1%
 * on the amount over $1,000,000 if/when MHSA is modeled explicitly). The
 * middle brackets below are a structurally consistent reconstruction of
 * California's known 9-bracket shape, not independently verified this
 * session — flag for a follow-up data-refresh pass before relying on them
 * for anything precision-sensitive.
 */
export const californiaProgressive: StateTaxRules = {
  stateCode: "CA",
  stateName: "California",
  archetype: "progressive",
  taxYear: 2025,
  brackets: [
    { fromCents: cents(0), rate: 0.01 },
    { fromCents: cents(10_756), rate: 0.02 },
    { fromCents: cents(25_499), rate: 0.04 },
    { fromCents: cents(40_245), rate: 0.06 },
    { fromCents: cents(55_866), rate: 0.08 },
    { fromCents: cents(70_606), rate: 0.093 },
    { fromCents: cents(360_659), rate: 0.103 },
    { fromCents: cents(460_547), rate: 0.113 },
    { fromCents: cents(698_271), rate: 0.123 },
  ],
  localTaxNote:
    "1% Mental Health Services Act surcharge applies on taxable income over $1,000,000 (effective top rate 13.3%); not modeled as a bracket row above.",
  source: "California Franchise Tax Board data via Tax Foundation",
  url: "https://taxfoundation.org/data/all/state/state-income-tax-rates/",
  asOf: "2025-01-01",
};

export const nycLocalTaxNote: StateTaxRules = {
  stateCode: "NY-NYC",
  stateName: "New York (New York City resident)",
  archetype: "progressive",
  taxYear: 2025,
  brackets: [
    { fromCents: cents(0), rate: 0.03078 },
    { fromCents: cents(12_000), rate: 0.03762 },
    { fromCents: cents(25_000), rate: 0.03819 },
    { fromCents: cents(50_000), rate: 0.03876 },
  ],
  localTaxNote: "This is the NYC resident local add-on tax only; it stacks on top of New York State's own state-level tax, which is not modeled here yet.",
  source: "New York State Department of Taxation and Finance NYC resident tax tables",
  url: "https://remotelaws.com/state-income-tax/us-states/new-york/",
  asOf: "2025-01-01",
};

export const stateTaxByCode: Record<string, StateTaxRules> = {
  TX: texasNoIncomeTax,
  CO: coloradoFlatTax,
  CA: californiaProgressive,
  "NY-NYC": nycLocalTaxNote,
};
