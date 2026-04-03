ALTER TABLE "training_goal" ADD COLUMN "id" text;

UPDATE "training_goal"
SET "id" = "user_id" || ':' || EXTRACT(EPOCH FROM "created_at")::bigint::text
WHERE "id" IS NULL;

ALTER TABLE "training_goal" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "training_goal" DROP CONSTRAINT "training_goal_user_id_user_id_fk";
ALTER TABLE "training_goal" DROP CONSTRAINT "training_goal_pkey";
ALTER TABLE "training_goal" ADD CONSTRAINT "training_goal_pkey" PRIMARY KEY ("id");
ALTER TABLE "training_goal" ADD CONSTRAINT "training_goal_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "training_goal_user_id_idx" ON "training_goal" USING btree ("user_id");
