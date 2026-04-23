import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { syncEvent } from "@corex/db/schema/intervals-sync";

import {
  paginateOffsetResults,
  toOffsetPaginationQuery,
} from "../application/pagination";
import { sanitizeFailureSummary } from "../diagnostics/redaction";
import type { SyncWarningSummary } from "./contracts";
import { SyncPersistenceFailure } from "./errors";
import type { SyncLedgerPort, SyncSummary } from "./repository-types";

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
    failedDetails: (row.failedDetails as SyncSummary["failedDetails"]) ?? [],
    failureCategory: row.failureCategory,
    failureMessage: row.failureMessage,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function addCountSummary(
  summaries: SyncWarningSummary[],
  input: { code: string; message: string; count: number },
) {
  if (input.count > 0) {
    summaries.push(input);
  }
}

function mapWarningSummaries(
  row: typeof syncEvent.$inferSelect,
): SyncWarningSummary[] {
  const summaries: SyncWarningSummary[] = [];
  const unknownActivityTypes = (row.unknownActivityTypes as string[]) ?? [];

  addCountSummary(summaries, {
    code: "unsupported_activity_type",
    message: `${row.skippedNonRunningCount} unsupported activities were skipped`,
    count: row.skippedNonRunningCount,
  });
  addCountSummary(summaries, {
    code: "invalid_activity",
    message: `${row.skippedInvalidCount} activities could not be imported`,
    count: row.skippedInvalidCount,
  });
  addCountSummary(summaries, {
    code: "detail_fetch_failure",
    message: `${row.failedDetailCount} activity detail requests failed`,
    count: row.failedDetailCount,
  });
  addCountSummary(summaries, {
    code: "map_fetch_failure",
    message: `${row.failedMapCount} activity map requests failed`,
    count: row.failedMapCount,
  });
  addCountSummary(summaries, {
    code: "stream_fetch_failure",
    message: `${row.failedStreamCount} activity stream requests failed`,
    count: row.failedStreamCount,
  });

  if (unknownActivityTypes.length > 0) {
    summaries.push({
      code: "unknown_activity_types",
      message: `Unknown activity types: ${unknownActivityTypes.join(", ")}`,
      count: unknownActivityTypes.length,
    });
  }

  return summaries;
}

function mapSyncHistoryEvent(row: typeof syncEvent.$inferSelect) {
  const totalImportedCount = row.insertedCount + row.updatedCount;
  const totalSkippedCount =
    row.skippedNonRunningCount + row.skippedInvalidCount;
  const totalFailedFetchCount =
    row.failedDetailCount + row.failedMapCount + row.failedStreamCount;

  return {
    eventId: row.id,
    status: row.status,
    historyCoverage: row.historyCoverage,
    coveredDateRange: {
      start: row.coveredRangeStart?.toISOString() ?? null,
      end: row.coveredRangeEnd?.toISOString() ?? null,
    },
    insertedCount: row.insertedCount,
    updatedCount: row.updatedCount,
    skippedNonRunningCount: row.skippedNonRunningCount,
    skippedInvalidCount: row.skippedInvalidCount,
    failedDetailCount: row.failedDetailCount,
    failedMapCount: row.failedMapCount,
    failedStreamCount: row.failedStreamCount,
    storedMapCount: row.storedMapCount,
    storedStreamCount: row.storedStreamCount,
    totalImportedCount,
    totalSkippedCount,
    totalFailedFetchCount,
    unknownActivityTypes: (row.unknownActivityTypes as string[]) ?? [],
    warningSummaries: mapWarningSummaries(row),
    failureCategory: row.failureCategory,
    failureSummary: sanitizeFailureSummary(row.failureMessage),
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
    listEvents(userId, input) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db.query.syncEvent.findMany({
            where: eq(syncEvent.userId, userId),
            orderBy: desc(syncEvent.startedAt),
            ...toOffsetPaginationQuery(input),
          });

          return paginateOffsetResults(rows.map(mapSyncHistoryEvent), input);
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to list sync event history",
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
