ALTER TABLE "imported_activity" ADD COLUMN "name" text;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "start_date_local" timestamp;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "device_name" text;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "total_elevation_loss_meters" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "max_speed_meters_per_second" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "max_heartrate" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "average_cadence" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "calories" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "training_load" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "hr_load" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "intensity" real;
--> statement-breakpoint
ALTER TABLE "imported_activity" ADD COLUMN "athlete_max_hr" real;
--> statement-breakpoint
CREATE TABLE "imported_activity_heart_rate_zone" (
  "user_id" text NOT NULL,
  "upstream_activity_id" text NOT NULL,
  "zone_index" integer NOT NULL,
  "lower_bpm" real NOT NULL,
  "duration_seconds" real NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "imported_activity_heart_rate_zone_user_id_upstream_activity_id_zone_index_pk" PRIMARY KEY("user_id","upstream_activity_id","zone_index")
);
--> statement-breakpoint
CREATE TABLE "imported_activity_interval" (
  "user_id" text NOT NULL,
  "upstream_activity_id" text NOT NULL,
  "interval_index" integer NOT NULL,
  "interval_type" text,
  "zone" real,
  "intensity" real,
  "distance_meters" real,
  "moving_time_seconds" real,
  "elapsed_time_seconds" real,
  "start_time_seconds" real,
  "end_time_seconds" real,
  "average_speed_meters_per_second" real,
  "max_speed_meters_per_second" real,
  "average_heartrate" real,
  "max_heartrate" real,
  "average_cadence" real,
  "average_stride" real,
  "total_elevation_gain_meters" real,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "imported_activity_interval_user_id_upstream_activity_id_interval_index_pk" PRIMARY KEY("user_id","upstream_activity_id","interval_index")
);
--> statement-breakpoint
ALTER TABLE "imported_activity_heart_rate_zone" ADD CONSTRAINT "imported_activity_heart_rate_zone_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "imported_activity_interval" ADD CONSTRAINT "imported_activity_interval_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "imported_activity_hr_zone_user_activity_idx" ON "imported_activity_heart_rate_zone" USING btree ("user_id","upstream_activity_id");
--> statement-breakpoint
CREATE INDEX "imported_activity_interval_user_activity_idx" ON "imported_activity_interval" USING btree ("user_id","upstream_activity_id");
