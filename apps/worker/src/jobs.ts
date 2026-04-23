import {
  runScheduledWeeklyPlanRenewalPromise,
  runScheduledWeeklySnapshotGenerationPromise,
} from "@corex/api/scheduled-jobs";

type Logger = Pick<typeof console, "error" | "info">;

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runWeeklySnapshotsJob(logger: Logger = console) {
  const result = await runScheduledWeeklySnapshotGenerationPromise();

  logger.info(
    JSON.stringify({
      job: "weekly-snapshots",
      runId: result.runId,
      status: result.status,
      generatedCount: result.generatedCount,
      existingCount: result.existingCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
    }),
  );

  if (result.failedCount > 0 || result.status !== "success") {
    throw new Error(
      `Weekly snapshot generation completed with status ${result.status}`,
    );
  }

  return result;
}

export async function runWeeklyPlanRenewalJob(logger: Logger = console) {
  const result = await runScheduledWeeklyPlanRenewalPromise();

  logger.info(
    JSON.stringify({
      job: "weekly-plan-renewal",
      runId: result.runId,
      status: result.status,
      generatedCount: result.generatedCount,
      existingCount: result.existingCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
    }),
  );

  if (result.failedCount > 0 || result.status !== "success") {
    throw new Error(
      `Weekly plan renewal completed with status ${result.status}`,
    );
  }

  return result;
}

export function logJobFailure(
  jobName: string,
  error: unknown,
  logger = console,
) {
  logger.error(`${jobName} failed: ${toErrorMessage(error)}`);
}
