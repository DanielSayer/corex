CREATE TYPE "public"."training_goal_type" AS ENUM('event_goal', 'volume_goal');
--> statement-breakpoint
CREATE TYPE "public"."training_goal_metric" AS ENUM('distance', 'time');
--> statement-breakpoint
CREATE TYPE "public"."training_goal_period" AS ENUM('week', 'month');
--> statement-breakpoint
CREATE TYPE "public"."training_goal_unit" AS ENUM('km', 'mi', 'minutes');
--> statement-breakpoint
CREATE TYPE "public"."training_availability_day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
--> statement-breakpoint
CREATE TABLE "training_goal" (
	"user_id" text PRIMARY KEY NOT NULL,
	"goal_type" "training_goal_type" NOT NULL,
	"metric" "training_goal_metric",
	"period" "training_goal_period",
	"target_value" real,
	"unit" "training_goal_unit",
	"target_distance_value" real,
	"target_distance_unit" "training_goal_unit",
	"target_date" text,
	"event_name" text,
	"target_time_seconds" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_availability" (
	"user_id" text NOT NULL,
	"day_of_week" "training_availability_day" NOT NULL,
	"available" boolean NOT NULL,
	"max_duration_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "training_availability_user_id_day_of_week_pk" PRIMARY KEY("user_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "intervals_credential" (
	"user_id" text PRIMARY KEY NOT NULL,
	"intervals_api_key_ciphertext" text NOT NULL,
	"intervals_api_key_iv" text NOT NULL,
	"intervals_api_key_tag" text NOT NULL,
	"intervals_api_key_key_version" integer NOT NULL,
	"intervals_api_key_updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_goal" ADD CONSTRAINT "training_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "training_availability" ADD CONSTRAINT "training_availability_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intervals_credential" ADD CONSTRAINT "intervals_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
