ALTER TABLE "weekly_plan"
  ADD COLUMN "parent_weekly_plan_id" text;

ALTER TABLE "weekly_plan"
  ADD CONSTRAINT "weekly_plan_parent_weekly_plan_id_weekly_plan_id_fk"
  FOREIGN KEY ("parent_weekly_plan_id") REFERENCES "public"."weekly_plan"("id")
  ON DELETE set null ON UPDATE no action;

DROP INDEX "weekly_plan_active_draft_user_unique";

CREATE UNIQUE INDEX "weekly_plan_draft_user_start_unique"
  ON "weekly_plan" USING btree ("user_id", "start_date")
  WHERE "status" = 'draft';
