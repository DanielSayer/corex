CREATE TYPE "weekly_snapshot_job_run_status" AS ENUM('success', 'partial_failure', 'failure');
CREATE TYPE "weekly_snapshot_job_attempt_status" AS ENUM('generated', 'existing', 'skipped_no_relevant_runs', 'failed');

CREATE TABLE "weekly_snapshot_job_run" (
  "id" text PRIMARY KEY NOT NULL,
  "status" "weekly_snapshot_job_run_status" NOT NULL,
  "started_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "generated_count" integer DEFAULT 0 NOT NULL,
  "existing_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "weekly_snapshot_job_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "user_id" text NOT NULL,
  "timezone" text NOT NULL,
  "week_start" timestamp NOT NULL,
  "week_end" timestamp NOT NULL,
  "status" "weekly_snapshot_job_attempt_status" NOT NULL,
  "snapshot_id" text,
  "failure_summary" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "weekly_snapshot_job_attempt_run_id_weekly_snapshot_job_run_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "public"."weekly_snapshot_job_run"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "weekly_snapshot_job_attempt_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "weekly_snapshot_job_attempt_snapshot_id_weekly_snapshot_id_fk"
    FOREIGN KEY ("snapshot_id") REFERENCES "public"."weekly_snapshot"("id")
    ON DELETE set null ON UPDATE no action
);

CREATE INDEX "weekly_snapshot_job_attempt_run_idx" ON "weekly_snapshot_job_attempt" ("run_id");
CREATE INDEX "weekly_snapshot_job_attempt_user_week_idx" ON "weekly_snapshot_job_attempt" ("user_id","week_start","week_end");
CREATE INDEX "weekly_snapshot_job_attempt_status_idx" ON "weekly_snapshot_job_attempt" ("status");
