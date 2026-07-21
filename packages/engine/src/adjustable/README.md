# adjustable

The shared mechanism behind gross, after-tax, after-payroll, tax-free, and other
derived views. An `Adjustable` supplies a gross amount plus an ordered pipeline
of `Adjustment`s; `resolveAdjustable` emits signed `LineItem`s that reconcile
exactly to `netCents`. Income, expenses, debts, and asset upkeep can assemble
domain-specific views without duplicating pipeline mechanics.

## Current entry point

`index.ts` exports `Adjustment`, `LineItem`, `Adjustable`, `AdjustableResult`,
`AdjustmentContext`, `resolveAdjustable`, `findLineItem`, and `sumLineItems`.
Context is deliberately smaller than the full snapshot (month, RNG, reference
data, and tax basis), keeping this domain reusable and cycle-free.

## Detailed payroll pipeline target

Career simulation requires reconciliation at both pay-event and monthly levels.
Keep `Adjustable` generic, but extend its metadata/contexts or add a compatible
batch API so every result can retain:

- stable event, source, person, pay-period, and component ids;
- effective calendar date/period and reference-data version;
- line-item category/tax treatment (`earning`, `pretaxDeduction`, `tax`,
  `postTaxDeduction`, `employerBenefit`, `reimbursement`);
- provenance/explanation metadata for decision-panel breakdowns;
- optional quantity/rate facts (hours, hourly rate, overtime multiplier,
  commission basis) without making the generic resolver calculate payroll.

Proposed APIs: `resolveAdjustables(ctx, events)` preserving input order and
`reconcileResults(results)` for source/member/month rollups. If metadata is added
to `LineItem`, existing `{ key, label, amountCents }` consumers must remain valid.

## Simulation rules

- The caller computes hourly/salary/contract gross for a pay event; this domain
  runs ordered adjustments and validates integer cents. It must not know what a
  7/7 or 10/4 schedule means.
- Resolve each real paycheck separately before monthly aggregation so annual
  limits, withholding, bonuses, commissions, and extra-paycheck months are not
  distorted by averaging.
- Adjustment order is explicit and inspectable. Later steps may read earlier
  lines; no implicit sorting, cross-call memoization, or hidden snapshot access.
- Duplicate keys are either rejected or intentionally namespaced/indexed; lookup
  semantics must never silently return the wrong deduction when several lines
  share a category.
- Signed-value convention is uniform: earnings/reimbursements positive,
  withholding/deductions negative. Employer-paid benefits are reportable value
  but excluded from employee net cash unless a domain explicitly maps them.
- Batched rollups use safe cent addition, preserve source/person attribution,
  and return reconciliation failures with the event/line responsible.
- Determinism includes stable line order and explanations for the same context,
  RNG seed, reference data, and input events.

## Decision-panel output

Expose a domain-neutral breakdown DTO sufficient for career comparison: gross,
ordered labeled additions/subtractions, net, component category, owner/source,
and assumption/provenance keys. The UI can then render "how we got this number"
for hourly pay, overtime, bonus, commission, tax, benefits, and deductions. The
resolver should never format currency or contain occupation/search logic.

## Reference data

`AdjustmentContext` should carry or reference a pinned bundle version. Domain
adjustments read their rates/rules from that bundle; adjustable only transports
provenance and does not interpret occupation, tax, benefits, or schedule data.

## Tests and acceptance criteria

- Existing invariant remains exact: `netCents === grossCents + sum(lineItems)`;
  order stays caller-controlled; later adjustments can inspect earlier ones.
- Reject unsafe/non-integer gross and line values with event/source/key context.
- Regular + overtime + bonus + commission followed by pretax deductions, taxes,
  and post-tax deductions reconciles for weekly, biweekly, semimonthly, and
  monthly checks.
- Batch totals equal the exact sum of event results and preserve two earners,
  multiple jobs, and extra-paycheck-month attribution.
- Test zero gross, negative clawback, duplicate keys, adjustment returning zero,
  annual-limit crossing, missing optional metadata, and deterministic seeded
  variable adjustments.
- Employer benefits appear in total-compensation metadata but cannot alter net
  cash accidentally.

## Dependencies and open questions

Depends on: `money/`, `types/`, `rng/`, and `reference-data/`. Income/tax/benefit
domains build the concrete pipelines; simulation owns batching by month.

Decide whether metadata is added directly or through generic type parameters,
whether duplicate keys are legal, how exact pay dates enter the minimal context,
whether results need schema versioning, and which reconciliation diagnostics are
public API versus development assertions.
