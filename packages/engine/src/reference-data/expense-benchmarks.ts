import { cents } from "../money/index.js";
import type { HouseholdExpenseBenchmarks } from "./types.js";

const annualTotal = 78_535;
const shares: Record<string, number> = {
  Housing: 0.334,
  Transportation: 0.17,
  Food: 0.129,
  "Personal insurance and pensions": 0.125,
  Healthcare: 0.079,
  Entertainment: 0.046,
  "Cash contributions": 0.029,
  Apparel: 0.025,
  Education: 0.02,
  Miscellaneous: 0.016,
  "Personal care": 0.012,
  "Alcoholic beverages": 0.008,
  Tobacco: 0.004,
  Reading: 0.002,
};

export const householdExpenseBenchmarks2024: HouseholdExpenseBenchmarks = {
  surveyYear: 2024,
  annualTotalCents: cents(annualTotal),
  categories: Object.entries(shares).map(([category, shareOfTotal]) => ({
    category,
    shareOfTotal,
    annualCents: cents(Math.round(annualTotal * shareOfTotal)),
  })),
  source: "BLS News Release, Consumer Expenditures—2024 (Consumer Expenditure Survey)",
  url: "https://www.bls.gov/news.release/cesan.nr0.htm",
  asOf: "2024-12-31",
};
