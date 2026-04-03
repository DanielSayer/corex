import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

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

export const weeklySnapshotRelations = relations(weeklySnapshot, ({ one }) => ({
  user: one(user, {
    fields: [weeklySnapshot.userId],
    references: [user.id],
  }),
}));
