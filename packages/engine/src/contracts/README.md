# contracts

Dependency-light, serializable contracts shared by the engine, web app,
persistence packages, and workers. This folder owns the vocabulary at process
boundaries; domain calculations remain in their existing modules.

## Entry point

`index.ts` exports:

- `values.ts` — stable/versioned references, replay versions, effective
  periods, JSON-safe values, provenance, and structured validation results;
- `work.ts` — weekly, biweekly, semimonthly, and monthly pay schedules plus
  weekly and calendar-anchored rotational work patterns such as 7/7 and 10/4;
- `decisions.ts` — major/minor importance, preview/compare/commit session
  state, portable preview requests, metrics, deltas, and explanation lines;
- `catalog.ts` — deterministic catalog query, filtering, sorting, pagination,
  and common searchable-tile fields.

`@control-ai/shared/life-sim` re-exports this public surface so non-engine
consumers have an explicit shared import path. The dependency remains one-way:
shared may import engine contracts; the engine never imports shared.

## Boundaries

- Types crossing a worker, storage, or HTTP boundary must remain JSON-safe.
- Versioned references identify immutable records. A selected occupation,
  property, or decision option cannot silently change when a catalog updates.
- Effective periods use an inclusive start and exclusive end.
- Work cadence describes when pay is issued; hourly/salary/contract describes
  compensation basis and belongs in the income model.
- Search metadata never performs simulation calculations.
- `DecisionOptionPreview` is a read model, not persisted balance state.

## Acceptance

- Invalid stable IDs, dates, schedule anchors, periods, and rotations return
  structured validation failures.
- A 7/7 or 10/4 rotation retains its phase because it has a calendar anchor.
- Decision sessions cannot skip directly from open to committed; terminal
  sessions cannot return to preview.
- A committed session requires a selected versioned option.
- Catalog queries and decision previews round-trip through JSON without losing
  IDs, versions, cents, months, or filters.
- This folder imports only `money/` and leaf `types/`; it never imports a
  simulation domain with mutable state or side effects.

Depends on: `money/`, `types/`.
