ALTER TABLE "sync_event" ADD COLUMN "failed_map_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sync_event" ADD COLUMN "failed_stream_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sync_event" ADD COLUMN "stored_map_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sync_event" ADD COLUMN "stored_stream_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "imported_activity_map" (
	"user_id" text NOT NULL,
	"upstream_activity_id" text NOT NULL,
	"has_route" boolean DEFAULT false NOT NULL,
	"has_weather" boolean DEFAULT false NOT NULL,
	"raw_map" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "imported_activity_map_user_id_upstream_activity_id_pk" PRIMARY KEY("user_id","upstream_activity_id")
);
--> statement-breakpoint
CREATE TABLE "imported_activity_stream" (
	"user_id" text NOT NULL,
	"upstream_activity_id" text NOT NULL,
	"stream_type" text NOT NULL,
	"all_null" boolean,
	"custom" boolean,
	"raw_stream" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "imported_activity_stream_user_id_upstream_activity_id_stream_type_pk" PRIMARY KEY("user_id","upstream_activity_id","stream_type")
);
--> statement-breakpoint
ALTER TABLE "imported_activity_map" ADD CONSTRAINT "imported_activity_map_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "imported_activity_map" ADD CONSTRAINT "imported_activity_map_user_id_upstream_activity_id_imported_activity_user_id_upstream_activity_id_fk" FOREIGN KEY ("user_id","upstream_activity_id") REFERENCES "public"."imported_activity"("user_id","upstream_activity_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "imported_activity_stream" ADD CONSTRAINT "imported_activity_stream_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "imported_activity_stream" ADD CONSTRAINT "imported_activity_stream_user_id_upstream_activity_id_imported_activity_user_id_upstream_activity_id_fk" FOREIGN KEY ("user_id","upstream_activity_id") REFERENCES "public"."imported_activity"("user_id","upstream_activity_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "imported_activity_stream_user_activity_idx" ON "imported_activity_stream" USING btree ("user_id","upstream_activity_id");
