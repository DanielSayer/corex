import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { importedActivity } from "./intervals-sync";
import { trainingGoal } from "./training-settings";

export const weeklyPlanStatusEnum = pgEnum("weekly_plan_status", [
  "draft",
  "finalized",
]);

export const generationEventStatusEnum = pgEnum("generation_event_status", [
  "success",
  "failure",
]);

export const weeklyPlanRenewalJobRunStatusEnum = pgEnum(
  "weekly_plan_renewal_job_run_status",
  ["success", "partial_failure", "failure"],
);

export const weeklyPlanRenewalJobAttemptStatusEnum = pgEnum(
  "weekly_plan_renewal_job_attempt_status",
  [
    "generated",
    "existing_draft",
    "skipped_missing_settings",
    "skipped_no_finalized_plan",
    "skipped_not_due",
    "skipped_no_local_history",
    "failed",
  ],
);

export const weeklyPlan = pgTable(
  "weekly_plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    goalId: text("goal_id").references(() => trainingGoal.id, {
      onDelete: "cascade",
    }),
    parentWeeklyPlanId: text("parent_weekly_plan_id"),
    status: weeklyPlanStatusEnum("status").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    generationContext: jsonb("generation_context").notNull(),
    payload: jsonb("payload").notNull(),
    qualityReport: jsonb("quality_report"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("weekly_plan_user_start_idx").on(table.userId, table.startDate),
    index("weekly_plan_user_status_start_idx").on(
      table.userId,
      table.status,
      table.startDate,
    ),
    uniqueIndex("weekly_plan_draft_user_start_unique")
      .on(table.userId, table.startDate)
      .where(sql`${table.status} = 'draft'`),
    foreignKey({
      columns: [table.parentWeeklyPlanId],
      foreignColumns: [table.id],
      name: "weekly_plan_parent_weekly_plan_id_weekly_plan_id_fk",
    }).onDelete("set null"),
  ],
);

export const generationEvent = pgTable(
  "generation_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    goalId: text("goal_id").references(() => trainingGoal.id, {
      onDelete: "set null",
    }),
    weeklyPlanId: text("weekly_plan_id").references(() => weeklyPlan.id, {
      onDelete: "set null",
    }),
    status: generationEventStatusEnum("status").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    startDate: text("start_date").notNull(),
    failureCategory: text("failure_category"),
    failureMessage: text("failure_message"),
    generationContext: jsonb("generation_context").notNull(),
    modelOutput: jsonb("model_output"),
    qualityReport: jsonb("quality_report"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_event_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("generation_event_user_status_idx").on(table.userId, table.status),
  ],
);

export const weeklyPlanActivityLink = pgTable(
  "weekly_plan_activity_link",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weeklyPlanId: text("weekly_plan_id")
      .notNull()
      .references(() => weeklyPlan.id, { onDelete: "cascade" }),
    plannedDate: text("planned_date").notNull(),
    activityId: text("activity_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.weeklyPlanId, table.plannedDate],
    }),
    uniqueIndex("weekly_plan_activity_link_user_activity_unique").on(
      table.userId,
      table.activityId,
    ),
    index("weekly_plan_activity_link_user_plan_idx").on(
      table.userId,
      table.weeklyPlanId,
    ),
    foreignKey({
      columns: [table.userId, table.activityId],
      foreignColumns: [
        importedActivity.userId,
        importedActivity.upstreamActivityId,
      ],
      name: "weekly_plan_activity_link_imported_activity_fk",
    }).onDelete("cascade"),
  ],
);

export const weeklyPlanRenewalJobRun = pgTable("weekly_plan_renewal_job_run", {
  id: text("id").primaryKey(),
  status: weeklyPlanRenewalJobRunStatusEnum("status").notNull(),
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

export const weeklyPlanRenewalJobAttempt = pgTable(
  "weekly_plan_renewal_job_attempt",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => weeklyPlanRenewalJobRun.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull(),
    sourceWeeklyPlanId: text("source_weekly_plan_id").references(
      () => weeklyPlan.id,
      { onDelete: "set null" },
    ),
    generatedWeeklyPlanId: text("generated_weekly_plan_id").references(
      () => weeklyPlan.id,
      { onDelete: "set null" },
    ),
    targetStartDate: text("target_start_date"),
    targetEndDate: text("target_end_date"),
    status: weeklyPlanRenewalJobAttemptStatusEnum("status").notNull(),
    failureSummary: text("failure_summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("weekly_plan_renewal_attempt_run_idx").on(table.runId),
    index("weekly_plan_renewal_attempt_user_target_idx").on(
      table.userId,
      table.targetStartDate,
      table.targetEndDate,
    ),
    index("weekly_plan_renewal_attempt_status_idx").on(table.status),
  ],
);

export const weeklyPlanRelations = relations(weeklyPlan, ({ one }) => ({
  user: one(user, {
    fields: [weeklyPlan.userId],
    references: [user.id],
  }),
  goal: one(trainingGoal, {
    fields: [weeklyPlan.goalId],
    references: [trainingGoal.id],
  }),
}));

export const generationEventRelations = relations(
  generationEvent,
  ({ one }) => ({
    user: one(user, {
      fields: [generationEvent.userId],
      references: [user.id],
    }),
    goal: one(trainingGoal, {
      fields: [generationEvent.goalId],
      references: [trainingGoal.id],
    }),
    weeklyPlan: one(weeklyPlan, {
      fields: [generationEvent.weeklyPlanId],
      references: [weeklyPlan.id],
    }),
  }),
);

export const weeklyPlanActivityLinkRelations = relations(
  weeklyPlanActivityLink,
  ({ one }) => ({
    user: one(user, {
      fields: [weeklyPlanActivityLink.userId],
      references: [user.id],
    }),
    weeklyPlan: one(weeklyPlan, {
      fields: [weeklyPlanActivityLink.weeklyPlanId],
      references: [weeklyPlan.id],
    }),
  }),
);

export const weeklyPlanRenewalJobRunRelations = relations(
  weeklyPlanRenewalJobRun,
  ({ many }) => ({
    attempts: many(weeklyPlanRenewalJobAttempt),
  }),
);

export const weeklyPlanRenewalJobAttemptRelations = relations(
  weeklyPlanRenewalJobAttempt,
  ({ one }) => ({
    run: one(weeklyPlanRenewalJobRun, {
      fields: [weeklyPlanRenewalJobAttempt.runId],
      references: [weeklyPlanRenewalJobRun.id],
    }),
    user: one(user, {
      fields: [weeklyPlanRenewalJobAttempt.userId],
      references: [user.id],
    }),
    sourceWeeklyPlan: one(weeklyPlan, {
      fields: [weeklyPlanRenewalJobAttempt.sourceWeeklyPlanId],
      references: [weeklyPlan.id],
    }),
    generatedWeeklyPlan: one(weeklyPlan, {
      fields: [weeklyPlanRenewalJobAttempt.generatedWeeklyPlanId],
      references: [weeklyPlan.id],
    }),
  }),
);
