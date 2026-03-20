import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const trainingGoalTypeEnum = pgEnum("training_goal_type", [
  "event_goal",
  "volume_goal",
]);

export const trainingGoalMetricEnum = pgEnum("training_goal_metric", [
  "distance",
  "time",
]);

export const trainingGoalPeriodEnum = pgEnum("training_goal_period", [
  "week",
  "month",
]);

export const trainingGoalUnitEnum = pgEnum("training_goal_unit", [
  "km",
  "mi",
  "minutes",
]);

export const trainingAvailabilityDayEnum = pgEnum("training_availability_day", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const trainingGoal = pgTable("training_goal", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  goalType: trainingGoalTypeEnum("goal_type").notNull(),
  metric: trainingGoalMetricEnum("metric"),
  period: trainingGoalPeriodEnum("period"),
  targetValue: real("target_value"),
  unit: trainingGoalUnitEnum("unit"),
  targetDistanceValue: real("target_distance_value"),
  targetDistanceUnit: trainingGoalUnitEnum("target_distance_unit"),
  targetDate: text("target_date"),
  eventName: text("event_name"),
  targetTimeSeconds: integer("target_time_seconds"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const trainingAvailability = pgTable(
  "training_availability",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: trainingAvailabilityDayEnum("day_of_week").notNull(),
    available: boolean("available").notNull(),
    maxDurationMinutes: integer("max_duration_minutes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.dayOfWeek] })],
);

export const intervalsCredential = pgTable("intervals_credential", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  intervalsApiKeyCiphertext: text("intervals_api_key_ciphertext").notNull(),
  intervalsApiKeyIv: text("intervals_api_key_iv").notNull(),
  intervalsApiKeyTag: text("intervals_api_key_tag").notNull(),
  intervalsApiKeyKeyVersion: integer("intervals_api_key_key_version").notNull(),
  intervalsApiKeyUpdatedAt: timestamp("intervals_api_key_updated_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const trainingGoalRelations = relations(trainingGoal, ({ one }) => ({
  user: one(user, {
    fields: [trainingGoal.userId],
    references: [user.id],
  }),
}));

export const trainingAvailabilityRelations = relations(
  trainingAvailability,
  ({ one }) => ({
    user: one(user, {
      fields: [trainingAvailability.userId],
      references: [user.id],
    }),
  }),
);

export const intervalsCredentialRelations = relations(
  intervalsCredential,
  ({ one }) => ({
    user: one(user, {
      fields: [intervalsCredential.userId],
      references: [user.id],
    }),
  }),
);
