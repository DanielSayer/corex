import { relations } from "drizzle-orm";
import {
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const weeklySnapshotJobRunStatusEnum = pgEnum(
  "weekly_snapshot_job_run_status",
  ["success", "partial_failure", "failure"],
);

export const weeklySnapshotJobAttemptStatusEnum = pgEnum(
  "weekly_snapshot_job_attempt_status",
  ["generated", "existing", "skipped_no_relevant_runs", "failed"],
);

export const weeklySnapshot = pgTable(
  "weekly_snapshot",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull(),
    weekStart: timestamp("week_start").notNull(),
    weekEnd: timestamp("week_end").notNull(),
    generatedAt: timestamp("generated_at").notNull(),
    sourceSyncCompletedAt: timestamp("source_sync_completed_at"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("weekly_snapshot_user_week_idx").on(
      table.userId,
      table.weekStart,
      table.weekEnd,
    ),
    unique("weekly_snapshot_user_week_timezone_unique").on(
      table.userId,
      table.weekStart,
      table.weekEnd,
      table.timezone,
    ),
  ],
);

export const weeklySnapshotJobRun = pgTable("weekly_snapshot_job_run", {
  id: text("id").primaryKey(),
  status: weeklySnapshotJobRunStatusEnum("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  generatedCount: integer("generated_count").notNull().default(0),
  existingCount: integer("existing_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const weeklySnapshotJobAttempt = pgTable(
  "weekly_snapshot_job_attempt",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => weeklySnapshotJobRun.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull(),
    weekStart: timestamp("week_start").notNull(),
    weekEnd: timestamp("week_end").notNull(),
    status: weeklySnapshotJobAttemptStatusEnum("status").notNull(),
    snapshotId: text("snapshot_id").references(() => weeklySnapshot.id, {
      onDelete: "set null",
    }),
    failureSummary: text("failure_summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("weekly_snapshot_job_attempt_run_idx").on(table.runId),
    index("weekly_snapshot_job_attempt_user_week_idx").on(
      table.userId,
      table.weekStart,
      table.weekEnd,
    ),
    index("weekly_snapshot_job_attempt_status_idx").on(table.status),
  ],
);

export const weeklySnapshotRelations = relations(weeklySnapshot, ({ one }) => ({
  user: one(user, {
    fields: [weeklySnapshot.userId],
    references: [user.id],
  }),
}));

export const weeklySnapshotJobRunRelations = relations(
  weeklySnapshotJobRun,
  ({ many }) => ({
    attempts: many(weeklySnapshotJobAttempt),
  }),
);

export const weeklySnapshotJobAttemptRelations = relations(
  weeklySnapshotJobAttempt,
  ({ one }) => ({
    run: one(weeklySnapshotJobRun, {
      fields: [weeklySnapshotJobAttempt.runId],
      references: [weeklySnapshotJobRun.id],
    }),
    user: one(user, {
      fields: [weeklySnapshotJobAttempt.userId],
      references: [user.id],
    }),
    snapshot: one(weeklySnapshot, {
      fields: [weeklySnapshotJobAttempt.snapshotId],
      references: [weeklySnapshot.id],
    }),
  }),
);
