import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { weeklySnapshot } from "@corex/db/schema/weekly-snapshots";

import type { WeeklyWrappedData } from "./contracts";

type WeeklySnapshotPersistenceFailure = Error;

export type StoredWeeklySnapshot = {
  id: string;
  userId: string;
  timezone: string;
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  sourceSyncCompletedAt: Date | null;
  payload: WeeklyWrappedData;
  createdAt: Date;
  updatedAt: Date;
};

export type WeeklySnapshotRepository = {
  findByUserAndWeek: (input: {
    userId: string;
    timezone: string;
    weekStart: Date;
    weekEnd: Date;
  }) => Effect.Effect<
    StoredWeeklySnapshot | null,
    WeeklySnapshotPersistenceFailure
  >;
  upsertForUserAndWeek: (record: {
    id: string;
    userId: string;
    timezone: string;
    weekStart: Date;
    weekEnd: Date;
    generatedAt: Date;
    sourceSyncCompletedAt: Date | null;
    payload: WeeklyWrappedData;
  }) => Effect.Effect<StoredWeeklySnapshot, WeeklySnapshotPersistenceFailure>;
  createForUserAndWeekIfMissing: (record: {
    id: string;
    userId: string;
    timezone: string;
    weekStart: Date;
    weekEnd: Date;
    generatedAt: Date;
    sourceSyncCompletedAt: Date | null;
    payload: WeeklyWrappedData;
  }) => Effect.Effect<
    { snapshot: StoredWeeklySnapshot; created: boolean },
    WeeklySnapshotPersistenceFailure
  >;
  getLatestForUser: (
    userId: string,
  ) => Effect.Effect<
    StoredWeeklySnapshot | null,
    WeeklySnapshotPersistenceFailure
  >;
};

function mapRow(row: typeof weeklySnapshot.$inferSelect): StoredWeeklySnapshot {
  return {
    id: row.id,
    userId: row.userId,
    timezone: row.timezone,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    generatedAt: row.generatedAt,
    sourceSyncCompletedAt: row.sourceSyncCompletedAt,
    payload: row.payload as WeeklyWrappedData,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createWeeklySnapshotRepository(
  db: Database,
): WeeklySnapshotRepository {
  return {
    findByUserAndWeek(input) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.weeklySnapshot.findFirst({
            where: and(
              eq(weeklySnapshot.userId, input.userId),
              eq(weeklySnapshot.timezone, input.timezone),
              eq(weeklySnapshot.weekStart, input.weekStart),
              eq(weeklySnapshot.weekEnd, input.weekEnd),
            ),
          });

          return row ? mapRow(row) : null;
        },
        catch: (cause) =>
          new Error(
            `Failed to load weekly snapshot: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    upsertForUserAndWeek(record) {
      return Effect.tryPromise({
        try: async () => {
          const [upserted] = await db
            .insert(weeklySnapshot)
            .values({
              id: record.id,
              userId: record.userId,
              timezone: record.timezone,
              weekStart: record.weekStart,
              weekEnd: record.weekEnd,
              generatedAt: record.generatedAt,
              sourceSyncCompletedAt: record.sourceSyncCompletedAt,
              payload: record.payload,
            })
            .onConflictDoUpdate({
              target: [
                weeklySnapshot.userId,
                weeklySnapshot.weekStart,
                weeklySnapshot.weekEnd,
                weeklySnapshot.timezone,
              ],
              set: {
                generatedAt: record.generatedAt,
                sourceSyncCompletedAt: record.sourceSyncCompletedAt,
                payload: record.payload,
                updatedAt: new Date(),
              },
            })
            .returning();

          if (!upserted) {
            throw new Error(
              "Weekly snapshot could not be reloaded after upsert",
            );
          }

          return mapRow(upserted);
        },
        catch: (cause) =>
          new Error(
            `Failed to persist weekly snapshot: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    createForUserAndWeekIfMissing(record) {
      return Effect.tryPromise({
        try: async () => {
          const [created] = await db
            .insert(weeklySnapshot)
            .values({
              id: record.id,
              userId: record.userId,
              timezone: record.timezone,
              weekStart: record.weekStart,
              weekEnd: record.weekEnd,
              generatedAt: record.generatedAt,
              sourceSyncCompletedAt: record.sourceSyncCompletedAt,
              payload: record.payload,
            })
            .onConflictDoNothing({
              target: [
                weeklySnapshot.userId,
                weeklySnapshot.weekStart,
                weeklySnapshot.weekEnd,
                weeklySnapshot.timezone,
              ],
            })
            .returning();

          if (created) {
            return { snapshot: mapRow(created), created: true };
          }

          const existing = await db.query.weeklySnapshot.findFirst({
            where: and(
              eq(weeklySnapshot.userId, record.userId),
              eq(weeklySnapshot.timezone, record.timezone),
              eq(weeklySnapshot.weekStart, record.weekStart),
              eq(weeklySnapshot.weekEnd, record.weekEnd),
            ),
          });

          if (!existing) {
            throw new Error(
              "Weekly snapshot conflict row could not be reloaded",
            );
          }

          return { snapshot: mapRow(existing), created: false };
        },
        catch: (cause) =>
          new Error(
            `Failed to create weekly snapshot: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    getLatestForUser(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.weeklySnapshot.findFirst({
            where: eq(weeklySnapshot.userId, userId),
            orderBy: [
              desc(weeklySnapshot.weekStart),
              desc(weeklySnapshot.generatedAt),
            ],
          });

          return row ? mapRow(row) : null;
        },
        catch: (cause) =>
          new Error(
            `Failed to load latest weekly snapshot: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
  };
}
