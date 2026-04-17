ALTER TABLE "user_training_preference"
  ADD COLUMN "automatic_weekly_plan_renewal_enabled" boolean DEFAULT false NOT NULL;

CREATE TYPE "weekly_plan_renewal_job_run_status" AS ENUM('success', 'partial_failure', 'failure');
CREATE TYPE "weekly_plan_renewal_job_attempt_status" AS ENUM(
  'generated',
  'existing_draft',
  'skipped_missing_settings',
  'skipped_no_finalized_plan',
  'skipped_not_due',
  'skipped_no_local_history',
  'failed'
);

CREATE TABLE "weekly_plan_renewal_job_run" (
  "id" text PRIMARY KEY NOT NULL,
  "status" "weekly_plan_renewal_job_run_status" NOT NULL,
  "started_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "generated_count" integer DEFAULT 0 NOT NULL,
  "existing_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "weekly_plan_renewal_job_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "user_id" text NOT NULL,
  "timezone" text NOT NULL,
  "source_weekly_plan_id" text,
  "generated_weekly_plan_id" text,
  "target_start_date" text,
  "target_end_date" text,
  "status" "weekly_plan_renewal_job_attempt_status" NOT NULL,
  "failure_summary" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "weekly_plan_renewal_job_attempt_run_id_weekly_plan_renewal_job_run_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "public"."weekly_plan_renewal_job_run"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "weekly_plan_renewal_job_attempt_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "weekly_plan_renewal_job_attempt_source_weekly_plan_id_weekly_plan_id_fk"
    FOREIGN KEY ("source_weekly_plan_id") REFERENCES "public"."weekly_plan"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "weekly_plan_renewal_job_attempt_generated_weekly_plan_id_weekly_plan_id_fk"
    FOREIGN KEY ("generated_weekly_plan_id") REFERENCES "public"."weekly_plan"("id")
    ON DELETE set null ON UPDATE no action
);

CREATE INDEX "weekly_plan_renewal_attempt_run_idx"
  ON "weekly_plan_renewal_job_attempt" ("run_id");
CREATE INDEX "weekly_plan_renewal_attempt_user_target_idx"
  ON "weekly_plan_renewal_job_attempt" ("user_id","target_start_date","target_end_date");
CREATE INDEX "weekly_plan_renewal_attempt_status_idx"
  ON "weekly_plan_renewal_job_attempt" ("status");
