import type { Effect } from "effect";

import type { SyncPersistenceFailure } from "./errors";
import type { RecentActivityPreview } from "./recent-activity";
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
