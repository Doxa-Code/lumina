-- Drop foreign key constraints first (before dropping tables they reference)
ALTER TABLE "alert_history" DROP CONSTRAINT IF EXISTS "alert_history_alert_id_alerts_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_silences" DROP CONSTRAINT IF EXISTS "alert_silences_alert_id_alerts_v2_id_fk";
--> statement-breakpoint
-- Now drop the tables
DROP TABLE IF EXISTS "alerts_v2" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "correlations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "dashboard_widgets_v2" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "dashboards_v2" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "escalation_policies" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "insights" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "log_patterns" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "slo_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "slos" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "visualization_templates" CASCADE;--> statement-breakpoint
-- Create new tables
CREATE TABLE IF NOT EXISTS "alerts_extended" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"data_source" varchar(50) NOT NULL,
	"query_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"condition_type" varchar(50) NOT NULL,
	"threshold" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"severity" varchar(50) DEFAULT 'warning' NOT NULL,
	"notification_channel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notification_message" text,
	"evaluation_interval" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"state" varchar(50) DEFAULT 'ok' NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"last_triggered_at" timestamp with time zone,
	"firing_started_at" timestamp with time zone,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"annotations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboards_extended" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"time_range" jsonb DEFAULT '{"type":"relative","value":"24h"}'::jsonb NOT NULL,
	"refresh_interval" integer,
	"visibility" varchar(50) DEFAULT 'private' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"template_category" varchar(100),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboard_widgets_extended" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"query_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "alert_history_alert_time_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "alert_silences_project_time_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "service_dependencies_project_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "service_dependencies_services_idx";--> statement-breakpoint
ALTER TABLE "alert_history" ALTER COLUMN "event" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "alert_history" ALTER COLUMN "previous_state" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "alert_history" ALTER COLUMN "new_state" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "alert_history" ALTER COLUMN "value" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "alert_history" ALTER COLUMN "threshold" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "alert_silences" ALTER COLUMN "alert_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_channels" ALTER COLUMN "last_test_result" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "service_dependencies" ALTER COLUMN "request_count" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "service_dependencies" ALTER COLUMN "error_count" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "service_dependencies" ALTER COLUMN "avg_latency_ms" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "service_dependencies" ALTER COLUMN "p99_latency_ms" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "service_dependencies" ALTER COLUMN "last_seen_at" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alerts_extended" ADD CONSTRAINT "alerts_extended_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alerts_extended" ADD CONSTRAINT "alerts_extended_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_widgets_extended" ADD CONSTRAINT "dashboard_widgets_extended_dashboard_id_dashboards_extended_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards_extended"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_widgets_extended" ADD CONSTRAINT "dashboard_widgets_extended_query_id_saved_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."saved_queries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboards_extended" ADD CONSTRAINT "dashboards_extended_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboards_extended" ADD CONSTRAINT "dashboards_extended_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_id_alerts_extended_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts_extended"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_silences" ADD CONSTRAINT "alert_silences_alert_id_alerts_extended_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts_extended"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_dependencies_project_service_idx" ON "service_dependencies" USING btree ("project_id","source_service","target_service");--> statement-breakpoint
ALTER TABLE "alert_silences" DROP COLUMN IF EXISTS "matchers";