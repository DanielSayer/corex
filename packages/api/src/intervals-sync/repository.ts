import { and, desc, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityMap,
  importedActivityStream,
  syncEvent,
} from "@corex/db/schema/intervals-sync";

import { SyncPersistenceFailure } from "./errors";
import type { RecentActivityPreview } from "./recent-activity";
import {
  intervalsActivityDetailSchema,
  intervalsActivityMapSchema,
} from "./schemas";
import type {
  IntervalsActivityDetail,
  IntervalsActivityMap,
  IntervalsActivityStream,
} from "./schemas";

export type FailedDetailDiagnostic = {
  activityId: string;
  type: string;
  startDate: string | null;
  endpoint: "detail" | "map" | "streams";
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
  failedMapCount: number;
  failedStreamCount: number;
  storedMapCount: number;
  storedStreamCount: number;
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
  map?: IntervalsActivityMap | null;
  streams?: IntervalsActivityStream[];
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
  failedMapCount: number;
  failedStreamCount: number;
  storedMapCount: number;
  storedStreamCount: number;
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

export type SyncLedgerPort = {
  hasInProgress: (
    userId: string,
  ) => Effect.Effect<boolean, SyncPersistenceFailure>;
  begin: (
    userId: string,
    event: { eventId: string; startedAt: Date },
  ) => Effect.Effect<void, SyncPersistenceFailure>;
  latest: (
    userId: string,
  ) => Effect.Effect<SyncSummary | null, SyncPersistenceFailure>;
  latestSuccessfulCursor: (
    userId: string,
  ) => Effect.Effect<Date | null, SyncPersistenceFailure>;
  completeSuccess: (
    input: FinalizeSuccessInput,
  ) => Effect.Effect<SyncSummary, SyncPersistenceFailure>;
  completeFailure: (
    input: FinalizeFailureInput,
  ) => Effect.Effect<SyncSummary, SyncPersistenceFailure>;
};

export type ImportedActivityPort = {
  upsert: (
    record: UpsertImportedActivityRecord,
  ) => Effect.Effect<"inserted" | "updated", SyncPersistenceFailure>;
  recentActivities: (
    userId: string,
  ) => Effect.Effect<RecentActivityPreview[], SyncPersistenceFailure>;
};

export type IntervalsSyncRepository = SyncLedgerPort &
  ImportedActivityPort & {
    hasInProgressSync: SyncLedgerPort["hasInProgress"];
    createSyncEvent: (
      userId: string,
      event: { id: string; startedAt: Date },
    ) => Effect.Effect<void, SyncPersistenceFailure>;
    finalizeSyncSuccess: SyncLedgerPort["completeSuccess"];
    finalizeSyncFailure: SyncLedgerPort["completeFailure"];
    getLatestSyncSummary: SyncLedgerPort["latest"];
    getLatestSuccessfulSyncCursor: SyncLedgerPort["latestSuccessfulCursor"];
    upsertImportedActivity: ImportedActivityPort["upsert"];
    getRecentActivities: ImportedActivityPort["recentActivities"];
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
    failedMapCount: row.failedMapCount,
    failedStreamCount: row.failedStreamCount,
    storedMapCount: row.storedMapCount,
    storedStreamCount: row.storedStreamCount,
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

export function createSyncLedgerPort(db: Database): SyncLedgerPort {
  return {
    hasInProgress(userId) {
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
    begin(userId, event) {
      return Effect.tryPromise({
        try: async () => {
          await db.insert(syncEvent).values({
            id: event.eventId,
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
    latest(userId) {
      return Effect.tryPromise({
        try: () => loadLatestSyncSummary(db, userId),
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to load latest sync summary",
            cause,
          }),
      });
    },
    latestSuccessfulCursor(userId) {
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
    completeSuccess(input) {
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
              failedMapCount: input.failedMapCount,
              failedStreamCount: input.failedStreamCount,
              storedMapCount: input.storedMapCount,
              storedStreamCount: input.storedStreamCount,
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
    completeFailure(input) {
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
  };
}

export function createImportedActivityPort(db: Database): ImportedActivityPort {
  return {
    upsert(record) {
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

          return db.transaction(async (tx) => {
            if (existing) {
              await tx
                .update(importedActivity)
                .set(values)
                .where(
                  and(
                    eq(importedActivity.userId, record.userId),
                    eq(importedActivity.upstreamActivityId, record.detail.id),
                  ),
                );
            } else {
              await tx.insert(importedActivity).values(values);
            }

            if (record.map !== undefined && record.map !== null) {
              const mapValues = {
                userId: record.userId,
                upstreamActivityId: record.detail.id,
                hasRoute: record.map.route != null,
                hasWeather: record.map.weather != null,
                rawMap: record.map,
                updatedAt: new Date(),
              };
              const existingMap = await tx.query.importedActivityMap.findFirst({
                where: and(
                  eq(importedActivityMap.userId, record.userId),
                  eq(importedActivityMap.upstreamActivityId, record.detail.id),
                ),
              });

              if (existingMap) {
                await tx
                  .update(importedActivityMap)
                  .set(mapValues)
                  .where(
                    and(
                      eq(importedActivityMap.userId, record.userId),
                      eq(
                        importedActivityMap.upstreamActivityId,
                        record.detail.id,
                      ),
                    ),
                  );
              } else {
                await tx.insert(importedActivityMap).values(mapValues);
              }
            } else if (record.map === null) {
              await tx
                .delete(importedActivityMap)
                .where(
                  and(
                    eq(importedActivityMap.userId, record.userId),
                    eq(
                      importedActivityMap.upstreamActivityId,
                      record.detail.id,
                    ),
                  ),
                );
            }

            if (record.streams && record.streams.length > 0) {
              await tx.delete(importedActivityStream).where(
                and(
                  eq(importedActivityStream.userId, record.userId),
                  eq(
                    importedActivityStream.upstreamActivityId,
                    record.detail.id,
                  ),
                  inArray(
                    importedActivityStream.streamType,
                    record.streams.map((stream) => stream.type),
                  ),
                ),
              );

              await tx.insert(importedActivityStream).values(
                record.streams.map((stream) => ({
                  userId: record.userId,
                  upstreamActivityId: record.detail.id,
                  streamType: stream.type,
                  allNull: stream.allNull ?? null,
                  custom: stream.custom ?? null,
                  rawStream: stream,
                })),
              );
            }

            return existing ? ("updated" as const) : ("inserted" as const);
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to upsert imported activity",
            cause,
          }),
      });
    },
    recentActivities(userId) {
      return Effect.tryPromise({
        try: async () => {
          const activityRows = await db.query.importedActivity.findMany({
            where: eq(importedActivity.userId, userId),
            orderBy: desc(importedActivity.startAt),
            limit: 5,
          });

          if (activityRows.length === 0) {
            return [];
          }

          const mapRows = await db.query.importedActivityMap.findMany({
            where: and(
              eq(importedActivityMap.userId, userId),
              inArray(
                importedActivityMap.upstreamActivityId,
                activityRows.map((row) => row.upstreamActivityId),
              ),
            ),
          });

          const mapByActivityId = new Map(
            mapRows.map((row) => [row.upstreamActivityId, row]),
          );

          return activityRows.map((row) => {
            const detailResult = intervalsActivityDetailSchema.safeParse(
              row.rawDetail,
            );
            const detail = detailResult.success ? detailResult.data : null;
            const mapRow = mapByActivityId.get(row.upstreamActivityId);
            const mapResult = mapRow
              ? intervalsActivityMapSchema.safeParse(mapRow.rawMap)
              : null;
            const map = mapResult?.success ? mapResult.data : null;

            return {
              id: row.upstreamActivityId,
              name:
                typeof detail?.name === "string" &&
                detail.name.trim().length > 0
                  ? detail.name
                  : "Untitled run",
              startDate: row.startAt.toISOString(),
              distance: detail?.distance ?? 0,
              elapsedTime:
                detail?.elapsed_time == null
                  ? row.elapsedTimeSeconds
                  : Math.round(detail.elapsed_time),
              averageHeartrate:
                detail?.average_heartrate == null
                  ? row.averageHeartrate
                  : detail.average_heartrate,
              routePreview:
                map?.latlngs && Array.isArray(map.latlngs)
                  ? { latlngs: map.latlngs }
                  : null,
            };
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to load recent activities",
            cause,
          }),
      });
    },
  };
}

export function createIntervalsSyncRepository(
  db: Database,
): IntervalsSyncRepository {
  const ledger = createSyncLedgerPort(db);
  const activities = createImportedActivityPort(db);

  return {
    ...ledger,
    ...activities,
    hasInProgressSync: ledger.hasInProgress,
    createSyncEvent: (userId, event) =>
      ledger.begin(userId, {
        eventId: event.id,
        startedAt: event.startedAt,
      }),
    finalizeSyncSuccess: ledger.completeSuccess,
    finalizeSyncFailure: ledger.completeFailure,
    getLatestSyncSummary: ledger.latest,
    getLatestSuccessfulSyncCursor: ledger.latestSuccessfulCursor,
    upsertImportedActivity: activities.upsert,
    getRecentActivities: activities.recentActivities,
  };
}
