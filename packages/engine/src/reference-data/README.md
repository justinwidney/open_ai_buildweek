# reference-data

Real-world numbers the simulation is grounded in — federal/state/payroll
tax rules, Social Security's PIA formula, retirement contribution limits,
household expense and home-price benchmarks, and historical market returns
— each carrying a `source`/`url`/`asOf` provenance field so it can be
deliberately refreshed later instead of silently drifting out of date.

## Entry point

`index.ts` exports each individual dataset plus `referenceData2026`, the
default `ReferenceDataBundle` a simulation is seeded with unless a caller
supplies its own (e.g. to model a different tax year or a hypothetical
policy change).

## Data files

- `federal-income-tax.ts` — 7-rate ordinary brackets + standard deductions,
  plus the marginal-bracket application helper `applyBrackets`.
- `fica.ts` — Social Security/Medicare rates, wage base, Additional
  Medicare Tax thresholds.
- `social-security.ts` — PIA bend points/formula + `computePia`.
- `capital-gains.ts` — long-term capital gains brackets + NIIT.
- `retirement-limits.ts` — 401(k)/IRA contribution limits.
- `state-tax.ts` — three representative archetypes (no-income-tax,
  flat-rate, progressive), **not** all fifty states; add more entries here
  without touching anything else.
- `expense-benchmarks.ts` — BLS Consumer Expenditure Survey category
  breakdown.
- `home-price-benchmarks.ts` — national/regional median home prices +
  mortgage rate.
- `historical-returns.ts` — real, independently-verified annual total-return
  series (1928-2025) for US large-cap equities and 10-year Treasuries, for
  the historical-backtest returns strategy — extracted directly from the
  NYU Stern (Damodaran) dataset's table markup, not approximated.

## Acceptance

- Every exported dataset has a non-empty `source`/`url`/`asOf`.
- Nothing here contains business logic beyond simple, obviously-correct
  helpers (`applyBrackets`, `computePia`) that other domains would
  otherwise have to duplicate.
- A number that wasn't independently verified this session says so in a
  comment rather than being presented as fact (see the flagged
  approximations in `federal-income-tax.ts`/`state-tax.ts`).

Depends on: `money/`, `types/`.

## Searchable life-choice catalogs (planned)

The detailed crossroads require versioned, queryable catalogs in addition to
the current calculation datasets. Initial catalogs should include:

- **careers/jobs:** occupation and specialization ids, region, credential and
  experience requirements, pay ranges, pay cadence, typical hours and
  overtime, shift/rotation patterns (including 10/4 and 7/7), bonus/commission
  models, benefits, raise/promotion and unemployment assumptions;
- **education paths:** institution/program/credential, duration, tuition and
  fees, aid, living costs, completion probability, entry requirements, and
  linked career outcomes; and
- **housing:** rent and purchase property types, region, price/rent ranges,
  mortgage products, down-payment/closing costs, property tax, insurance,
  utilities/fees, maintenance, appreciation/depreciation, and selling costs.

Catalog records use stable ids and normalized numeric fields; labels,
descriptions, aliases, tags, and locale keys support full-text search and
faceted filters. Range/frequency/unit semantics must be explicit. Search order
may change without changing simulation values, while a selected record/version
must resolve to the same assumptions later.

## Provenance, versions, and gaps (planned)

Every bundle and record needs a schema version, data version, source id/url,
publisher, geography, currency, `asOf`, effective date range, retrieval date,
methodology/transform note, confidence/quality flag, and license where
applicable. Derived values list their source records and formula version.
Defaults are explicit and jurisdiction-aware; unsupported or stale data returns
a warning/missing value rather than silently substituting a national average.

Bundles should be immutable, validate referential integrity, and expose a
manifest/hash used by branch and forecast replay. Updates create a new bundle;
committed runs keep their original version. Separate catalog ingestion and
validation from engine runtime so search indexes and refresh jobs cannot alter
an in-progress simulation.

## Additional acceptance criteria

- Catalog search/filter is deterministic for a query, locale, and data version;
  stable tie-breaking and pagination are documented.
- Every simulation-affecting field has unit, frequency, geography, effective
  dates, provenance, and a quality status; missing required data fails bundle
  validation.
- Tests cover stale/unsupported jurisdiction warnings, catalog migrations,
  referential integrity, immutable old versions, canonical manifest hashing,
  and representative career, education, rental, and purchase records.
