CREATE TABLE "weekly_plan_activity_link" (
  "user_id" text NOT NULL,
  "weekly_plan_id" text NOT NULL,
  "planned_date" text NOT NULL,
  "activity_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "weekly_plan_activity_link_weekly_plan_id_planned_date_pk"
    PRIMARY KEY ("weekly_plan_id", "planned_date")
);

ALTER TABLE "weekly_plan_activity_link"
  ADD CONSTRAINT "weekly_plan_activity_link_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "weekly_plan_activity_link"
  ADD CONSTRAINT "weekly_plan_activity_link_weekly_plan_id_weekly_plan_id_fk"
  FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plan"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "weekly_plan_activity_link"
  ADD CONSTRAINT "weekly_plan_activity_link_imported_activity_fk"
  FOREIGN KEY ("user_id", "activity_id")
  REFERENCES "public"."imported_activity"("user_id", "upstream_activity_id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "weekly_plan_activity_link_user_activity_unique"
  ON "weekly_plan_activity_link" USING btree ("user_id", "activity_id");

CREATE INDEX "weekly_plan_activity_link_user_plan_idx"
  ON "weekly_plan_activity_link" USING btree ("user_id", "weekly_plan_id");
