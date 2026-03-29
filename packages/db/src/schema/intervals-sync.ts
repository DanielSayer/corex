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
    name: text("name"),
    startAt: timestamp("start_at").notNull(),
    startDateLocal: timestamp("start_date_local"),
    deviceName: text("device_name"),
    movingTimeSeconds: integer("moving_time_seconds").notNull(),
    elapsedTimeSeconds: integer("elapsed_time_seconds"),
    distanceMeters: real("distance_meters").notNull(),
    totalElevationGainMeters: real("total_elevation_gain_meters"),
    totalElevationLossMeters: real("total_elevation_loss_meters"),
    averageSpeedMetersPerSecond: real("average_speed_meters_per_second"),
    maxSpeedMetersPerSecond: real("max_speed_meters_per_second"),
    averageHeartrate: real("average_heartrate"),
    maxHeartrate: real("max_heartrate"),
    averageCadence: real("average_cadence"),
    calories: real("calories"),
    trainingLoad: real("training_load"),
    hrLoad: real("hr_load"),
    intensity: real("intensity"),
    athleteMaxHr: real("athlete_max_hr"),
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

export const importedActivityHeartRateZone = pgTable(
  "imported_activity_heart_rate_zone",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    zoneIndex: integer("zone_index").notNull(),
    lowerBpm: real("lower_bpm").notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.upstreamActivityId, table.zoneIndex],
    }),
    index("imported_activity_hr_zone_user_activity_idx").on(
      table.userId,
      table.upstreamActivityId,
    ),
  ],
);

export const importedActivityInterval = pgTable(
  "imported_activity_interval",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    intervalIndex: integer("interval_index").notNull(),
    intervalType: text("interval_type"),
    zone: real("zone"),
    intensity: real("intensity"),
    distanceMeters: real("distance_meters"),
    movingTimeSeconds: real("moving_time_seconds"),
    elapsedTimeSeconds: real("elapsed_time_seconds"),
    startTimeSeconds: real("start_time_seconds"),
    endTimeSeconds: real("end_time_seconds"),
    averageSpeedMetersPerSecond: real("average_speed_meters_per_second"),
    maxSpeedMetersPerSecond: real("max_speed_meters_per_second"),
    averageHeartrate: real("average_heartrate"),
    maxHeartrate: real("max_heartrate"),
    averageCadence: real("average_cadence"),
    averageStride: real("average_stride"),
    totalElevationGainMeters: real("total_elevation_gain_meters"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.upstreamActivityId, table.intervalIndex],
    }),
    index("imported_activity_interval_user_activity_idx").on(
      table.userId,
      table.upstreamActivityId,
    ),
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

export const runBestEffort = pgTable(
  "run_best_effort",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    distanceMeters: real("distance_meters").notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    startSampleIndex: integer("start_sample_index").notNull(),
    endSampleIndex: integer("end_sample_index").notNull(),
    isAllTimePrAfterReconcile: boolean("is_all_time_pr_after_reconcile")
      .default(false)
      .notNull(),
    isMonthlyBestAfterReconcile: boolean("is_monthly_best_after_reconcile")
      .default(false)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.upstreamActivityId, table.distanceMeters],
    }),
    index("run_best_effort_user_distance_idx").on(
      table.userId,
      table.distanceMeters,
    ),
  ],
);

export const runProcessingWarning = pgTable(
  "run_processing_warning",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    code: text("code").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.upstreamActivityId, table.code],
    }),
    index("run_processing_warning_user_activity_idx").on(
      table.userId,
      table.upstreamActivityId,
    ),
  ],
);

export const userAllTimePr = pgTable(
  "user_all_time_pr",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    distanceMeters: real("distance_meters").notNull(),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    monthStart: timestamp("month_start").notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    startSampleIndex: integer("start_sample_index").notNull(),
    endSampleIndex: integer("end_sample_index").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.distanceMeters] }),
    index("user_all_time_pr_user_activity_idx").on(
      table.userId,
      table.upstreamActivityId,
    ),
  ],
);

export const userMonthlyBest = pgTable(
  "user_monthly_best",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    monthStart: timestamp("month_start").notNull(),
    distanceMeters: real("distance_meters").notNull(),
    upstreamActivityId: text("upstream_activity_id").notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    startSampleIndex: integer("start_sample_index").notNull(),
    endSampleIndex: integer("end_sample_index").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.monthStart, table.distanceMeters],
    }),
    index("user_monthly_best_user_distance_idx").on(
      table.userId,
      table.distanceMeters,
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
    heartRateZones: many(importedActivityHeartRateZone),
    intervals: many(importedActivityInterval),
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

export const importedActivityHeartRateZoneRelations = relations(
  importedActivityHeartRateZone,
  ({ one }) => ({
    user: one(user, {
      fields: [importedActivityHeartRateZone.userId],
      references: [user.id],
    }),
    activity: one(importedActivity, {
      fields: [
        importedActivityHeartRateZone.userId,
        importedActivityHeartRateZone.upstreamActivityId,
      ],
      references: [
        importedActivity.userId,
        importedActivity.upstreamActivityId,
      ],
    }),
  }),
);

export const importedActivityIntervalRelations = relations(
  importedActivityInterval,
  ({ one }) => ({
    user: one(user, {
      fields: [importedActivityInterval.userId],
      references: [user.id],
    }),
    activity: one(importedActivity, {
      fields: [
        importedActivityInterval.userId,
        importedActivityInterval.upstreamActivityId,
      ],
      references: [
        importedActivity.userId,
        importedActivity.upstreamActivityId,
      ],
    }),
  }),
);

export const runBestEffortRelations = relations(runBestEffort, ({ one }) => ({
  user: one(user, {
    fields: [runBestEffort.userId],
    references: [user.id],
  }),
  activity: one(importedActivity, {
    fields: [runBestEffort.userId, runBestEffort.upstreamActivityId],
    references: [importedActivity.userId, importedActivity.upstreamActivityId],
  }),
}));

export const runProcessingWarningRelations = relations(
  runProcessingWarning,
  ({ one }) => ({
    user: one(user, {
      fields: [runProcessingWarning.userId],
      references: [user.id],
    }),
    activity: one(importedActivity, {
      fields: [
        runProcessingWarning.userId,
        runProcessingWarning.upstreamActivityId,
      ],
      references: [
        importedActivity.userId,
        importedActivity.upstreamActivityId,
      ],
    }),
  }),
);

export const userAllTimePrRelations = relations(userAllTimePr, ({ one }) => ({
  user: one(user, {
    fields: [userAllTimePr.userId],
    references: [user.id],
  }),
  activity: one(importedActivity, {
    fields: [userAllTimePr.userId, userAllTimePr.upstreamActivityId],
    references: [importedActivity.userId, importedActivity.upstreamActivityId],
  }),
}));

export const userMonthlyBestRelations = relations(
  userMonthlyBest,
  ({ one }) => ({
    user: one(user, {
      fields: [userMonthlyBest.userId],
      references: [user.id],
    }),
    activity: one(importedActivity, {
      fields: [userMonthlyBest.userId, userMonthlyBest.upstreamActivityId],
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
