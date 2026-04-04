CREATE TYPE "public"."weekly_plan_status" AS ENUM('draft', 'finalized');
CREATE TYPE "public"."generation_event_status" AS ENUM('success', 'failure');

CREATE TABLE "weekly_plan" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "goal_id" text NOT NULL,
  "status" "weekly_plan_status" NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "generation_context" jsonb NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "generation_event" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "goal_id" text,
  "weekly_plan_id" text,
  "status" "generation_event_status" NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "start_date" text NOT NULL,
  "failure_category" text,
  "failure_message" text,
  "generation_context" jsonb NOT NULL,
  "model_output" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "weekly_plan"
  ADD CONSTRAINT "weekly_plan_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "weekly_plan"
  ADD CONSTRAINT "weekly_plan_goal_id_training_goal_id_fk"
  FOREIGN KEY ("goal_id") REFERENCES "public"."training_goal"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "generation_event"
  ADD CONSTRAINT "generation_event_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "generation_event"
  ADD CONSTRAINT "generation_event_goal_id_training_goal_id_fk"
  FOREIGN KEY ("goal_id") REFERENCES "public"."training_goal"("id")
  ON DELETE set null ON UPDATE no action;
ALTER TABLE "generation_event"
  ADD CONSTRAINT "generation_event_weekly_plan_id_weekly_plan_id_fk"
  FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plan"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX "weekly_plan_user_start_idx"
  ON "weekly_plan" USING btree ("user_id", "start_date");
CREATE UNIQUE INDEX "weekly_plan_active_draft_user_unique"
  ON "weekly_plan" USING btree ("user_id")
  WHERE "status" = 'draft';
CREATE INDEX "generation_event_user_created_idx"
  ON "generation_event" USING btree ("user_id", "created_at");
CREATE INDEX "generation_event_user_status_idx"
  ON "generation_event" USING btree ("user_id", "status");
