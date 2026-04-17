import { env } from "@corex/env/server";
import { runScheduledWeeklyPlanRenewalPromise } from "@corex/api/weekly-planning/scheduled-renewal";

void env.NODE_ENV;

try {
  const result = await runScheduledWeeklyPlanRenewalPromise();

  console.info(
    JSON.stringify({
      runId: result.runId,
      status: result.status,
      generatedCount: result.generatedCount,
      existingCount: result.existingCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
    }),
  );

  if (result.failedCount > 0 || result.status !== "success") {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    `Scheduled weekly plan renewal failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
