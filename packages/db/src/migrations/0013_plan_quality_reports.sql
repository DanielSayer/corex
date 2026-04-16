ALTER TABLE "weekly_plan" ADD COLUMN "quality_report" jsonb;
--> statement-breakpoint
ALTER TABLE "generation_event" ADD COLUMN "quality_report" jsonb;
