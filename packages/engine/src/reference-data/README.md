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
