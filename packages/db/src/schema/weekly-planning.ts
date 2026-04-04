import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { trainingGoal } from "./training-settings";

export const weeklyPlanStatusEnum = pgEnum("weekly_plan_status", [
  "draft",
  "finalized",
]);

export const generationEventStatusEnum = pgEnum("generation_event_status", [
  "success",
  "failure",
]);

export const weeklyPlan = pgTable(
  "weekly_plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    goalId: text("goal_id")
      .notNull()
      .references(() => trainingGoal.id, { onDelete: "cascade" }),
    status: weeklyPlanStatusEnum("status").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    generationContext: jsonb("generation_context").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("weekly_plan_user_start_idx").on(table.userId, table.startDate),
    uniqueIndex("weekly_plan_active_draft_user_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'draft'`),
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
