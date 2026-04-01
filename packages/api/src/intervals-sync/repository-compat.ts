import type { Database } from "@corex/db";

import { createImportedActivityWritePort } from "./imported-activity-repository";
import { createSyncLedgerPort } from "./sync-ledger-repository";
import type {
  ImportedActivityWritePort,
  SyncLedgerPort,
} from "./repository-types";

export type IntervalsSyncRepository = SyncLedgerPort &
  ImportedActivityWritePort & {
    hasInProgressSync: SyncLedgerPort["hasInProgress"];
    createSyncEvent: (
      userId: string,
      event: { id: string; startedAt: Date },
    ) => ReturnType<SyncLedgerPort["begin"]>;
    finalizeSyncSuccess: SyncLedgerPort["completeSuccess"];
    finalizeSyncFailure: SyncLedgerPort["completeFailure"];
    getLatestSyncSummary: SyncLedgerPort["latest"];
    getLatestSuccessfulSyncCursor: SyncLedgerPort["latestSuccessfulCursor"];
    upsertImportedActivity: ImportedActivityWritePort["upsert"];
  };

export function createIntervalsSyncRepository(
  db: Database,
): IntervalsSyncRepository {
  const ledger = createSyncLedgerPort(db);
  const activities = createImportedActivityWritePort(db);

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
  };
}
