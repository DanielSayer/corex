import { z } from "zod";

export const listSyncEventsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).default(0),
  })
  .strict()
  .default({ limit: 20, offset: 0 });

export type ListSyncEventsInput = z.input<typeof listSyncEventsInputSchema>;
export type ParsedListSyncEventsInput = z.infer<
  typeof listSyncEventsInputSchema
>;

export type SyncWarningSummary = {
  code: string;
  message: string;
  count: number | null;
};

export type SyncStatusSummary = {
  status: "in_progress" | "success" | "failure";
  historyCoverage: "initial_30d_window" | "incremental_from_cursor" | null;
  coveredDateRange: {
    start: string | null;
    end: string | null;
  };
  runsProcessed: number;
  newRuns: number;
  updatedRuns: number;
  unsupportedCount: number;
  invalidCount: number;
  fetchIssueCount: number;
  warningCount: number;
  lastAttemptedAt: string;
  lastCompletedAt: string | null;
  failureSummary: string | null;
};

export type SyncHistoryEvent = {
  eventId: string;
  status: "in_progress" | "success" | "failure";
  historyCoverage: "initial_30d_window" | "incremental_from_cursor" | null;
  coveredDateRange: {
    start: string | null;
    end: string | null;
  };
  insertedCount: number;
  updatedCount: number;
  skippedNonRunningCount: number;
  skippedInvalidCount: number;
  failedDetailCount: number;
  failedMapCount: number;
  failedStreamCount: number;
  storedMapCount: number;
  storedStreamCount: number;
  totalImportedCount: number;
  totalSkippedCount: number;
  totalFailedFetchCount: number;
  unknownActivityTypes: string[];
  warningSummaries: SyncWarningSummary[];
  failureCategory: string | null;
  failureSummary: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type SyncEventHistory = {
  items: SyncHistoryEvent[];
  nextOffset: number | null;
};
