# household

Who the simulation is for. A `Household` is the primary person, optional spouse,
dependents, and filing status. Ages are birth-month offsets from run month 0 so
members age automatically and can drive contribution catch-ups, RMDs, Social
Security timing, school eligibility, and age-specific results.

## Current entry point

`index.ts` exports `ageYearsAt`, `primaryPerson`, dependent/child-tax-credit
helpers, and `householdContextAt`. The current model derives ages and dependent
counts but does not yet connect members to jobs, education, benefits, childcare,
or federal withholding. Filing status also exists on `taxBasis` and must be
reconciled.

## Detailed life-sim model/API target

Extend the person/household contract with stable relationships rather than
embedding whole jobs or school records here:

- Every `EmploymentAgreement`, education enrollment, insurance election,
  account, debt, and major expense references a valid `personId` or household id.
- `Person` needs optional location/residency, work authorization, credentials,
  skills/licenses, student/work status, and availability constraints. Sensitive
  demographic traits should be added only when a named rule uses them.
- Household membership changes are effective-dated (marriage, separation,
  dependent birth/adoption, child aging out, member death) and never rewrite
  prior months.
- A career/school eligibility context should expose member age, completed and
  in-progress credentials, available work hours, location, dependents/care
  obligations, and partner coverage without importing income catalog types.
- Model multiple earners explicitly. Household totals aggregate all active jobs,
  but ownership is retained for pay, tax, benefits, leave, and career progress.

Proposed APIs include `householdAt(month)`, `memberContextAt(personId, month)`,
`validateFilingStatusAt(month)`, and selectors for active earners, students,
coverage members, and care dependents. A decision payload should identify which
member is choosing school/work and reject a missing or inactive member.

## Simulation rules

- Member ages and eligibility use one canonical calendar rule; leap dates and
  negative birth offsets must be specified and tested.
- A person may hold multiple compatible jobs. Schedule conflicts and combined
  weekly-hour limits should produce validation warnings/errors, not be silently
  accepted.
- School enrollment reduces available work hours according to program load;
  childcare/caregiving can further constrain shift choices. Whether constraints
  are hard or advisory must be explicit in the scenario rules.
- Filing status comes from household state for the month. Tax basis must consume
  that value or fail on disagreement; it must not drift as an independent fact.
- Partner/dependent benefit eligibility, childcare needs, and credits are
  effective-dated. A child aging out can change costs and taxes in the same
  defined month.
- Household income and budget views sum all earners, while statements keep
  `personId` on every source for drill-down and fair school-versus-work comparisons.

## Decision-panel output

The school/work crossroad needs a household-impact block showing the selected
member, partner/dependents, current active jobs and school commitments, weekly
hours available, schedule conflicts, benefit coverage changes, childcare needs,
filing-status implications, and household take-home/cash-flow before versus
after. It should explain blockers (missing credential, unavailable care, shift
overlap) and distinguish warnings from invalid choices.

## Reference data

Use versioned eligibility rules for dependent/partner benefits, filing-status
validation, school age/prerequisites, and childcare age bands. Keep tax amounts
in `reference-data/`/`tax/`; this domain should expose facts, not duplicate rate
tables. All defaults need jurisdiction/effective-year metadata.

## Tests and acceptance criteria

- Existing age and CTC tests remain valid: age advances at month 12 and only
  `kind: "child"` dependents under 17 qualify for the base credit.
- Primary and spouse jobs aggregate to household totals while remaining
  attributable by `personId`; two jobs for one member remain separate.
- Marriage, separation, birth/adoption, death, and dependent age-out take effect
  in the specified month without changing earlier snapshots.
- Filing-status mismatch is detected; household and tax outputs use one status.
- Full-time school plus incompatible full-time shift reports a conflict; a valid
  part-time schedule passes. Childcare/benefit changes appear in decision diffs.
- Reject duplicate ids, no primary member, invalid spouse role combinations,
  dangling person references, and end dates before start dates.

## Dependencies and open questions

Depends on: `money/`, `types/`, and effective-dated event/calendar utilities;
consumed by `income/`, `tax/`, `statement/`, budget, education, benefits, and UI
decision adapters.

Decide whether households can have more than two adult earners, whether people
can leave/rejoin a household, the exact birth/filing effective-date convention,
how schedule feasibility is enforced, and which demographic facts the first
jurisdiction genuinely requires.
