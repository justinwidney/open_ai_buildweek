import { bigint, bigserial, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Five tables for simulation *output* only (reference/lookup data like tax
 * brackets stays as versioned code in @control-ai/engine's reference-data/
 * folder, not here). Two generalized long/tidy fact tables —
 * `flowLineItems` for monthly flows and `balanceSnapshots` for
 * point-in-time stocks — cover every domain (income/expense/debt/
 * portfolio/physical-asset) uniformly via a `domain` + `viewKey`/
 * `metricKey` column pair, so adding a new domain or a new named view
 * never requires a migration, only a new value in those columns.
 */

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  parentRunId: text("parent_run_id"),
  forkMonth: integer("fork_month"),
  label: text("label").notNull(),
  /** Initial decisions/config a run was seeded with. */
  rootSeed: jsonb("root_seed").notNull(),
  /** Returns-strategy kind + params + rng seed, so a run can be replayed exactly. */
  returnsStrategy: jsonb("returns_strategy").notNull(),
  status: text("status").notNull().default("draft"),
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
    taxBasis: jsonb("tax_basis").notNull(),
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
    domain: text("domain").notNull(),
    entityId: text("entity_id").notNull(),
    entityLabel: text("entity_label").notNull(),
    viewKey: text("view_key").notNull(),
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
    domain: text("domain").notNull(),
    entityId: text("entity_id").notNull(),
    metricKey: text("metric_key").notNull(),
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
  status: text("status").notNull().default("queued"), // queued | running | done | error
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
