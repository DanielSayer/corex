import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { importedActivity, syncEvent } from "@corex/db/schema/intervals-sync";

import { SyncPersistenceFailure } from "./errors";
import type { IntervalsActivityDetail } from "./schemas";

export type FailedDetailDiagnostic = {
  activityId: string;
  type: string;
  startDate: string | null;
  message: string;
};

export type SyncSummary = {
  eventId: string;
  status: "in_progress" | "success" | "failure";
  historyCoverage: "initial_30d_window" | "incremental_from_cursor" | null;
  cursorStartUsed: string | null;
  coveredDateRange: {
    start: string | null;
    end: string | null;
  };
  newestImportedActivityStart: string | null;
  insertedCount: number;
  updatedCount: number;
  skippedNonRunningCount: number;
  skippedInvalidCount: number;
  failedDetailCount: number;
  unknownActivityTypes: string[];
  warnings: string[];
  failedDetails: FailedDetailDiagnostic[];
  failureCategory: string | null;
  failureMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type UpsertImportedActivityRecord = {
  userId: string;
  athleteId: string;
  detail: IntervalsActivityDetail;
  normalizedActivityType: string;
  startAt: Date;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number | null;
  distanceMeters: number;
};

export type FinalizeSuccessInput = {
  eventId: string;
  historyCoverage: "initial_30d_window" | "incremental_from_cursor";
  cursorStartUsed: Date;
  coveredRangeStart: Date | null;
  coveredRangeEnd: Date | null;
  newestImportedActivityStart: Date | null;
  insertedCount: number;
  updatedCount: number;
  skippedNonRunningCount: number;
  skippedInvalidCount: number;
  failedDetailCount: number;
  unknownActivityTypes: string[];
  warnings: string[];
  failedDetails: FailedDetailDiagnostic[];
  completedAt: Date;
};

export type FinalizeFailureInput = {
  eventId: string;
  failureCategory: string;
  failureMessage: string;
  completedAt: Date;
};

export type IntervalsSyncRepository = {
  hasInProgressSync: (
    userId: string,
  ) => Effect.Effect<boolean, SyncPersistenceFailure>;
  createSyncEvent: (
    userId: string,
    event: { id: string; startedAt: Date },
  ) => Effect.Effect<void, SyncPersistenceFailure>;
  upsertImportedActivity: (
    record: UpsertImportedActivityRecord,
  ) => Effect.Effect<"inserted" | "updated", SyncPersistenceFailure>;
  finalizeSyncSuccess: (
    input: FinalizeSuccessInput,
  ) => Effect.Effect<SyncSummary, SyncPersistenceFailure>;
  finalizeSyncFailure: (
    input: FinalizeFailureInput,
  ) => Effect.Effect<SyncSummary, SyncPersistenceFailure>;
  getLatestSyncSummary: (
    userId: string,
  ) => Effect.Effect<SyncSummary | null, SyncPersistenceFailure>;
  getLatestSuccessfulSyncCursor: (
    userId: string,
  ) => Effect.Effect<Date | null, SyncPersistenceFailure>;
};

function mapSyncSummary(row: typeof syncEvent.$inferSelect): SyncSummary {
  return {
    eventId: row.id,
    status: row.status,
    historyCoverage: row.historyCoverage,
    cursorStartUsed: row.cursorStartUsed?.toISOString() ?? null,
    coveredDateRange: {
      start: row.coveredRangeStart?.toISOString() ?? null,
      end: row.coveredRangeEnd?.toISOString() ?? null,
    },
    newestImportedActivityStart:
      row.newestImportedActivityStart?.toISOString() ?? null,
    insertedCount: row.insertedCount,
    updatedCount: row.updatedCount,
    skippedNonRunningCount: row.skippedNonRunningCount,
    skippedInvalidCount: row.skippedInvalidCount,
    failedDetailCount: row.failedDetailCount,
    unknownActivityTypes: (row.unknownActivityTypes as string[]) ?? [],
    warnings: (row.warnings as string[]) ?? [],
    failedDetails: (row.failedDetails as FailedDetailDiagnostic[]) ?? [],
    failureCategory: row.failureCategory,
    failureMessage: row.failureMessage,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function loadLatestSyncSummary(db: Database, userId: string) {
  const row = await db.query.syncEvent.findFirst({
    where: eq(syncEvent.userId, userId),
    orderBy: desc(syncEvent.startedAt),
  });

  return row ? mapSyncSummary(row) : null;
}

export function createIntervalsSyncRepository(
  db: Database,
): IntervalsSyncRepository {
  return {
    hasInProgressSync(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.syncEvent.findFirst({
            where: and(
              eq(syncEvent.userId, userId),
              eq(syncEvent.status, "in_progress"),
            ),
          });

          return row != null;
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to check in-progress sync state",
            cause,
          }),
      });
    },
    createSyncEvent(userId, event) {
      return Effect.tryPromise({
        try: async () => {
          await db.insert(syncEvent).values({
            id: event.id,
            userId,
            status: "in_progress",
            startedAt: event.startedAt,
            unknownActivityTypes: [],
            warnings: [],
            failedDetails: [],
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to create sync event",
            cause,
          }),
      });
    },
    upsertImportedActivity(record) {
      return Effect.tryPromise({
        try: async () => {
          const existing = await db.query.importedActivity.findFirst({
            where: and(
              eq(importedActivity.userId, record.userId),
              eq(importedActivity.upstreamActivityId, record.detail.id),
            ),
          });

          const values = {
            userId: record.userId,
            upstreamActivityId: record.detail.id,
            athleteId: record.athleteId,
            upstreamActivityType:
              record.detail.type ?? record.normalizedActivityType,
            normalizedActivityType: record.normalizedActivityType,
            startAt: record.startAt,
            movingTimeSeconds: record.movingTimeSeconds,
            elapsedTimeSeconds: record.elapsedTimeSeconds,
            distanceMeters: record.distanceMeters,
            totalElevationGainMeters:
              record.detail.total_elevation_gain ?? null,
            averageSpeedMetersPerSecond: record.detail.average_speed ?? null,
            averageHeartrate: record.detail.average_heartrate ?? null,
            rawDetail: record.detail,
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(importedActivity)
              .set(values)
              .where(
                and(
                  eq(importedActivity.userId, record.userId),
                  eq(importedActivity.upstreamActivityId, record.detail.id),
                ),
              );

            return "updated" as const;
          }

          await db.insert(importedActivity).values(values);
          return "inserted" as const;
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to upsert imported activity",
            cause,
          }),
      });
    },
    finalizeSyncSuccess(input) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .update(syncEvent)
            .set({
              status: "success",
              historyCoverage: input.historyCoverage,
              cursorStartUsed: input.cursorStartUsed,
              coveredRangeStart: input.coveredRangeStart,
              coveredRangeEnd: input.coveredRangeEnd,
              newestImportedActivityStart: input.newestImportedActivityStart,
              insertedCount: input.insertedCount,
              updatedCount: input.updatedCount,
              skippedNonRunningCount: input.skippedNonRunningCount,
              skippedInvalidCount: input.skippedInvalidCount,
              failedDetailCount: input.failedDetailCount,
              unknownActivityTypes: input.unknownActivityTypes,
              warnings: input.warnings,
              failedDetails: input.failedDetails,
              completedAt: input.completedAt,
              failureCategory: null,
              failureMessage: null,
              updatedAt: input.completedAt,
            })
            .where(eq(syncEvent.id, input.eventId))
            .returning();

          if (!row) {
            throw new SyncPersistenceFailure({
              message: "Sync event could not be finalized as success",
            });
          }

          return mapSyncSummary(row);
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to finalize sync success",
            cause,
          }),
      });
    },
    finalizeSyncFailure(input) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .update(syncEvent)
            .set({
              status: "failure",
              failureCategory: input.failureCategory,
              failureMessage: input.failureMessage,
              completedAt: input.completedAt,
              updatedAt: input.completedAt,
            })
            .where(eq(syncEvent.id, input.eventId))
            .returning();

          if (!row) {
            throw new SyncPersistenceFailure({
              message: "Sync event could not be finalized as failure",
            });
          }

          return mapSyncSummary(row);
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to finalize sync failure",
            cause,
          }),
      });
    },
    getLatestSyncSummary(userId) {
      return Effect.tryPromise({
        try: () => loadLatestSyncSummary(db, userId),
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to load latest sync summary",
            cause,
          }),
      });
    },
    getLatestSuccessfulSyncCursor(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.syncEvent.findFirst({
            where: and(
              eq(syncEvent.userId, userId),
              eq(syncEvent.status, "success"),
            ),
            orderBy: desc(syncEvent.startedAt),
          });

          return row?.newestImportedActivityStart ?? null;
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to load latest successful sync cursor",
            cause,
          }),
      });
    },
  };
}
