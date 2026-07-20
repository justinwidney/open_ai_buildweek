import { cents } from "../money/index.js";
import type { HomePriceBenchmarks } from "./types.js";

export const homePriceBenchmarks2026: HomePriceBenchmarks = {
  asOfMonth: "2026-06",
  nationalMedianCents: cents(440_600),
  thirtyYearMortgageRate: 0.0655,
  tiers: [
    {
      tier: "low-cost-metro",
      exampleMetro: "Detroit, MI",
      medianPriceCents: cents(100_000),
      source: "Redfin Data Center, 3-month trailing metro medians",
      url: "https://www.redfin.com/news/data-center/",
      asOf: "2026-05-01",
    },
    {
      tier: "mid-cost-metro",
      exampleMetro: "Austin, TX",
      medianPriceCents: cents(542_000),
      source: "Redfin Data Center, 3-month trailing metro medians",
      url: "https://www.redfin.com/news/data-center/",
      asOf: "2026-05-01",
    },
    {
      tier: "high-cost-metro",
      exampleMetro: "San Francisco, CA",
      medianPriceCents: cents(1_800_000),
      source: "Redfin Data Center, 3-month trailing metro medians",
      url: "https://www.redfin.com/news/data-center/",
      asOf: "2026-05-01",
    },
    {
      tier: "national-median",
      exampleMetro: "United States (existing-home sales)",
      medianPriceCents: cents(440_600),
      source: "National Association of Realtors, existing-home sales report",
      url: "https://www.nar.realtor/newsroom/nar-existing-home-sales-report-shows-2-4-decrease-in-june",
      asOf: "2026-06-01",
    },
  ],
  source: "National Association of Realtors (national median); Freddie Mac Primary Mortgage Market Survey (mortgage rate)",
  url: "https://www.freddiemac.com/pmms",
  asOf: "2026-07-16",
};
