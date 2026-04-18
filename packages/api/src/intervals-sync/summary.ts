import { sanitizeFailureSummary } from "../diagnostics/redaction";
import type { SyncStatusSummary } from "./contracts";
import type { SyncSummary } from "./repository-types";

export function toSyncStatusSummary(summary: SyncSummary): SyncStatusSummary {
  return {
    status: summary.status,
    historyCoverage: summary.historyCoverage,
    coveredDateRange: summary.coveredDateRange,
    runsProcessed: summary.insertedCount + summary.updatedCount,
    newRuns: summary.insertedCount,
    updatedRuns: summary.updatedCount,
    unsupportedCount: summary.skippedNonRunningCount,
    invalidCount: summary.skippedInvalidCount,
    fetchIssueCount:
      summary.failedDetailCount +
      summary.failedMapCount +
      summary.failedStreamCount,
    warningCount: summary.warnings.length,
    lastAttemptedAt: summary.startedAt,
    lastCompletedAt: summary.completedAt,
    failureSummary: sanitizeFailureSummary(summary.failureMessage),
  };
}
