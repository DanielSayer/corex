CREATE TABLE "user_training_preference" (
  "user_id" text PRIMARY KEY NOT NULL,
  "timezone" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_training_preference" ADD CONSTRAINT "user_training_preference_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "user_training_preference" ("user_id", "timezone")
SELECT "id", 'UTC'
FROM "user"
ON CONFLICT ("user_id") DO NOTHING;
