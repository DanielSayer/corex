import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const syncEventStatusEnum = pgEnum("sync_event_status", [
  "in_progress",
  "success",
  "failure",
]);

export const syncHistoryCoverageEnum = pgEnum("sync_history_coverage", [
  "initial_30d_window",
  "incremental_from_cursor",
]);

export const importedActivity = pgTable(
  "imported_activity",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    athleteId: text("athlete_id").notNull(),
    upstreamActivityType: text("upstream_activity_type").notNull(),
    normalizedActivityType: text("normalized_activity_type").notNull(),
    startAt: timestamp("start_at").notNull(),
    movingTimeSeconds: integer("moving_time_seconds").notNull(),
    elapsedTimeSeconds: integer("elapsed_time_seconds"),
    distanceMeters: real("distance_meters").notNull(),
    totalElevationGainMeters: real("total_elevation_gain_meters"),
    averageSpeedMetersPerSecond: real("average_speed_meters_per_second"),
    averageHeartrate: real("average_heartrate"),
    rawDetail: jsonb("raw_detail").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.upstreamActivityId] }),
    index("imported_activity_user_start_idx").on(table.userId, table.startAt),
  ],
);

export const importedActivityMap = pgTable(
  "imported_activity_map",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    hasRoute: boolean("has_route").default(false).notNull(),
    hasWeather: boolean("has_weather").default(false).notNull(),
    rawMap: jsonb("raw_map").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.upstreamActivityId] }),
  ],
);

export const importedActivityStream = pgTable(
  "imported_activity_stream",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    streamType: text("stream_type").notNull(),
    allNull: boolean("all_null"),
    custom: boolean("custom"),
    rawStream: jsonb("raw_stream").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.upstreamActivityId, table.streamType],
    }),
    index("imported_activity_stream_user_activity_idx").on(
      table.userId,
      table.upstreamActivityId,
    ),
  ],
);

export const syncEvent = pgTable(
  "sync_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: syncEventStatusEnum("status").notNull(),
    historyCoverage: syncHistoryCoverageEnum("history_coverage"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    cursorStartUsed: timestamp("cursor_start_used"),
    coveredRangeStart: timestamp("covered_range_start"),
    coveredRangeEnd: timestamp("covered_range_end"),
    newestImportedActivityStart: timestamp("newest_imported_activity_start"),
    insertedCount: integer("inserted_count").default(0).notNull(),
    updatedCount: integer("updated_count").default(0).notNull(),
    skippedNonRunningCount: integer("skipped_non_running_count")
      .default(0)
      .notNull(),
    skippedInvalidCount: integer("skipped_invalid_count").default(0).notNull(),
    failedDetailCount: integer("failed_detail_count").default(0).notNull(),
    failedMapCount: integer("failed_map_count").default(0).notNull(),
    failedStreamCount: integer("failed_stream_count").default(0).notNull(),
    storedMapCount: integer("stored_map_count").default(0).notNull(),
    storedStreamCount: integer("stored_stream_count").default(0).notNull(),
    unknownActivityTypes: jsonb("unknown_activity_types").notNull(),
    warnings: jsonb("warnings").notNull(),
    failedDetails: jsonb("failed_details").notNull(),
    failureCategory: text("failure_category"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("sync_event_user_started_idx").on(table.userId, table.startedAt),
    index("sync_event_user_status_idx").on(table.userId, table.status),
  ],
);

export const importedActivityRelations = relations(
  importedActivity,
  ({ one, many }) => ({
    user: one(user, {
      fields: [importedActivity.userId],
      references: [user.id],
    }),
    map: many(importedActivityMap),
    streams: many(importedActivityStream),
  }),
);

export const importedActivityMapRelations = relations(
  importedActivityMap,
  ({ one }) => ({
    user: one(user, {
      fields: [importedActivityMap.userId],
      references: [user.id],
    }),
    activity: one(importedActivity, {
      fields: [
        importedActivityMap.userId,
        importedActivityMap.upstreamActivityId,
      ],
      references: [
        importedActivity.userId,
        importedActivity.upstreamActivityId,
      ],
    }),
  }),
);

export const importedActivityStreamRelations = relations(
  importedActivityStream,
  ({ one }) => ({
    user: one(user, {
      fields: [importedActivityStream.userId],
      references: [user.id],
    }),
    activity: one(importedActivity, {
      fields: [
        importedActivityStream.userId,
        importedActivityStream.upstreamActivityId,
      ],
      references: [
        importedActivity.userId,
        importedActivity.upstreamActivityId,
      ],
    }),
  }),
);

export const syncEventRelations = relations(syncEvent, ({ one }) => ({
  user: one(user, {
    fields: [syncEvent.userId],
    references: [user.id],
  }),
}));
