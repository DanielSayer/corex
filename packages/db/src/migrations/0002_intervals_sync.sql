ALTER TABLE "intervals_credential" ADD COLUMN "intervals_username" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "intervals_credential" ADD COLUMN "intervals_athlete_id" text;
--> statement-breakpoint
ALTER TABLE "intervals_credential" ADD COLUMN "intervals_athlete_resolved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "intervals_credential" ALTER COLUMN "intervals_username" DROP DEFAULT;
--> statement-breakpoint
CREATE TYPE "public"."sync_event_status" AS ENUM('in_progress', 'success', 'failure');
--> statement-breakpoint
CREATE TYPE "public"."sync_history_coverage" AS ENUM('initial_30d_window', 'incremental_from_cursor');
--> statement-breakpoint
CREATE TABLE "imported_activity" (
	"user_id" text NOT NULL,
	"upstream_activity_id" text NOT NULL,
	"athlete_id" text NOT NULL,
	"upstream_activity_type" text NOT NULL,
	"normalized_activity_type" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"moving_time_seconds" integer NOT NULL,
	"elapsed_time_seconds" integer,
	"distance_meters" real NOT NULL,
	"total_elevation_gain_meters" real,
	"average_speed_meters_per_second" real,
	"average_heartrate" real,
	"raw_detail" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "imported_activity_user_id_upstream_activity_id_pk" PRIMARY KEY("user_id","upstream_activity_id")
);
--> statement-breakpoint
CREATE TABLE "sync_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "sync_event_status" NOT NULL,
	"history_coverage" "sync_history_coverage",
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"cursor_start_used" timestamp,
	"covered_range_start" timestamp,
	"covered_range_end" timestamp,
	"newest_imported_activity_start" timestamp,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_non_running_count" integer DEFAULT 0 NOT NULL,
	"skipped_invalid_count" integer DEFAULT 0 NOT NULL,
	"failed_detail_count" integer DEFAULT 0 NOT NULL,
	"unknown_activity_types" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"failed_details" jsonb NOT NULL,
	"failure_category" text,
	"failure_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD CONSTRAINT "imported_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_event" ADD CONSTRAINT "sync_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "imported_activity_user_start_idx" ON "imported_activity" USING btree ("user_id","start_at");
--> statement-breakpoint
CREATE INDEX "sync_event_user_started_idx" ON "sync_event" USING btree ("user_id","started_at");
--> statement-breakpoint
CREATE INDEX "sync_event_user_status_idx" ON "sync_event" USING btree ("user_id","status");
