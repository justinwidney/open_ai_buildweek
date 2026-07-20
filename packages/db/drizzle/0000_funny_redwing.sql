CREATE TABLE "balance_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"month" integer NOT NULL,
	"domain" text NOT NULL,
	"entity_id" text NOT NULL,
	"metric_key" text NOT NULL,
	"amount_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"month" integer NOT NULL,
	"domain" text NOT NULL,
	"option_id" text NOT NULL,
	"label" text NOT NULL,
	"effective_from_month" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_line_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"month" integer NOT NULL,
	"domain" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_label" text NOT NULL,
	"view_key" text NOT NULL,
	"amount_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"from_month" integer NOT NULL,
	"to_month" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_months" (
	"run_id" text NOT NULL,
	"month" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"net_worth_cents" bigint NOT NULL,
	"tax_basis" jsonb NOT NULL,
	CONSTRAINT "run_months_run_id_month_pk" PRIMARY KEY("run_id","month")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_run_id" text,
	"fork_month" integer,
	"label" text NOT NULL,
	"root_seed" jsonb NOT NULL,
	"returns_strategy" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "balance_snapshots_run_month_domain_metric_idx" ON "balance_snapshots" USING btree ("run_id","month","domain","metric_key");--> statement-breakpoint
CREATE INDEX "flow_line_items_run_month_domain_view_idx" ON "flow_line_items" USING btree ("run_id","month","domain","view_key");