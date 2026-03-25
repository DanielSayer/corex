CREATE TABLE "run_best_effort" (
	"user_id" text NOT NULL,
	"upstream_activity_id" text NOT NULL,
	"distance_meters" real NOT NULL,
	"duration_seconds" real NOT NULL,
	"start_sample_index" integer NOT NULL,
	"end_sample_index" integer NOT NULL,
	"is_all_time_pr_after_reconcile" boolean DEFAULT false NOT NULL,
	"is_monthly_best_after_reconcile" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "run_best_effort_user_id_upstream_activity_id_distance_meters_pk" PRIMARY KEY("user_id","upstream_activity_id","distance_meters")
);
--> statement-breakpoint
CREATE TABLE "run_processing_warning" (
	"user_id" text NOT NULL,
	"upstream_activity_id" text NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "run_processing_warning_user_id_upstream_activity_id_code_pk" PRIMARY KEY("user_id","upstream_activity_id","code")
);
--> statement-breakpoint
CREATE TABLE "user_all_time_pr" (
	"user_id" text NOT NULL,
	"distance_meters" real NOT NULL,
	"upstream_activity_id" text NOT NULL,
	"month_start" timestamp NOT NULL,
	"duration_seconds" real NOT NULL,
	"start_sample_index" integer NOT NULL,
	"end_sample_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_all_time_pr_user_id_distance_meters_pk" PRIMARY KEY("user_id","distance_meters")
);
--> statement-breakpoint
CREATE TABLE "user_monthly_best" (
	"user_id" text NOT NULL,
	"month_start" timestamp NOT NULL,
	"distance_meters" real NOT NULL,
	"upstream_activity_id" text NOT NULL,
	"duration_seconds" real NOT NULL,
	"start_sample_index" integer NOT NULL,
	"end_sample_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_monthly_best_user_id_month_start_distance_meters_pk" PRIMARY KEY("user_id","month_start","distance_meters")
);
--> statement-breakpoint
ALTER TABLE "run_best_effort" ADD CONSTRAINT "run_best_effort_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "run_best_effort" ADD CONSTRAINT "run_best_effort_user_id_upstream_activity_id_imported_activity_user_id_upstream_activity_id_fk" FOREIGN KEY ("user_id","upstream_activity_id") REFERENCES "public"."imported_activity"("user_id","upstream_activity_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "run_processing_warning" ADD CONSTRAINT "run_processing_warning_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "run_processing_warning" ADD CONSTRAINT "run_processing_warning_user_id_upstream_activity_id_imported_activity_user_id_upstream_activity_id_fk" FOREIGN KEY ("user_id","upstream_activity_id") REFERENCES "public"."imported_activity"("user_id","upstream_activity_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_all_time_pr" ADD CONSTRAINT "user_all_time_pr_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_all_time_pr" ADD CONSTRAINT "user_all_time_pr_user_id_upstream_activity_id_imported_activity_user_id_upstream_activity_id_fk" FOREIGN KEY ("user_id","upstream_activity_id") REFERENCES "public"."imported_activity"("user_id","upstream_activity_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_monthly_best" ADD CONSTRAINT "user_monthly_best_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_monthly_best" ADD CONSTRAINT "user_monthly_best_user_id_upstream_activity_id_imported_activity_user_id_upstream_activity_id_fk" FOREIGN KEY ("user_id","upstream_activity_id") REFERENCES "public"."imported_activity"("user_id","upstream_activity_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "run_best_effort_user_distance_idx" ON "run_best_effort" USING btree ("user_id","distance_meters");
--> statement-breakpoint
CREATE INDEX "run_processing_warning_user_activity_idx" ON "run_processing_warning" USING btree ("user_id","upstream_activity_id");
--> statement-breakpoint
CREATE INDEX "user_all_time_pr_user_activity_idx" ON "user_all_time_pr" USING btree ("user_id","upstream_activity_id");
--> statement-breakpoint
CREATE INDEX "user_monthly_best_user_distance_idx" ON "user_monthly_best" USING btree ("user_id","distance_meters");
