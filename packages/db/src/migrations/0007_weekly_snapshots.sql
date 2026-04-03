CREATE TABLE "weekly_snapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "timezone" text NOT NULL,
  "week_start" timestamp NOT NULL,
  "week_end" timestamp NOT NULL,
  "generated_at" timestamp NOT NULL,
  "source_sync_completed_at" timestamp,
  "payload" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "weekly_snapshot_user_week_timezone_unique"
    UNIQUE("user_id", "week_start", "week_end", "timezone")
);
ALTER TABLE "weekly_snapshot"
  ADD CONSTRAINT "weekly_snapshot_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX "weekly_snapshot_user_week_idx"
  ON "weekly_snapshot" USING btree ("user_id", "week_start", "week_end");
