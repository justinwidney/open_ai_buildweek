# income

Income sources modeled as `Adjustable`s: a raw monthly gross amount (with
annual growth for raises/COLA) run through the pretax-deferral and tax pipeline
from `tax/`, then assembled into gross, after-payroll-deductions, after-tax,
tax-free, Social-Security-wages, and take-home views.

## Current entry point

`index.ts` exports `IncomeSourceConfig`, `IncomeState`, `isIncomeActive`,
`buildIncomeAdjustable`, and `incomeViews`. Today a source is already normalized
to `baseMonthlyGrossCents`, belongs to no explicit household member, and is
active between `startMonth` and optional exclusive `endMonth`. Annual growth is
compounded once per 12 active months.

## Detailed career simulation target

The school-versus-work crossroad needs two separate concepts:

- `OccupationDefinition`: reference/catalog data used by searchable career
  tiles. Proposed fields include occupation id, title, aliases, description,
  industry, career family, education/training/license requirements, typical
  work setting, available locations, pay-range percentiles, employment type
  options, schedule templates, benefits defaults, and advancement paths.
- `EmploymentAgreement`: the player's actual job. Proposed fields include id,
  `personId`, occupation id, employer/label, start/end month, location and state,
  compensation, schedule, benefits, deductions, raise policy, and optional
  probation/vesting dates. The simulation must snapshot chosen terms rather
  than silently changing an existing job when catalog data is updated.

Proposed compensation types:

```ts
type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
type Compensation =
  | { kind: "hourly"; hourlyRateCents: Cents; overtimePolicy: OvertimePolicy }
  | { kind: "salary"; annualSalaryCents: Cents; overtimePolicy?: OvertimePolicy }
  | { kind: "contract"; contractRateCents: Cents; rateUnit: "hour" | "day" | "project" };

interface WorkSchedule {
  hoursPerShift: number;
  pattern: { kind: "weekly"; daysPerWeek: number } |
           { kind: "rotation"; daysOn: number; daysOff: number }; // 10/4, 7/7
  shift: "day" | "evening" | "night" | "rotating";
  expectedUnpaidWeeksPerYear?: number;
}
```

Variable compensation should use composable rules rather than one blended pay
number: guaranteed/signing/annual/performance bonuses; commissions based on
revenue, units, or tiers; tips; shift differentials; on-call/call-out pay;
holiday pay; and deterministic or seeded-random payout timing. Each component
needs an id and a statement line so the UI can explain it.

Benefits and payroll deductions should include employee health/dental premiums,
HSA/FSA, pension/401(k) deferrals and employer match, union dues, disability or
life insurance, garnishments, and paid/unpaid leave. Employer-paid benefits are
valuable compensation but not take-home cash and must not be treated as player
spending.

Education/training is a prerequisite owned jointly with the education/event
domains: credential type, program duration/cost, entry requirements, license
renewal, and months unavailable or limited for work. Completing a credential
unlocks occupation options; choosing school must not create income unless the
player also selects a compatible part-time/co-op job.

## Simulation rules

- Generate pay events on their real cadence: 52 weekly, 26 biweekly, 24
  semimonthly, or 12 monthly checks per normal year. Do not divide all annual
  pay by 12 before applying per-paycheck caps, deductions, or withholding.
- Aggregate pay events into the monthly engine only after calculating hours,
  overtime, differentials, commissions, bonuses, unpaid leave, and deductions.
  Months with a fifth weekly or third biweekly check must visibly be higher.
- Derive scheduled hours from the calendar/rotation anchor. A `7/7` or `10/4`
  rotation can cross month and year boundaries; never restart it on day one of
  each month. Overtime rules state whether they use daily, weekly, or rotation
  thresholds and whether a role is exempt.
- Salary, hourly, and contract roles remain distinct. Contract income needs
  self-employment-tax and no-employer-benefit treatment unless explicitly
  overridden. Commission-only work may validly produce a zero-pay month.
- Raises/promotions change terms from an effective month; they do not rewrite
  history. Bonuses and commissions are taxed in the payout month and must be
  reproducible from the run seed.
- Every job is owned by `personId`; all active sources for primary, spouse, and
  side jobs contribute to household totals but remain separately traceable.
- Store cents as safe integers. Rounding occurs at the pay-event boundary and
  monthly totals equal the exact sum of included events.
- Preserve `baseMonthlyGrossCents` as a migration/input shortcut until all
  callers use structured compensation; do not make it a second source of truth.

## Career decision-panel output

The engine-facing query should filter and sort occupation tiles by text/alias,
industry, education, location, pay range, schedule/rotation, employment type,
and benefits. Each tile/comparison row needs:

- typical and player-specific gross annual pay, average monthly gross, expected
  take-home, effective tax rate, and low/typical/high variable-pay scenarios;
- pay frequency and next-pay preview, hours/shift, rotation, overtime eligibility,
  paid time off, benefit value and employee deductions;
- required school/training duration and cost, earliest start month, unmet
  prerequisites, and student-debt opportunity cost;
- cash-flow volatility, job security/risk assumptions, advancement/raise path,
  and projected results at 1, 5, and 10 years;
- a transparent breakdown with no unexplained "monthly salary" conversion.

Selection should emit a validated decision payload that references the catalog
choice plus player overrides, then creates/ends `EmploymentAgreement`s at the
decision month. Search and presentation belong to the UI/application layer;
catalog queries and deterministic comparison numbers belong in engine APIs.

## Reference data

Add versioned occupation, compensation-range, regional wage, education,
schedule-template, benefits, commission, and overtime-policy datasets. Every
record needs stable ids, source/provenance, geography, effective year, currency,
and update timestamp. Missing regional data must fall back explicitly (for
example region -> state -> national), with the fallback shown to the UI.

## Tests and acceptance criteria

- Existing named views reconcile to the same `AdjustableResult`, ordering
  remains `takeHome <= afterTax <= afterPayroll <= gross`, and annual growth
  still compounds once per active year.
- Known calendars produce exactly 52/26/24/12 checks, including a third
  biweekly/fifth weekly paycheck month and year-boundary cases.
- Hourly base + overtime + shift differential + bonus + commission reconciles
  to gross; deductions and taxes reconcile gross to take-home per source.
- A 7/7 and 10/4 rotation keeps phase across month boundaries and yields the
  expected regular/overtime hours for leap and non-leap years.
- Two earners plus a side job aggregate correctly while statements retain the
  owner and source breakdown; overlapping start/end dates do not double-count.
- Test zero hours, unpaid leave, negative commission clawback, capped bonus,
  missing catalog data, job loss mid-period, contract work, and safe-integer
  overflow rejection.
- Career search is deterministic, case-insensitive across title/aliases, honors
  every filter, has a stable tie-breaker, and returns all fields required by the
  comparison panel.

## Dependencies and open questions

Depends on: `adjustable/`, `tax/`, `money/`, `types/`, `household/`,
`reference-data/`, calendar/time utilities, and eventually education/events.

Decide jurisdiction/calendar scope (US-first or configurable), whether daily
simulation is required for rotations, how variable-pay distributions are
authored, whether contractors can opt into benefits, who owns unemployment/job
market risk, and how catalog versions are pinned to saved games.
