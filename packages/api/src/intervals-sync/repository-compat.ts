import type { Database } from "@corex/db";

import { createImportedActivityPort } from "./imported-activity-repository";
import { createSyncLedgerPort } from "./sync-ledger-repository";
import type { ImportedActivityPort, SyncLedgerPort } from "./repository-types";

export type IntervalsSyncRepository = SyncLedgerPort &
  ImportedActivityPort & {
    hasInProgressSync: SyncLedgerPort["hasInProgress"];
    createSyncEvent: (
      userId: string,
      event: { id: string; startedAt: Date },
    ) => ReturnType<SyncLedgerPort["begin"]>;
    finalizeSyncSuccess: SyncLedgerPort["completeSuccess"];
    finalizeSyncFailure: SyncLedgerPort["completeFailure"];
    getLatestSyncSummary: SyncLedgerPort["latest"];
    getLatestSuccessfulSyncCursor: SyncLedgerPort["latestSuccessfulCursor"];
    upsertImportedActivity: ImportedActivityPort["upsert"];
    getRecentActivities: ImportedActivityPort["recentActivities"];
  };

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
