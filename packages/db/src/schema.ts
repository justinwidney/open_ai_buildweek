import { bigint, bigserial, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type {
  BalanceDomain,
  BalanceMetricKey,
  FlowDomain,
  FlowViewKey,
  JobStatus,
  ReturnsStrategyConfig,
  RootSeed,
  RunStatus,
} from "@control-ai/shared/sim";
import type { TaxBasisState } from "@control-ai/engine";

/**
 * Five tables for simulation *output* only (reference/lookup data like tax
 * brackets stays as versioned code in @control-ai/engine's reference-data/
 * folder, not here). Two generalized long/tidy fact tables —
 * `flowLineItems` for monthly flows and `balanceSnapshots` for
 * point-in-time stocks — cover every domain (income/expense/debt/
 * portfolio/physical-asset) uniformly via a `domain` + `viewKey`/
 * `metricKey` column pair, so adding a new domain or a new named view
 * never requires a migration, only a new value in those columns.
 *
 * Every `text` column holding a closed set of values and every `jsonb` blob
 * carries a `.$type<…>()` from `@control-ai/shared/sim`. Postgres still sees
 * plain `text`/`jsonb` — the point is that the *writer* is now checked, so a
 * `status: "complete"` typo or a hand-built `viewKey` that no Cube query will
 * ever match fails at compile time instead of becoming a silently unreadable
 * row. The same contracts type the Convex schema, which is what keeps the two
 * backends honest with each other.
 */

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  parentRunId: text("parent_run_id"),
  forkMonth: integer("fork_month"),
  label: text("label").notNull(),
  /** The decision label that produced this branch, for the pathway UI's fork markers. Null on a root run. */
  forkDecisionLabel: text("fork_decision_label"),
  /** The static entity configs a run replays from — see `RootSeed`/`buildInitialSnapshot`. */
  rootSeed: jsonb("root_seed").$type<RootSeed>().notNull(),
  /** Returns-strategy kind + params, so a run can be replayed exactly. */
  returnsStrategy: jsonb("returns_strategy").$type<ReturnsStrategyConfig>().notNull(),
  status: text("status").$type<RunStatus>().notNull().default("draft"),
  /** Primary person's age at month 0, so a run list can report age without parsing the seed. */
  ageYearsAtStart: integer("age_years_at_start"),
  /** Future per-user scoping. Null until auth exists. */
  ownerId: text("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runMonths = pgTable(
  "run_months",
  {
    runId: text("run_id").notNull(),
    month: integer("month").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    netWorthCents: bigint("net_worth_cents", { mode: "number" }).notNull(),
    taxBasis: jsonb("tax_basis").$type<TaxBasisState>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.month] })],
);

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  month: integer("month").notNull(),
  domain: text("domain").notNull(),
  optionId: text("option_id").notNull(),
  label: text("label").notNull(),
  effectiveFromMonth: integer("effective_from_month").notNull(),
});

export const flowLineItems = pgTable(
  "flow_line_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id").notNull(),
    month: integer("month").notNull(),
    domain: text("domain").$type<FlowDomain>().notNull(),
    entityId: text("entity_id").notNull(),
    entityLabel: text("entity_label").notNull(),
    viewKey: text("view_key").$type<FlowViewKey>().notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  },
  (table) => [index("flow_line_items_run_month_domain_view_idx").on(table.runId, table.month, table.domain, table.viewKey)],
);

export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id").notNull(),
    month: integer("month").notNull(),
    domain: text("domain").$type<BalanceDomain>().notNull(),
    entityId: text("entity_id").notNull(),
    metricKey: text("metric_key").$type<BalanceMetricKey>().notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  },
  (table) => [index("balance_snapshots_run_month_domain_metric_idx").on(table.runId, table.month, table.domain, table.metricKey)],
);

/** Owned conceptually by @control-ai/worker, but lives in this package's schema alongside everything else it persists to. */
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  fromMonth: integer("from_month").notNull(),
  toMonth: integer("to_month").notNull(),
  status: text("status").$type<JobStatus>().notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
